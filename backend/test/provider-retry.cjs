const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isTransientProviderFailure,withProviderRetry,retryAfterMs,queueRetryDelayMs,ProviderCapacityError}=require('../dist/lib/llm/providerFailure');
const {completeWithPipelineFallback,markModelCooldown,resetAllCooldowns}=require('../dist/lib/llm/router');

test('retries a brief provider outage without changing the request',async()=>{
 let calls=0;
 const result=await withProviderRetry(async()=>{
  calls++;
  if(calls===1)throw Object.assign(new Error('Unavailable'),{status:503});
  return 'ok';
 });
 assert.equal(result,'ok');assert.equal(calls,2);
});

test('does not retry invalid or unauthorised requests',async()=>{
 for(const status of [400,401,402,403,404]){
  let calls=0;
  await assert.rejects(withProviderRetry(async()=>{calls++;throw Object.assign(new Error('Rejected'),{status});}));
  assert.equal(calls,1);
  assert.equal(isTransientProviderFailure({status}),false);
 }
});

test('yields a long rate limit to the durable queue',async()=>{
 let calls=0;
 const error=Object.assign(new Error('Rate limited'),{status:429,headers:new Headers({'retry-after':'30'})});
 await assert.rejects(withProviderRetry(async()=>{calls++;throw error;}),/Rate limited/);
 assert.equal(calls,1);
 assert.equal(retryAfterMs(error),30_000);
 assert.equal(queueRetryDelayMs(error,1),30_000);
 assert.equal(isTransientProviderFailure(new ProviderCapacityError()),true);
});

test('aborts a pending retry before another provider call',async()=>{
 const controller=new AbortController();let calls=0;
 const pending=withProviderRetry(async()=>{calls++;throw Object.assign(new Error('Unavailable'),{status:503});},controller.signal);
 setTimeout(()=>controller.abort(new Error('Stopped')),10);
 await assert.rejects(pending,/Stopped/);
 assert.equal(calls,1);
});

test('all-rate-limited stage preserves a capacity error for the durable worker',async()=>{
 let calls=0;
 try{
  await assert.rejects(completeWithPipelineFallback('CODE_GENERATION',[{role:'user',content:'synthetic'}],undefined,undefined,()=>({complete:async()=>{
   calls++;throw Object.assign(new Error('Rate limited'),{status:429,headers:new Headers({'retry-after':'45'})});
  }})),error=>error instanceof ProviderCapacityError && error.retryAfterMs>=44_000 && error.retryAfterMs<=45_000);
  assert.equal(calls,2);
 }finally{await resetAllCooldowns();}
});

test('all-cooling stage remains schedulable rather than failing generically',async()=>{
 let calls=0;
 await markModelCooldown('gemini-3.8-flash',20_000);
 await markModelCooldown('gemini-3.5-flash',20_000);
 try{
  await assert.rejects(completeWithPipelineFallback('CODE_GENERATION',[{role:'user',content:'synthetic'}],undefined,undefined,()=>({complete:async()=>{calls++;return 'unexpected';}})),
   error=>error instanceof ProviderCapacityError && error.retryAfterMs>0);
  assert.equal(calls,0);
 }finally{await resetAllCooldowns();}
});
