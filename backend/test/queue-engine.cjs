// Real HTTP + PostgreSQL queue + agent engine + Docker check. Scripted model turns only.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
for(const key of Object.keys(process.env))if(/API_KEY|DATABASE_URL|JWT_SECRET/.test(key))delete process.env[key];
Object.assign(process.env,{DATABASE_URL:'postgresql://postgres:buildx-test-only@127.0.0.1:55439/buildx_test',ALLOW_DB_FALLBACK:'false',JWT_SECRET:'queue-engine-test-only',NODE_ENV:'test',AGENT_QUEUE_ENABLED:'true',AGENT_SANDBOX_IMAGE:'buildx-checks:local'});
const db=require('../dist/lib/db');
const engine=require('../dist/lib/agent/engine');const realEngine=engine.runEngineeringAgent;
const {AgentQueue}=require('../dist/lib/agent/queue');
const {workOnce}=require('../dist/lib/agent/worker');
const jwt=require('jsonwebtoken');
const tool=(name,args)=>{const calls=[{id:randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}];return {message:{role:'assistant',content:null,tool_calls:calls},text:'',toolCalls:calls,finishReason:'tool_calls'};};
const turns=[tool('define_acceptance',{criteria:[{id:'types',description:'Changed source typechecks',project:'.',kind:'typecheck'}]}),tool('read_file',{path:'main.ts'}),tool('apply_patch',{path:'main.ts',before:'count = 1',after:'count = 2'}),tool('run_check',{kind:'typecheck',project:'.'}),tool('finish',{summary:'Changed count'})];
let shutdown=new AbortController(),interrupt=true,index=0,reviewed=false,resumed=false;
engine.runEngineeringAgent=(prompt,files,options,emit)=>{
 resumed=!!options.resume;
 return realEngine(prompt,files,{...options,checkpoint:async state=>{await options.checkpoint(state);if(interrupt && state.calls===2){interrupt=false;shutdown.abort();}},call:async(model,messages,tools)=>{
  if(model==='gemini-3.5-flash'){reviewed=true;assert.ok(!messages.some(m=>m.tool_calls?.some(t=>t.function.name==='finish')));const text='{"findings":[],"limitations":["Scripted reviewer; not a model-quality evaluation"]}';return {message:{role:'assistant',content:text},text,toolCalls:[],finishReason:'stop'};}
  assert.ok(index<turns.length,'Unexpected extra model call');return turns[index++];
 }},emit);
};
const {queuedWorkspaceHandler}=require('../dist/lib/agent/queued-workspace');
let pool,server;
(async()=>{
 const owner=await db.createUser('Engine test',randomUUID()+'@example.test','unused');
 const workspace=await db.saveBlueprint('Engine integration',require('../../audit/backend-2026-09-20/fixture.json'),owner);
 for(const [path,content] of Object.entries({'main.ts':'export const count = 1;','tsconfig.json':'{"compilerOptions":{"skipLibCheck":true,"strict":true},"include":["main.ts"]}'}))await db.saveBlueprintFile(workspace,path,content,path.endsWith('json')?'json':'typescript');
 pool=await db.getAgentPool();const queue=new AgentQueue(pool);await queue.initialize();
 server=require('../dist/app').default.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api/agent/'+workspace+'/jobs';
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({userId:owner,email:'test@example.test'},process.env.JWT_SECRET)};
 const submission=await fetch(base,{method:'POST',headers,body:JSON.stringify({key:randomUUID(),kind:'chat',prompt:'Change count to 2 and typecheck'})});assert.equal(submission.status,202);const {jobId}=await submission.json();
 await workOnce(queue,{chat:queuedWorkspaceHandler},shutdown.signal);
 const interrupted=await queue.get(jobId,owner);assert.equal(interrupted.status,'running');assert.equal(interrupted.checkpoint.state.calls,2);
 await pool.query("UPDATE agent_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[jobId]);
 shutdown=new AbortController();await workOnce(queue,{chat:queuedWorkspaceHandler},shutdown.signal);
 const result=await(await fetch(base+'/'+jobId,{headers})).json();
 assert.equal(result.status,'completed',result.error);assert.equal(result.attempt,2);assert.equal(resumed,true);assert.equal(reviewed,true);assert.equal(index,5);
 assert.equal(result.result.checksPassed,true);assert.equal(result.result.acceptance[0].status,'passed');
 assert.equal(result.result.stagedDiffs['main.ts'].modified,'export const count = 2;');
 assert.equal((await db.getBlueprintFiles(workspace)).find(f=>f.path==='main.ts').content,'export const count = 1;');
 console.log('PASS: real HTTP/queue/engine checkpoint recovery, real Docker typecheck, isolated scripted review, candidate-only result');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(pool)await pool.end();});
