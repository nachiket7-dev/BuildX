// Real application API/DB/worker/engine/sandbox behind a local browser build.
// Only model responses are scripted; no provider credentials or live calls.
const path=require('node:path');
const fs=require('node:fs');
const express=require('express');
const bcrypt=require('bcryptjs');
const {randomUUID}=require('node:crypto');
for(const key of Object.keys(process.env))if(/API_KEY|DATABASE_URL|JWT_SECRET|AGENT_QUEUE/.test(key))delete process.env[key];
Object.assign(process.env,{DATABASE_URL:'postgresql://postgres:buildx-test-only@127.0.0.1:55439/buildx_browser_test',ALLOW_DB_FALLBACK:'false',JWT_SECRET:'browser-engine-local-test-secret',NODE_ENV:'test',AGENT_QUEUE_ENABLED:'true',AGENT_SANDBOX_IMAGE:'buildx-checks:local',ALLOWED_ORIGINS:'http://127.0.0.1:5193'});
const db=require('../dist/lib/db');
const engine=require('../dist/lib/agent/engine');const realEngine=engine.runEngineeringAgent;
const tool=(name,args)=>{const calls=[{id:randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}];return {message:{role:'assistant',content:null,tool_calls:calls},text:'',toolCalls:calls,finishReason:'tool_calls'};};
engine.runEngineeringAgent=(prompt,files,options,emit)=>realEngine(prompt,files,{...options,call:async(model,messages,_tools,signal)=>{
 await new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},2000);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();});
 if(model==='gemini-3.5-flash'){const text='{"findings":[],"limitations":["Scripted model responses; local transport verification only"]}';return {message:{role:'assistant',content:text},text,toolCalls:[],finishReason:'stop'};}
 const count=messages.filter(message=>message.role==='tool').length;
 const actions=[tool('define_acceptance',{criteria:[{id:'types',description:'Source typechecks',project:'.',kind:'typecheck'}]}),tool('read_file',{path:'main.ts'}),tool('apply_patch',{path:'main.ts',before:'count = 1',after:'count = 2'}),tool('run_check',{kind:'typecheck',project:'.'}),tool('finish',{summary:'Changed count'})];
 if(!actions[count])throw new Error('Unexpected scripted action count');return actions[count];
}},emit);
const {AgentQueue}=require('../dist/lib/agent/queue');const {workOnce}=require('../dist/lib/agent/worker');const {queuedWorkspaceHandler}=require('../dist/lib/agent/queued-workspace');
let pool,server,heartbeat;const shutdown=new AbortController();
(async()=>{
 const email='browser-'+randomUUID()+'@example.test',password='Synthetic-browser-123';
 const owner=await db.createUser('Local browser test',email,await bcrypt.hash(password,10));
 const fixture=require('../../audit/backend-2026-09-20/fixture.json');
 const id=await db.saveBlueprint('Local queue end-to-end',fixture,owner);
 await db.saveBlueprintFile(id,'main.ts','export const count = 1;','typescript');
 await db.saveBlueprintFile(id,'tsconfig.json','{"compilerOptions":{"skipLibCheck":true,"strict":true},"include":["main.ts"]}','json');
 pool=await db.getAgentPool();const queue=new AgentQueue(pool);await queue.initialize();const worker='browser-'+randomUUID();await queue.workerHeartbeat(worker);heartbeat=setInterval(()=>queue.workerHeartbeat(worker).catch(()=>{}),10000);
 const app=express();app.use(require('../dist/app').default); // API includes terminal 404, so static routes need a parent before it.
 const host=express();host.use('/api',(req,res,next)=>{req.url='/api'+req.url;app(req,res,next);});
 host.use(express.static('/tmp/buildx-release-ui'));host.get('*',(_req,res)=>res.sendFile('/tmp/buildx-release-ui/index.html'));
 server=host.listen(5193,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const details={url:'http://127.0.0.1:5193',email,password,workspace:id};fs.writeFileSync('/tmp/buildx-browser-fixture.json',JSON.stringify(details));console.log(JSON.stringify(details));
 while(!shutdown.signal.aborted){await workOnce(queue,{chat:queuedWorkspaceHandler,repair:queuedWorkspaceHandler,codegen:queuedWorkspaceHandler},shutdown.signal);await new Promise(resolve=>setTimeout(resolve,150));}
})().catch(error=>{if(!shutdown.signal.aborted){console.error(error);process.exitCode=1;}}).finally(async()=>{clearInterval(heartbeat);if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(pool)await pool.end();});
process.on('SIGINT',()=>shutdown.abort());process.on('SIGTERM',()=>shutdown.abort());
