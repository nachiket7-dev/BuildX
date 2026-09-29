// Disposable PostgreSQL and synthetic provider boundary; no external model calls.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
for(const key of Object.keys(process.env))if(/API_KEY|DATABASE_URL|JWT_SECRET/.test(key))delete process.env[key];
Object.assign(process.env,{DATABASE_URL:'postgresql://postgres:buildx-test-only@127.0.0.1:55439/buildx_test',ALLOW_DB_FALLBACK:'false',JWT_SECRET:'queue-spec-test-only',NODE_ENV:'test',AGENT_QUEUE_ENABLED:'true'});
const db=require('../dist/lib/db');
const fixture=require('../../audit/backend-2026-09-20/fixture.json');
let calls=0,lastPrompt='';
require('../dist/lib/agent/engine').runEngineeringAgent=async(prompt,files,options)=>{
 calls++;lastPrompt=prompt;
 await options.checkpoint({synthetic:true});
 return {stagedDiffs:{'blueprint.json':{modified:JSON.stringify({...fixture,description:'Refined description'})}}};
};
const {queuedSpecHandler}=require('../dist/lib/agent/queued-spec');
const {AgentQueue}=require('../dist/lib/agent/queue');
const {workOnce}=require('../dist/lib/agent/worker');
const jwt=require('jsonwebtoken');
let server,pool,base;
async function request(path,method='GET',body,token){return fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
(async()=>{
 const owner=await db.createUser('Spec test',randomUUID()+'@example.test','unused');
 const workspace=await db.saveBlueprint('Original product idea',fixture,owner);
 await db.saveBlueprintFile(workspace,'main.ts','existing code','typescript');
 pool=await db.getAgentPool();const queue=new AgentQueue(pool);await queue.initialize();
 server=require('../dist/app').default.listen(0,'127.0.0.1');
 await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 base='http://127.0.0.1:'+server.address().port;
 const token=jwt.sign({userId:owner,email:'test@example.test'},process.env.JWT_SECRET),other=jwt.sign({userId:randomUUID(),email:'other@example.test'},process.env.JWT_SECRET);
 const endpoint='/api/agent/'+workspace+'/spec-jobs';
 const input={key:randomUUID(),kind:'refine',prompt:'Improve the description'};
 for(const path of ['/api/blueprint/generate-stream','/api/blueprint/refine','/api/blueprint/'+workspace+'/codegen','/api/agent/'+workspace+'/chat','/api/blueprints/'+workspace+'/enhance-ui'])
  assert.equal((await request(path,'POST',{},token)).status,409);
 assert.equal((await request('/api/agent/queue-health','GET',undefined,token)).status,503);
 await queue.workerHeartbeat(randomUUID());
 assert.deepEqual(await(await request('/api/agent/queue-health','GET',undefined,token)).json(),{ready:true});
 await pool.query('DELETE FROM agent_workers');
 assert.equal((await request(endpoint,'POST',input)).status,401);
 assert.equal((await request(endpoint,'POST',input,other)).status,404);
 assert.equal((await request(endpoint,'POST',{...input,model:'qwen'},token)).status,400);
 const submitted=await request(endpoint,'POST',input,token);assert.equal(submitted.status,202);
 const job=await submitted.json();
 assert.equal((await (await request(endpoint,'POST',input,token)).json()).jobId,job.jobId);
 await workOnce(queue,{refine:queuedSpecHandler},new AbortController().signal);
 const done=await (await request(endpoint+'/'+job.jobId,'GET',undefined,token)).json();
 assert.equal(done.status,'completed',done.error);
 assert.equal(done.requestKey,input.key);
 assert.equal((await db.getBlueprintOwnedByUser(workspace,owner)).parsedBlueprint.description,'Refined description');
 assert.equal((await db.getBlueprintFiles(workspace))[0].content,'existing code');
 console.log('PASS: refinement ownership, model validation, idempotency, persisted spec and unchanged code');
 const regen=await queue.enqueue({owner,workspace,key:randomUUID(),kind:'regenerate',payload:{prompt:'Regenerate'}});
 const active=await queue.claim();const context={signal:new AbortController().signal,checkpoint:state=>queue.checkpoint(active,state)};
 const output=await queuedSpecHandler(active,context);assert.match(lastPrompt,/Original product idea/);
 await assert.rejects(queue.complete(active,output.result,async client=>{await output.commit(client);throw new Error('rollback');}),/rollback/);
 const before=calls;const saved=await queue.get(regen.id,owner);
 const recovered=await queuedSpecHandler(saved,context);assert.equal(calls,before);
 await pool.query('UPDATE blueprints SET blueprint=$1 WHERE id=$2',[JSON.stringify({...fixture,description:'Newer user change'}),workspace]);
 await assert.rejects(queue.complete(active,recovered.result,recovered.commit),/changed during job/);
 assert.equal((await db.getBlueprintOwnedByUser(workspace,owner)).parsedBlueprint.description,'Newer user change');
 await assert.rejects(queuedSpecHandler(saved,context),/changed since checkpoint/);
 await queue.cancel(regen.id,owner);
 const cancelled=await (await request(endpoint,'POST',{...input,key:randomUUID()},token)).json();
 assert.equal((await request(endpoint+'/'+cancelled.jobId+'/cancel','POST',{},other)).status,404);
 assert.equal((await (await request(endpoint+'/'+cancelled.jobId+'/cancel','POST',{},token)).json()).cancelled,true);
 assert.equal(await queue.claim(),null);
 console.log('PASS: regeneration prompt, checkpoint reuse, atomic rollback, concurrent-spec rejection and cancellation');
 await pool.query("UPDATE agent_jobs SET updated_at=clock_timestamp()-interval '31 days' WHERE id=$1",[job.jobId]);
 await queue.retain(30,false);
 assert.equal((await request(endpoint+'/'+job.jobId,'GET',undefined,token)).status,410);
 assert.equal((await db.getBlueprintOwnedByUser(workspace,owner)).parsedBlueprint.description,'Newer user change');
 console.log('PASS: legacy execution guard, authenticated readiness and expired job HTTP response');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 if(pool)await pool.end();
});
