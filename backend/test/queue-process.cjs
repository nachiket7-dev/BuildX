// An actual process death/restart, against the fixed disposable database only.
const assert=require('node:assert/strict');
const {fork}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {Pool}=require('pg');
const {AgentQueue}=require('../dist/lib/agent/queue');
const {workOnce}=require('../dist/lib/agent/worker');
const pool=new Pool({connectionString:'postgresql://postgres:buildx-test-only@127.0.0.1:55439/buildx_test'});
const queue=new AgentQueue(pool);
if(process.argv[2]==='child'){
 workOnce(queue,{chat:async(job,ctx)=>{
  if(process.argv[3]==='interrupt'){
   await ctx.checkpoint({step:7});process.send({checkpoint:true});
   await new Promise(()=>{});
  }
  assert.deepEqual(job.checkpoint,{step:7});return {result:{recovered:true}};
 }},new AbortController().signal,{leaseMs:300,deadlineMs:10000}).then(()=>pool.end()).then(()=>process.disconnect()).catch(error=>{console.error(error);process.exit(1);});
}else{
 let child;
 const spawn=mode=>fork(__filename,['child',mode],{stdio:['ignore','inherit','inherit','ipc'],env:{PATH:process.env.PATH}});
 (async()=>{
  await Promise.all([queue.initialize(),queue.initialize()]);
  const job=await queue.enqueue({owner:'crash-test',workspace:randomUUID(),key:randomUUID(),kind:'chat',payload:{prompt:'synthetic'}});
  child=spawn('interrupt');
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('Child checkpoint timed out')),5000);
   child.once('message',()=>{clearTimeout(timeout);resolve();});
   child.once('error',error=>{clearTimeout(timeout);reject(error);});
  });
  const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;
  await new Promise(resolve=>setTimeout(resolve,400));
  child=spawn('recover');
  assert.equal(await new Promise(resolve=>child.once('exit',resolve)),0);
  const recovered=await queue.get(job.id,job.owner_id);
  assert.equal(recovered.status,'completed');assert.equal(recovered.attempt,2);assert.deepEqual(recovered.result,{recovered:true});
  console.log('PASS: actual SIGKILL, expired lease, new worker process and persisted checkpoint recovery');
 })().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{child?.kill();await pool.end();});
}
