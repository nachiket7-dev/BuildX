// Local release rehearsal only: fixed disposable database/container, no dotenv.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {Pool}=require('pg');
const {AgentQueue}=require('../dist/lib/agent/queue');
const {workOnce}=require('../dist/lib/agent/worker');
const connectionString='postgresql://postgres:buildx-test-only@127.0.0.1:55439/buildx_test';
const pool=new Pool({connectionString,max:8,connectionTimeoutMillis:5000});
const queue=new AgentQueue(pool);
const run='drill-'+randomUUID();
let restored;
const restoreDatabase='restore_'+randomUUID().replace(/-/g,'');
(async()=>{
 await queue.initialize();
 process.env.AGENT_MAX_ACTIVE_TOTAL='24';process.env.AGENT_MAX_ACTIVE_PER_OWNER='3';process.env.AGENT_REQUESTS_PER_MINUTE='1000';
 const ids=[];const latencies=[];let executions=0;
 // Ten batches with four competing consumers and a pool smaller than total producers.
 for(let batch=0;batch<10;batch++){
  const submissions=await Promise.all(Array.from({length:24},async(_,n)=>{
   const start=performance.now();const job=await queue.enqueue({owner:run+'-'+(n%8),workspace:randomUUID(),key:randomUUID(),kind:'chat',payload:{batch,n}});
   latencies.push(performance.now()-start);ids.push(job.id);return job;
  }));
  await assert.rejects(queue.enqueue({owner:run+'-excess',workspace:randomUUID(),key:randomUUID(),kind:'chat',payload:{}}),error=>error.status===429);
  assert.equal((await queue.health()).queued,24);
  const handler=async(job,context)=>{
   executions++;await context.checkpoint({accepted:job.payload});
   await new Promise(resolve=>setTimeout(resolve,5));
   return {result:{batch:job.payload.batch,n:job.payload.n}};
  };
  await Promise.all(Array.from({length:4},async()=>{while(await workOnce(queue,{chat:handler},new AbortController().signal)){};}));
  for(const job of submissions){const done=await queue.get(job.id,job.owner_id);assert.equal(done.status,'completed');assert.equal(done.attempt,1);}
 }
 assert.equal(executions,240);assert.equal((await queue.health()).queued,0);assert.equal((await queue.health()).running,0);
 latencies.sort((a,b)=>a-b);
 console.log(JSON.stringify({check:'local queue load',jobs:240,workers:4,pool:8,completed:executions,admissionP95ms:Math.round(latencies[Math.floor(latencies.length*.95)]),scope:'bounded local rehearsal, not deployment capacity certification'}));
 // Provider failures cannot create successful artifacts. Recovery accepts fresh work.
 const outage=await queue.enqueue({owner:run,workspace:randomUUID(),key:randomUUID(),kind:'chat',payload:{}});
 await workOnce(queue,{chat:async()=>{throw new Error('Synthetic provider unavailable');}},new AbortController().signal);
 const failed=await queue.get(outage.id,run);assert.equal(failed.status,'failed');assert.equal(failed.result,null);
 const retry=await queue.enqueue({owner:run,workspace:outage.workspace_id,key:randomUUID(),kind:'chat',payload:{}});
 await workOnce(queue,{chat:async()=>({result:{recovered:true}})},new AbortController().signal);
 assert.equal((await queue.get(retry.id,run)).status,'completed');
 // Health transitions are machine-readable; no notification is sent to a third party.
 const worker=run;await queue.workerHeartbeat(worker);assert.ok((await queue.health()).workers>0);
 await pool.query("UPDATE agent_workers SET last_seen=clock_timestamp()-interval '31 seconds'");
 assert.equal((await queue.health()).workers,0);
 console.log('PASS: provider-outage failure containment, fresh-request recovery, readiness loss');
 // pg_dump/restore into a second disposable database, never the source database.
 const dump=execFileSync('docker',['exec','buildx-queue-test-db','pg_dump','-U','postgres','-d','buildx_test','-Fc'],{maxBuffer:32*1024*1024});
 execFileSync('docker',['exec','buildx-queue-test-db','createdb','-U','postgres',restoreDatabase]);
 execFileSync('docker',['exec','-i','buildx-queue-test-db','pg_restore','-U','postgres','-d',restoreDatabase,'--no-owner','--exit-on-error'],{input:dump,maxBuffer:1024*1024});
 restored=new Pool({connectionString:connectionString.replace('/buildx_test','/'+restoreDatabase)});
 const originalRows=(await pool.query('SELECT id,request_hash,status,attempt,checkpoint,result FROM agent_jobs WHERE id=ANY($1::uuid[]) ORDER BY id',[ids])).rows;
 const restoredRows=(await restored.query('SELECT id,request_hash,status,attempt,checkpoint,result FROM agent_jobs WHERE id=ANY($1::uuid[]) ORDER BY id',[ids])).rows;
 assert.deepEqual(restoredRows,originalRows);
 const restoredQueue=new AgentQueue(restored);await Promise.all([restoredQueue.initialize(),restoredQueue.initialize()]);
 const sample=await queue.get(ids[0],run+'-0');
 const duplicate=await restoredQueue.enqueue({owner:sample.owner_id,workspace:sample.workspace_id,key:(await restored.query('SELECT request_key FROM agent_jobs WHERE id=$1',[sample.id])).rows[0].request_key,kind:'chat',payload:sample.payload});
 assert.equal(duplicate.id,sample.id);assert.equal(duplicate.status,'completed');
 console.log('PASS: real PostgreSQL dump/restore, exact result/checkpoint preservation, repeated schema startup and restored idempotency');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(restored)await restored.end();await pool.end();});
