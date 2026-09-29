import test from 'node:test';
import assert from 'node:assert/strict';
import {addCriteria,evidenceReport,findRelevantFiles} from '../lib/agent/evidence';
const criterion={id:'ownership',description:'Reject edits from another user',project:'backend',kind:'test' as const};
test('criteria cannot be replaced, weakened or duplicated',()=>{
 const criteria=addCriteria([], [criterion]);assert.equal(addCriteria(criteria,[criterion]).length,1);
 assert.throws(()=>addCriteria(criteria,[{...criterion,kind:'build'}]),/weakened/);
 assert.throws(()=>addCriteria([], [{...criterion,project:'../escape'}]));
});
test('acceptance evidence rejects stale, wrong-project and wrong-kind checks',()=>{
 const checks=[{kind:'test' as const,project:'backend',revision:'old',status:'passed' as const,output:'ok'}, {kind:'build' as const,project:'backend',revision:'new',status:'passed' as const,output:'ok'}];
 assert.equal(evidenceReport([criterion],checks,'new')[0].status,'missing');
 checks.push({kind:'test',project:'backend',revision:'new',status:'passed',output:'ok'});
 assert.equal(evidenceReport([criterion],checks,'new')[0].status,'passed');
 assert.equal(evidenceReport([criterion],[...checks,{kind:'test',project:'backend',revision:'new',status:'failed',output:'regression'}],'new')[0].status,'failed');
});
test('retrieval ranks relevant paths, bounds output, and excludes secret files',()=>{
 const files=Object.fromEntries(Array.from({length:40},(_,i)=>[`file${i}.ts`,'login']));
 const results=findRelevantFiles({...files,'auth/login.ts':'login','backend/.env':'login SECRET'},'login');
 assert.equal(results[0].path,'auth/login.ts');assert.equal(results.length,20);assert.ok(!results.some(item=>item.path.endsWith('.env')));
});

import { compactRepositoryContext } from '../lib/agent/context';
import type { LLMMessage } from '../lib/llm/types';
test('context eviction preserves tool IDs, assistant envelopes and recent reads',()=>{
 const assistant:LLMMessage={role:'assistant',content:null,tool_calls:[{id:'read-1',type:'function',function:{name:'read_file',arguments:'{"path":"main.ts"}'}}]};
 const messages:LLMMessage[]=[assistant,{role:'tool',tool_call_id:'read-1',content:'x'.repeat(2000)},...Array.from({length:12},()=>({role:'user' as const,content:'recent'}))];
 const result=compactRepositoryContext(messages,1800);
 assert.equal(result.compacted,1);assert.equal(result.messages[0],assistant);
 assert.equal(result.messages[1].tool_call_id,'read-1');assert.match(String(result.messages[1].content),/Re-run/);
 assert.equal(messages[1].content?.length,2000);
 assert.equal(compactRepositoryContext(messages.slice(0,2),1800).compacted,0);
});

import { runEngineeringAgent } from '../lib/agent/engine';
import { revision } from '../lib/agent/validation';
import type { ModelTurn } from '../lib/llm/types';
const action=(name:string,args:unknown):ModelTurn=>{const calls=[{id:name,type:'function' as const,function:{name,arguments:JSON.stringify(args)}}];return {message:{role:'assistant',content:null,tool_calls:calls},text:'',toolCalls:calls,finishReason:'tool_calls'};};
for(const declare of [false,true])test(`finish rejects ${declare?'wrong check kind':'undeclared criteria'} before review`,async()=>{
 const queue=[...(declare?[action('define_acceptance',{criteria:[{...criterion,project:'.'}]})]:[]),action('read_file',{path:'main.ts'}),action('apply_patch',{path:'main.ts',before:'=1',after:'=2'}),action('run_check',{kind:'build',project:'.'})];
 let reviews=0;const errors:string[]=[];
 await assert.rejects(runEngineeringAgent('Repair ownership',[{path:'main.ts',content:'export const n=1;'}],{
  signal:new AbortController().signal,
  call:async(model)=>{if(model==='gemini-3.5-flash')reviews++;return queue.shift()||action('finish',{summary:'done'});},
  check:async(files,kind)=>({kind,revision:revision(files),status:'passed',output:'compiled'}),
 },(event,data)=>{if(event==='tool_result'&&data.result.error)errors.push(data.result.error);}),/three identical failures/);
 assert.equal(reviews,0);
 assert.ok(errors.some(error=>/acceptance criteria/.test(error)));
});
