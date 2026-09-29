// Opt-in model screening. Defaults to listing tasks, without credentials or calls.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const tasks = [...require('./tasks.cjs'),...require('./integration-tasks.cjs'),...require('./application-tasks.cjs')];
const {parseOptions,reserveCost}=require('./options.cjs');
const options=parseOptions(process.argv.slice(2));
const eligible=tasks.filter(task=>(options.suite==='all'||(options.suite==='screening'?!['integration','application'].includes(task.category):task.category===options.suite))&&(options.split==='all'||(task.split||'development')===options.split));
const selected=eligible.slice(0,options.limit);
const taskManifest=selected.map(({id,category,split})=>({id,category,split:split||'development'}));
const taskCatalogRevision=createHash('sha256').update(JSON.stringify(selected.map(({id,prompt,files,acceptance})=>({id,prompt,files,acceptance})))).digest('hex');
if (!options.live) {
  console.log(JSON.stringify({ mode:'catalog-only', model:options.model, reviewModel:options.reviewModel||'default', skills:options.skills, repeat:options.repeat, suite:options.suite,split:options.split,limit:options.limit,totalCatalog:tasks.length,taskCatalogRevision,selectedTaskIds:taskManifest.map(task=>task.id),tasks:eligible.map(({id,category,split})=>({id,category,split:split||'development'})), note:'No quality results or model calls. Live runs require verified prices and explicit spending policy.' },null,2));
  process.exit(0);
}
const prices = JSON.parse(fs.readFileSync(options.prices));
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
const {getLLMProvider}=require('../dist/lib/llm/router');
const {runEngineeringAgent}=require('../dist/lib/agent/engine');
const {runSandboxCheck}=require('../dist/lib/agent/sandbox');
const {revision}=require('../dist/lib/agent/validation');
const {createFixtureCheck}=require('./fixture-check.cjs');
let reserved=0;
if(!selected.length)throw new Error("No tasks match the requested suite/split");
const {SKILL_REGISTRY_REVISION}=require('../dist/lib/agent/skills');
function summarizeModelAttempts(results){
 const attempts=results.flatMap(result=>result.trace.filter(item=>item.event==='agent_model_attempt'));
 const byRoleModel=new Map();
 for(const attempt of attempts){
  const key=`${attempt.stage}:${attempt.modelUsed}`;
  const entry=byRoleModel.get(key)||{stage:attempt.stage,model:attempt.modelUsed,attempts:0,succeeded:0,timeouts:0,rateLimited:0,cancelled:0,failed:0,fallbackAttempts:0,totalTokens:0,elapsedMs:0};
  entry.attempts++;
  if(attempt.outcome==='succeeded')entry.succeeded++;
  else if(attempt.outcome==='timeout')entry.timeouts++;
  else if(attempt.outcome==='rate_limited')entry.rateLimited++;
  else if(attempt.outcome==='cancelled')entry.cancelled++;
  else entry.failed++;
  if(attempt.fallback)entry.fallbackAttempts++;
  entry.totalTokens+=attempt.totalTokens||0;
  entry.elapsedMs+=attempt.executionTimeMs||0;
  byRoleModel.set(key,entry);
 }
 return {attempts:attempts.length,runsWithFallback:results.filter(result=>result.trace.some(item=>item.event==='agent_model_attempt'&&item.fallback)).length,byRoleModel:[...byRoleModel.values()]};
}
(async()=>{
 const results=[];
 for(let attempt=1;attempt<=options.repeat;attempt++) for(const task of selected){
  const began=Date.now();let calls=0;let tokens=0;let usageReports=0;const trace=[];
  try{
   const signal=AbortSignal.timeout(8*60_000);
   const call=async(model,messages,tools,signal)=>{
    reserved=reserveCost(prices,model,messages,tools,reserved,options);calls++;
    trace.push({event:'provider_call',model,inputMessages:messages.length,inputBytes:Buffer.byteLength(JSON.stringify(messages))});
    const turn=await getLLMProvider(model).turn(messages,{tools,maxTokens:6000,signal});
    if(Number.isFinite(turn.usage?.total_tokens)){tokens+=turn.usage.total_tokens;usageReports++;}
    return turn;
   };
   const result=await runEngineeringAgent(task.prompt,Object.entries(task.files).map(([path,content])=>({path,content})),{
    model:options.model,reviewModel:options.reviewModel,skillMode:options.skills,signal,call,
    fallbackModel:options.freeOnly && !(prices['gemini-3.5-flash']?.input===0 && prices['gemini-3.5-flash']?.output===0) ? null : undefined,
    protectedPaths:['package.json','acceptance.test.mjs'],
    check:createFixtureCheck(runSandboxCheck,revision,task.acceptance,signal),
  },(event,data)=>{
    if(event==='agent_model_attempt')trace.push({event,...data});
    if(event==='agent_skills')trace.push({event,...data});
    if(event==='tool_result')trace.push({event,tool:data.tool,failed:!!data.result?.error,...(data.result?.error?{error:String(data.result.error).slice(0,500)}:{})});
    if(event==='validation')trace.push({event,status:data.status,revision:data.revision,kind:data.kind,output:String(data.output||'').slice(-1200)});
    if(event==='context_compacted')trace.push({event,outputs:data.outputs,beforeBytes:data.beforeBytes,afterBytes:data.afterBytes});
    if(event==='budget_guidance')trace.push({event,calls:data.calls,tokens:data.tokens,revision:data.revision});
    if(event==='progress_guidance')trace.push({event,calls:data.calls,tokens:data.tokens});
   });
   const finalFiles={...task.files};
   for(const file of result.modifiedFiles)finalFiles[file.path]=file.content;
   const acceptance=await runSandboxCheck({...finalFiles,'acceptance.test.mjs':task.acceptance},'test','.',signal);
   results.push({id:task.id,attempt,passed:result.checksPassed && acceptance.status==='passed',acceptance,trace,checks:result.checks,review:result.review,calls,tokens,usageReports,ms:Date.now()-began});
  }catch(error){results.push({id:task.id,attempt,trace,passed:false,error:error.message,calls,tokens,usageReports,ms:Date.now()-began});}
 }
 const report={timestamp:new Date().toISOString(),skills:options.skills,skillRegistry:SKILL_REGISTRY_REVISION,model:options.model,reviewModel:options.reviewModel||'default',suite:options.suite,split:options.split,repeat:options.repeat,taskCatalogRevision,taskManifest,reservedUsdUpperBound:reserved,modelAttempts:summarizeModelAttempts(results),results,note:'Synthetic screening, not frontier parity or production certification.'};
 if(options.output){fs.writeFileSync(options.output,JSON.stringify(report,null,2));console.log(JSON.stringify({saved:options.output,runs:results.length,passed:results.filter(result=>result.passed).length}));}
 else console.log(JSON.stringify(report,null,2));
 if(results.some(result=>!result.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
