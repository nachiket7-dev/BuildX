// Only the NVIDIA-hosted free prototype endpoint. Never invokes paid fallback models.
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env'),quiet:true});
const assert=require('node:assert/strict');
const {getLLMProvider}=require('../dist/lib/llm/router');
const {runEngineeringAgent}=require('../dist/lib/agent/engine');
const tool=(name,args)=>{const calls=[{id:name,type:'function',function:{name,arguments:JSON.stringify(args)}}];return {message:{role:'assistant',content:null,tool_calls:calls},toolCalls:calls,text:'',finishReason:'tool_calls'};};
(async()=>{
 let advice;let liveCalls=0;const started=Date.now();
 const queue=[tool('read_file',{path:'tasks.ts'}),tool('consult_architect',{question:'For a multi-user task API, how should updates prevent users editing each other’s tasks? Give a concise implementation and test recommendation.'}),tool('report_blocker',{reason:'Synthetic consultation probe finished'})];
 try {
 await runEngineeringAgent('Review owner isolation',[{path:'tasks.ts',content:'export async function updateTask(db, id, input) { return db.update({ id }, input); }'}],{
 signal:AbortSignal.timeout(100000),call:async(model,messages,tools,signal)=>{
  if(model==='nemotron-3-550b'){
   assert.equal(tools,undefined);liveCalls++;
   if(liveCalls>1)throw new Error('Live call cap reached');
   return getLLMProvider(model).turn(messages,{maxTokens:4096,signal});
  }
  // The main author is scripted; it cannot call a billable provider.
  return queue.shift() || tool('report_blocker',{reason:'Probe finished'});
 }},(event,data)=>{if(event==='tool_result' && (data.result.advice || data.result.error))advice=data.result;});
 } catch(error) {if(!/Synthetic consultation probe finished/.test(error.message))throw error;}
 assert.equal(liveCalls,1);
 assert.ok(advice && !advice.error,JSON.stringify(advice));
 assert.match(JSON.stringify(advice),/owner|user|tenant/i);
 const result={model:'nemotron-3-550b',passed:true,liveCalls,ms:Date.now()-started,advice,note:'Real free NVIDIA consultation; scripted author. Not a complete model quality benchmark.'};
 require('node:fs').writeFileSync(require('node:path').resolve(__dirname,'../../audit/backend-2026-09-21/nemotron-live.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(JSON.stringify({passed:false,error:error.message}));process.exitCode=1;});
