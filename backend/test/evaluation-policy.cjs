const test=require('node:test');const assert=require('node:assert/strict');
const {parseOptions,reserveCost}=require('../evaluation/options.cjs');
const {createFixtureCheck}=require('../evaluation/fixture-check.cjs');
test('evaluation rejects invalid flags and unbounded spend settings',()=>{
 for(const args of [['--unknown'],['--limit','NaN'],['--repeat','0'],['--skills','anything'],['--suite','unknown'],['--max-usd','Infinity'],['--live'],['--prices','--live']])assert.throws(()=>parseOptions(args));
 assert.equal(parseOptions([]).live,false);
 assert.equal(parseOptions(['--suite','application']).suite,'application');
 assert.equal(parseOptions(['--output','/tmp/buildx-eval.json']).output,'/tmp/buildx-eval.json');
});
test('free-only and spending limits fail before a provider can be called',()=>{
 const options=parseOptions(['--live','--free-only','--prices','prices.json']);
 assert.throws(()=>reserveCost({paid:{input:1,output:1}},'paid',[],[],0,options),/Free-only/);
 assert.throws(()=>reserveCost({},'unknown',[],[],0,options),/missing/);
 assert.equal(reserveCost({free:{input:0,output:0}},'free',[],[],0,options),0);
 assert.throws(()=>reserveCost({paid:{input:1,output:1}},'paid',[],[],0,{freeOnly:false,ceiling:0.001}),/ceiling/);
});
test('fixture checks do not relabel tests as build or typecheck',async()=>{
 const calls=[];
 const check=createFixtureCheck(async(files,kind,project)=>{
  calls.push({files,kind,project});
  return {kind,status:'passed',output:'test passed',revision:'including-acceptance'};
 },files=>Object.keys(files).join(','),'hidden acceptance',new AbortController().signal);
 const files={'source.mjs':'export const ok=true;'};
 for(const kind of ['build','typecheck']){
  const result=await check(files,kind);
  assert.equal(result.status,'unavailable');
  assert.equal(result.kind,kind);
 }
 assert.equal(calls.length,0);
 const result=await check(files,'test');
 assert.equal(result.status,'passed');
 assert.equal(result.revision,'source.mjs');
 assert.deepEqual(calls,[{files:{...files,'acceptance.test.mjs':'hidden acceptance'},kind:'test',project:'.'}]);
});
