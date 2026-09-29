import test from 'node:test';
import assert from 'node:assert/strict';
import { agentRouting, independentReviewModels, prototypeModelsEnabled } from '../lib/llm/specialists';
import { verifyFreeOpenRouter } from '../lib/llm/freeEligibility';
import { ProviderCapacityError } from '../lib/llm/providerFailure';
import { OpenRouterProvider } from '../lib/llm/openrouter';
import { NvidiaProvider } from '../lib/llm/nvidia';

const model = 'cohere/north-mini-code:free';
const tools = [{type:'function' as const,function:{name:'read_file',description:'Read',parameters:{type:'object'}}}];
function fixture(pricing: Record<string, unknown> = {prompt:'0',completion:'0'}, remaining = 5, parameters = ['tools','response_format']) {
  let calls = 0;
  const request = (async () => new Response(JSON.stringify(++calls === 1
    ? {data:[{id:model,pricing,supported_parameters:parameters}]}
    : {data:{free_model_daily_requests:{remaining}}}))) as typeof fetch;
  return {request, count:()=>calls};
}

test('specialists are opt-in, task-specific, and preserve explicit model selection', () => {
  const env = {AGENT_MODEL_PROFILE:'free-specialists'};
  assert.equal(agentRouting('edit',1,undefined,{}).author,'gemini-3.8-flash');
  assert.equal(agentRouting('edit',1,undefined,env).author,'north-mini-code-free');
  assert.equal(agentRouting('edit',4,undefined,env).author,'laguna-s-free');
  assert.equal(agentRouting('codegen',0,undefined,env).author,'laguna-s-free');
  assert.equal(agentRouting('blueprint',0,undefined,env).author,'gemini-3.8-flash');
  assert.equal(agentRouting('edit',1,'gemini-3.5-flash',env).author,'gemini-3.5-flash');
  assert.equal(agentRouting('blueprint',0,undefined,{...env,AGENT_ALLOW_PROTOTYPE_MODELS:'true'}).author,'nemotron-super-free');
});

test('production cannot opt into prototype models and review excludes the current author', () => {
  const env = {NODE_ENV:'production',AGENT_MODEL_PROFILE:'free-specialists',AGENT_ALLOW_PROTOTYPE_MODELS:'true'};
  assert.equal(prototypeModelsEnabled(env),false);
  const route = agentRouting('edit',1,undefined,env);
  for(const author of [route.author,route.fallback]) {
    const reviewers = independentReviewModels(route,author);
    assert.ok(reviewers.length);
    assert.ok(!reviewers.includes(author));
    assert.throws(()=>independentReviewModels(route,author,author),/different/);
  }
  assert.equal(agentRouting('blueprint',0,undefined,env).author,'gemini-3.8-flash');
  const exhausted=independentReviewModels(route,'gemini-3.5-flash',undefined,['gemini-3.8-flash']);
  assert.ok(!exhausted.includes('gemini-3.8-flash'));
  assert.ok(exhausted.includes('gpt-oss-120b'));
});

test('free eligibility requires current zero prices, capabilities and remaining quota', async () => {
  const valid=fixture();
  await verifyFreeOpenRouter(model,'synthetic',{tools,responseFormat:{type:'json_object'}},valid.request);
  assert.equal(valid.count(),2);
  for(const pricing of [{prompt:'0.001',completion:'0'}, {prompt:'0',completion:'0',request:'0.01'}, {prompt:'0',completion:''}, {prompt:'0'}]) {
    const invalid=fixture(pricing);
    await assert.rejects(verifyFreeOpenRouter(model,'synthetic',{},invalid.request),/zero-priced/);
    assert.equal(invalid.count(),1);
  }
  await assert.rejects(verifyFreeOpenRouter(model,'synthetic',{},fixture(undefined,0).request),ProviderCapacityError);
  await assert.rejects(verifyFreeOpenRouter(model,'synthetic',{tools},fixture(undefined,5,[]).request),/tool support/);
  await assert.rejects(verifyFreeOpenRouter(model,'synthetic',{responseFormat:{type:'json_object'}},fixture(undefined,5,['tools']).request),/JSON/);
  const paid=fixture();
  await assert.rejects(verifyFreeOpenRouter('cohere/north-mini-code','synthetic',{},paid.request),/:free/);
  assert.equal(paid.count(),0);
  await assert.rejects(verifyFreeOpenRouter('unknown/model:free','synthetic',{},fixture().request),/absent/);
});

test('eligibility network failure is recoverable but user cancellation stays cancelled', async () => {
  const request=(async()=>{throw new TypeError('fetch failed');}) as typeof fetch;
  await assert.rejects(verifyFreeOpenRouter(model,'synthetic',{},request),ProviderCapacityError);
  const controller=new AbortController();controller.abort(new Error('User cancelled'));
  await assert.rejects(verifyFreeOpenRouter(model,'synthetic',{signal:controller.signal},request),/User cancelled/);
});

test('OpenRouter payload has zero-price provider constraints and no hidden retry', () => {
  class Inspect extends OpenRouterProvider {
    config() {return {payload:this.payload([{role:'user',content:'Inspect'}],{tools}),retry:this.retryRequests};}
  }
  const config=new Inspect(model).config();
  assert.deepEqual(config.payload.provider,{require_parameters:true,max_price:{prompt:0,completion:0}});
  assert.equal(config.retry,false);
});

test('production rejects prototype completion and streaming before constructing a client', async () => {
  const oldNode=process.env.NODE_ENV;const oldOpt=process.env.AGENT_ALLOW_PROTOTYPE_MODELS;
  process.env.NODE_ENV='production';process.env.AGENT_ALLOW_PROTOTYPE_MODELS='true';
  try {
    for(const provider of [new NvidiaProvider('nvidia/test'),new OpenRouterProvider('nvidia/test:free')]) {
      await assert.rejects(provider.turn([{role:'user',content:'Synthetic'}]),/prototype opt-in/);
      await assert.rejects(async()=>{for await(const chunk of provider.stream([{role:'user',content:'Synthetic'}]))assert.fail(chunk);},/prototype opt-in/);
    }
  } finally {
    if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;
    if(oldOpt===undefined)delete process.env.AGENT_ALLOW_PROTOTYPE_MODELS;else process.env.AGENT_ALLOW_PROTOTYPE_MODELS=oldOpt;
  }
});
