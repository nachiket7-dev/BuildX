import { randomUUID, createHash } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

const inputSchema=z.object({owner:z.string().min(1).max(200),workspace:z.string().min(1).max(200),
  key:z.string().min(1).max(200),kind:z.enum(['chat','blueprint','codegen','repair','refine','regenerate']),payload:z.record(z.unknown()),maxAttempts:z.number().int().min(1).max(5).default(3)}).strict();
export type JobInput=z.input<typeof inputSchema>;
export interface Job {
 id:string; request_key:string; owner_id:string; workspace_id:string; kind:string; payload:Record<string,unknown>;
 status:'queued'|'running'|'completed'|'failed'|'cancelled'; attempt:number; max_attempts:number;
 fence:string|null; archived_at?:string|null; next_attempt_at:string|null; checkpoint:unknown; result:unknown; error:string|null; cancel_requested:boolean;
}
const lost=()=>new Error('Job lease lost, expired or cancelled');
// PostgreSQL JSONB and different clients may serialize object keys differently.
// Arrays retain their order; object key order must not change request identity.
function canonicalJson(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(value!==null && typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>JSON.stringify(key)+':'+canonicalJson(item)).join(',')+'}';
 return JSON.stringify(value);
}

/** PostgreSQL-only queue. Every mutation of running work is fenced by a unique
 * attempt token. Lease time comes from the database, never the worker clock. */
