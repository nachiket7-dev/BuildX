import type { PoolClient } from 'pg';
import { AgentQueue, Job } from './queue';
import { isTransientProviderFailure, queueRetryDelayMs } from '../llm/providerFailure';
export type JobHandler=(job:Job,context:{signal:AbortSignal;checkpoint:(state:unknown)=>Promise<void>})=>Promise<{result:unknown;commit?:(client:PoolClient)=>Promise<void>}>;
/** One bounded claim/execute cycle. Deployment supervisor owns polling/concurrency.
 * Handler commits must use the queue-provided transaction, never a second pool. */
export async function workOnce(queue:AgentQueue,handlers:Partial<Record<Job['kind'],JobHandler>>,shutdown:AbortSignal,options={leaseMs:30000,deadlineMs:480000}):Promise<boolean> {
 shutdown.throwIfAborted();
 if(!Number.isInteger(options.deadlineMs)||options.deadlineMs<100||options.deadlineMs>900000)throw new Error('Invalid worker deadline');
 const job=await queue.claim(options.leaseMs);
 if(!job)return false;
 const controller=new AbortController();
 const stop=()=>controller.abort(new Error('Worker shutting down'));
 shutdown.addEventListener('abort',stop,{once:true});
 if(shutdown.aborted)stop();
 let pending:Promise<void>|undefined;
 const timer=setInterval(()=>{
  if(pending || controller.signal.aborted)return;
  pending=queue.heartbeat(job,options.leaseMs).catch(error=>controller.abort(error)).finally(()=>{pending=undefined;});
 },Math.max(25,Math.floor(options.leaseMs/3)));
 const deadline=setTimeout(()=>controller.abort(new Error('Job deadline exceeded')),options.deadlineMs);
 try {
  controller.signal.throwIfAborted();
  const handler=handlers[job.kind];
  if(!handler)throw new Error('No handler for job kind: '+job.kind);
  const output=await handler(job,{signal:controller.signal,checkpoint:state=>queue.checkpoint(job,state)});
  controller.signal.throwIfAborted();
  await queue.complete(job,output.result,output.commit);
 } catch(error) {
  // Shutdown leaves the lease/checkpoint for bounded recovery by another worker.
  // Cancelled or lease-lost attempts cannot overwrite another owner's state.
  if(!shutdown.aborted){
   if(!controller.signal.aborted && isTransientProviderFailure(error) && job.attempt<job.max_attempts){
    await queue.defer(job,queueRetryDelayMs(error,job.attempt)).catch(()=>{});
   }else{
    const message=isTransientProviderFailure(error)
     ? 'AI capacity remained unavailable after the retry limit. Your saved work was not changed; try again later.'
     : error instanceof Error?error.message:String(error);
    await queue.fail(job,message).catch(()=>{});
   }
  }
 } finally {
  clearInterval(timer);clearTimeout(deadline);shutdown.removeEventListener('abort',stop);await pending;
 }
 return true;
}
