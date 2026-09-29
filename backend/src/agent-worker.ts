import 'dotenv/config';
import dns from 'dns';
import { randomUUID } from 'crypto';
dns.setDefaultResultOrder('ipv4first');
import { setTimeout as delay } from 'timers/promises';
import { getAgentPool } from './lib/db';
import { AgentQueue } from './lib/agent/queue';
import { workOnce } from './lib/agent/worker';
import { queuedSpecHandler } from './lib/agent/queued-spec';
import { queuedBlueprintHandler } from './lib/agent/queued-blueprint';
import { queuedWorkspaceHandler } from './lib/agent/queued-workspace';
async function main(){
 if(process.env.AGENT_QUEUE_ENABLED!=='true')throw new Error('Enable AGENT_QUEUE_ENABLED explicitly before starting a worker');
 const pool=await getAgentPool();if(!pool)throw new Error('Worker requires PostgreSQL; local fallback is not durable across hosts');
 const queue=new AgentQueue(pool);await queue.initialize();
 const workerId=randomUUID();
 await queue.workerHeartbeat(workerId);
 const presence=setInterval(()=>{void queue.workerHeartbeat(workerId).catch(error=>console.error('Worker heartbeat failed:',error.message));},10000);
 const shutdown=new AbortController();
 process.once('SIGTERM',()=>shutdown.abort());process.once('SIGINT',()=>shutdown.abort());
 while(!shutdown.signal.aborted){
  try {
   const worked=await workOnce(queue,{refine:queuedSpecHandler,regenerate:queuedSpecHandler,blueprint:queuedBlueprintHandler,chat:queuedWorkspaceHandler,repair:queuedWorkspaceHandler,codegen:queuedWorkspaceHandler},shutdown.signal);
   if(!worked)await delay(1000,undefined,{signal:shutdown.signal});
  }catch(error){if(shutdown.signal.aborted)break;console.error('Worker cycle failed:',error instanceof Error?error.message:'unknown');await delay(2000,undefined,{signal:shutdown.signal}).catch(()=>{});}
 }
 clearInterval(presence);
 await pool.end();
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