export class AgentQueue {
 constructor(private pool:Pool) {}
 async initialize() {
  const client=await this.pool.connect();
  try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('buildx.agent_jobs.schema',0))");
  await client.query(`CREATE TABLE IF NOT EXISTS agent_jobs (
   id UUID PRIMARY KEY, owner_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
   request_key TEXT NOT NULL, request_hash TEXT NOT NULL, kind TEXT NOT NULL,
   payload JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
   attempt INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL,
   fence UUID, lease_until TIMESTAMPTZ, cancel_requested BOOLEAN NOT NULL DEFAULT false,
   checkpoint JSONB, result JSONB, error TEXT, next_attempt_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
   UNIQUE(owner_id,request_key), CHECK(status IN ('queued','running','completed','failed','cancelled'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS agent_jobs_one_active_workspace ON agent_jobs(workspace_id) WHERE status IN ('queued','running');
  CREATE INDEX IF NOT EXISTS agent_jobs_claim ON agent_jobs(status,created_at);
  ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
  ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS agent_jobs_due ON agent_jobs(next_attempt_at,created_at) WHERE status='queued';
  CREATE TABLE IF NOT EXISTS agent_workers(id TEXT PRIMARY KEY,last_seen TIMESTAMPTZ NOT NULL);
  CREATE TABLE IF NOT EXISTS agent_admissions(owner_id TEXT PRIMARY KEY,window_start TIMESTAMPTZ NOT NULL,count INTEGER NOT NULL);`);
  await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async enqueue(input:JobInput):Promise<Job> {
  const value=inputSchema.parse(input);
  const serialized=JSON.stringify({workspace:value.workspace,kind:value.kind,payload:value.payload,maxAttempts:value.maxAttempts});
  if(Buffer.byteLength(serialized)>1000000)throw new Error('Job payload exceeds 1MB');
  const hash=createHash('sha256').update(canonicalJson(JSON.parse(serialized))).digest('hex');
  const legacyHash=createHash('sha256').update(serialized).digest('hex');
  const client=await this.pool.connect();
  try {
   await client.query('BEGIN');
   // Short global admission lock makes per-owner and aggregate limits atomic
   // across API instances; execution remains concurrent through SKIP LOCKED.
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('buildx.agent_jobs.admission',0))");
   const existing=await client.query('SELECT * FROM agent_jobs WHERE owner_id=$1 AND request_key=$2',[value.owner,value.key]);
   if(existing.rows[0]){
    if(existing.rows[0].request_hash!==hash && existing.rows[0].request_hash!==legacyHash)throw new Error('Idempotency key reused with different input');
    await client.query('COMMIT');return existing.rows[0];
   }
   const active=await client.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE owner_id=$1)::int AS owned FROM agent_jobs WHERE status IN ('queued','running')",[value.owner]);
   const limit=(name:string,fallback:number)=>{const n=Number(process.env[name]??fallback);if(!Number.isInteger(n)||n<1||n>10000)throw new Error('Invalid queue limit: '+name);return n;};
   if(active.rows[0].owned>=limit('AGENT_MAX_ACTIVE_PER_OWNER',2)||active.rows[0].total>=limit('AGENT_MAX_ACTIVE_TOTAL',8))
    throw Object.assign(new Error('Active job limit reached. Finish or cancel existing work before submitting more.'),{status:429});
   const admission=await client.query(`INSERT INTO agent_admissions(owner_id,window_start,count) VALUES($1,clock_timestamp(),1)
    ON CONFLICT(owner_id) DO UPDATE SET window_start=CASE WHEN agent_admissions.window_start<clock_timestamp()-interval '1 minute' THEN clock_timestamp() ELSE agent_admissions.window_start END,
    count=CASE WHEN agent_admissions.window_start<clock_timestamp()-interval '1 minute' THEN 1 ELSE agent_admissions.count+1 END RETURNING count`,[value.owner]);
   if(admission.rows[0].count>limit('AGENT_REQUESTS_PER_MINUTE',6))throw Object.assign(new Error('Job submission rate limit reached. Retry in a minute.'),{status:429});
   const result=await client.query(`INSERT INTO agent_jobs(id,owner_id,workspace_id,request_key,request_hash,kind,payload,max_attempts)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [randomUUID(),value.owner,value.workspace,value.key,hash,value.kind,JSON.stringify(value.payload),value.maxAttempts]);
   await client.query('COMMIT');return result.rows[0];
  }catch(error:any){
   await client.query('ROLLBACK');
   if(error.code==='23505')throw new Error('A queued or running job already owns this workspace');
   throw error;
  }finally{client.release();}
 }

 async workerHeartbeat(id:string) {
  await this.pool.query(`INSERT INTO agent_workers(id,last_seen) VALUES($1,clock_timestamp()) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen`,[id]);
 }
 async health() {
  const result=await this.pool.query(`SELECT
   (SELECT count(*)::int FROM agent_workers WHERE last_seen>clock_timestamp()-interval '30 seconds') AS workers,
   count(*) FILTER(WHERE status='queued' AND (next_attempt_at IS NULL OR next_attempt_at<=clock_timestamp()))::int AS queued,
   count(*) FILTER(WHERE status='queued' AND next_attempt_at>clock_timestamp())::int AS waiting,
   count(*) FILTER(WHERE status='running')::int AS running,
   count(*) FILTER(WHERE status='running' AND lease_until<clock_timestamp())::int AS expired_leases FROM agent_jobs`);
  return result.rows[0];
 }
 async retain(days=30,dryRun=true) {
  if(!Number.isInteger(days)||days<7||days>3650)throw new Error('Retention must be 7..3650 days');
  const predicate="status IN ('completed','failed','cancelled') AND archived_at IS NULL AND updated_at<clock_timestamp()-($1::integer*interval '1 day')";
  if(dryRun)return Number((await this.pool.query(`SELECT count(*) FROM agent_jobs WHERE ${predicate}`,[days])).rows[0].count);
  const archived=await this.pool.query(`UPDATE agent_jobs SET payload='{}',checkpoint=NULL,result=NULL,error=NULL,archived_at=clock_timestamp() WHERE ${predicate}`,[days]);
  await this.pool.query("DELETE FROM agent_workers WHERE last_seen<clock_timestamp()-interval '1 day'");
  await this.pool.query("DELETE FROM agent_admissions WHERE window_start<clock_timestamp()-interval '1 day'");
  return archived.rowCount||0;
 }
 async list(workspace:string,owner:string) {
  return (await this.pool.query(`SELECT id,request_key AS "requestKey",CASE WHEN archived_at IS NOT NULL THEN 'expired' ELSE status END AS status,error,updated_at AS "updatedAt",next_attempt_at AS "nextAttemptAt",payload->>'prompt' AS prompt
    FROM agent_jobs WHERE workspace_id=$1 AND owner_id=$2 AND kind IN ('chat','repair','codegen')
    ORDER BY created_at DESC LIMIT 50`,[workspace,owner])).rows;
 }
 async get(id:string,owner:string):Promise<Job|null> {
  if(!z.string().uuid().safeParse(id).success)return null;
  return (await this.pool.query('SELECT * FROM agent_jobs WHERE id=$1 AND owner_id=$2',[id,owner])).rows[0]||null;
 }
 async cancel(id:string,owner:string) {
  if(!z.string().uuid().safeParse(id).success)return false;
  const result=await this.pool.query(`UPDATE agent_jobs SET cancel_requested=true,
   status='cancelled',fence=NULL,lease_until=NULL,next_attempt_at=NULL,updated_at=clock_timestamp()
   WHERE id=$1 AND owner_id=$2 AND status IN ('queued','running') RETURNING id`,[id,owner]);
  return !!result.rowCount;
 }
 private duration(ms:number) {if(!Number.isInteger(ms)||ms<100||ms>300000)throw new Error('Lease must be 100..300000ms');return ms;}
 async claim(leaseMs=30000):Promise<Job|null> {
  this.duration(leaseMs);
  await this.pool.query(`UPDATE agent_jobs SET status=CASE WHEN cancel_requested THEN 'cancelled' ELSE 'failed' END,
    fence=NULL,lease_until=NULL,error='Worker lease expired after maximum attempts',updated_at=clock_timestamp()
    WHERE status='running' AND lease_until<=clock_timestamp() AND (cancel_requested OR attempt>=max_attempts)`);
  const result=await this.pool.query(`WITH candidate AS (
    SELECT id FROM agent_jobs WHERE NOT cancel_requested AND attempt<max_attempts AND
    ((status='queued' AND (next_attempt_at IS NULL OR next_attempt_at<=clock_timestamp())) OR (status='running' AND lease_until<=clock_timestamp()))
    ORDER BY COALESCE(next_attempt_at,created_at),created_at FOR UPDATE SKIP LOCKED LIMIT 1
   ) UPDATE agent_jobs j SET status='running',attempt=attempt+1,fence=$1,
   lease_until=clock_timestamp()+($2::integer * interval '1 millisecond'),next_attempt_at=NULL,error=NULL,updated_at=clock_timestamp()
   FROM candidate WHERE j.id=candidate.id RETURNING j.*`,[randomUUID(),leaseMs]);
  return result.rows[0]||null;
 }
 async heartbeat(job:Job,leaseMs=30000) {
  this.duration(leaseMs);
  const result=await this.pool.query(`UPDATE agent_jobs SET lease_until=clock_timestamp()+($3::integer*interval '1 millisecond'),updated_at=clock_timestamp()
   WHERE id=$1 AND fence=$2 AND status='running' AND NOT cancel_requested AND lease_until>clock_timestamp()`,[job.id,job.fence,leaseMs]);
  if(!result.rowCount)throw lost();
 }
 async checkpoint(job:Job,state:unknown) {
  const serialized=JSON.stringify(state);
  if(!serialized || Buffer.byteLength(serialized)>4000000)throw new Error('Checkpoint must be JSON under 4MB');
  const result=await this.pool.query(`UPDATE agent_jobs SET checkpoint=$3,updated_at=clock_timestamp()
   WHERE id=$1 AND fence=$2 AND status='running' AND NOT cancel_requested AND lease_until>clock_timestamp()`,[job.id,job.fence,serialized]);
  if(!result.rowCount)throw lost();
 }
 async fail(job:Job,error:string) {
  const result=await this.pool.query(`UPDATE agent_jobs SET status='failed',error=$3,fence=NULL,lease_until=NULL,updated_at=clock_timestamp()
   WHERE id=$1 AND fence=$2 AND status='running' AND NOT cancel_requested AND lease_until>clock_timestamp()`,[job.id,job.fence,error.slice(0,2000)]);
  if(!result.rowCount)throw lost();
 }
 async defer(job:Job,delayMs:number) {
  if(!Number.isInteger(delayMs)||delayMs<1_000||delayMs>900_000)throw new Error('Retry delay must be 1..900 seconds');
  const result=await this.pool.query(`UPDATE agent_jobs SET status='queued',fence=NULL,lease_until=NULL,
   next_attempt_at=clock_timestamp()+($3::integer*interval '1 millisecond'),
   error='AI capacity is temporarily unavailable. Retrying automatically.',updated_at=clock_timestamp()
   WHERE id=$1 AND fence=$2 AND status='running' AND NOT cancel_requested AND lease_until>clock_timestamp()
   AND attempt<max_attempts RETURNING id`,[job.id,job.fence,delayMs]);
  if(!result.rowCount)throw lost();
 }
 /** Commit effects through this transaction client ONLY. No external calls or
  * writes through another pool: those cannot be rolled back or fenced. */
 async complete(job:Job,result:unknown,commit?:(client:PoolClient)=>Promise<void>) {
  const serialized=JSON.stringify(result);
  if(!serialized||Buffer.byteLength(serialized)>4000000)throw new Error('Result must be JSON under 4MB');
  const client=await this.pool.connect();
  try {
   await client.query('BEGIN');
   await client.query("SET LOCAL statement_timeout='5s'");
   const locked=await client.query(`SELECT id FROM agent_jobs WHERE id=$1 AND fence=$2 AND status='running'
     AND NOT cancel_requested AND lease_until>clock_timestamp() FOR UPDATE`,[job.id,job.fence]);
   if(!locked.rowCount)throw lost();
   await commit?.(client);
   const saved=await client.query(`UPDATE agent_jobs SET status='completed',result=$3,fence=NULL,lease_until=NULL,updated_at=clock_timestamp()
     WHERE id=$1 AND fence=$2 AND status='running' AND NOT cancel_requested AND lease_until>clock_timestamp()`,[job.id,job.fence,serialized]);
   if(!saved.rowCount)throw lost();
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
