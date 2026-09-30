import test from 'node:test';
import assert from 'node:assert/strict';
import { runEngineeringAgent } from '../lib/agent/engine';
import { isWorkspacePath, revision, validateFile } from '../lib/agent/validation';
import { ModelTurn } from '../lib/llm/types';
import { DEFAULT_MODEL_KEY, MODEL_MAP, PIPELINE_ROUTES, resolveModelKey } from '../lib/llm/router';
import { ChatProvider } from '../lib/llm/chatProvider';
import { runSandboxCheck } from '../lib/agent/sandbox';

const tool = (name: string, args: unknown): ModelTurn => {
  const calls = [{ id: 'tool-' + name, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } }];
  return { message: { role: 'assistant', content: null, tool_calls: calls }, text: '', toolCalls: calls, finishReason: 'tool_calls' };
};
const text = (value: string): ModelTurn => ({ message: { role: 'assistant', content: value }, text: value, toolCalls: [], finishReason: 'stop' });
const source = 'export const count = 1;';
const actions = () => [tool('define_acceptance', {criteria:[{id:'build',description:'Changed source builds successfully',project:'.',kind:'build'}]}), tool('read_file', { path: 'main.ts' }), tool('apply_patch', { path: 'main.ts', before: 'count = 1', after: 'count = 2' }), tool('run_check', { kind: 'build', project: '.' }), tool('finish', { summary: 'Changed value' })];

test('source validator rejects invalid TSX/JSON and path traversal', () => {
  assert.ok(validateFile('main.ts', 'export const count = ;').length);
  assert.ok(validateFile('main.tsx', 'export default () => <div>').length);
  assert.ok(validateFile('package.json', 'export const invalid = 1').length);
  assert.deepEqual(validateFile('main.ts', source), []);
  for (const path of ['', '/a', '../a', 'a/../b', '..\\a', 'C:/file', 'a\0b']) assert.equal(isWorkspacePath(path), false);
});

test('excluded models cannot be selected or reached through routing', () => {
  for (const model of ['qwen-3-32b', 'groq:qwen/qwen3.6-27b', 'gemini-3.1-pro', 'gemini:gemini-3.1-pro-preview']) assert.throws(() => resolveModelKey(model));
  assert.ok(!Object.keys(MODEL_MAP).some(key => /qwen|gemini.*pro/.test(key)));
  assert.ok(!JSON.stringify(PIPELINE_ROUTES).match(/qwen|gemini.*pro|kimi|gpt-oss/));
  assert.equal(DEFAULT_MODEL_KEY, 'gemini-3.8-flash');
  assert.ok(Object.values(PIPELINE_ROUTES).every(route => [route.primary, route.fallback, route.emergency]
    .filter(Boolean).every(model => model === 'gemini-3.8-flash' || model === 'gemini-3.5-flash')));
});

test('agent reviews in a fresh context and only stages source after checks', async () => {
  const queue = actions(); const events: string[] = []; const authors: string[] = [];
  const initial = [{ path: 'main.ts', content: source }];
  const result = await runEngineeringAgent('Change count to 2', initial, {
    signal: new AbortController().signal,
    check: async (files, kind) => ({ kind, revision: revision(files), status: 'passed', output: 'build passed' }),
    call: async (model, messages) => {
      authors.push(model);
      if (model === 'gemini-3.5-flash') {
        assert.ok(!messages.some(m => m.tool_calls?.some(t => t.function.name === 'finish')));
        return text('{"findings":[],"limitations":[]}');
      }
      return queue.shift()!;
    },
  }, event => events.push(event));
  assert.equal(initial[0].content, source);
  assert.equal(result.stagedDiffs['main.ts'].modified, 'export const count = 2;');
  assert.equal(result.checksPassed, true);
  assert.deepEqual(authors, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.5-flash']);
  assert.equal(events.includes('staged_diff'), false); // Only route stages after revision checks.
  assert.equal(result.modelAttempts.length, 6);
  assert.ok(result.modelAttempts.every(attempt => attempt.outcome === 'succeeded' && !attempt.fallback));
});

test('evaluation can select a distinct reviewer without changing the runtime default', async () => {
  const queue = actions();
  const models: string[] = [];
  const result = await runEngineeringAgent('Change count to 2', [{ path: 'main.ts', content: source }], {
    model: 'nemotron-3-super-120b', reviewModel: 'nemotron-3-550b',
    signal: new AbortController().signal,
    check: async (files, kind) => ({ kind, revision: revision(files), status: 'passed', output: 'build passed' }),
    call: async model => {
      models.push(model);
      return model === 'nemotron-3-550b'
        ? text('{"findings":[],"limitations":[]}') : queue.shift()!;
    },
  }, () => {});
  assert.equal(result.checksPassed, true);
  assert.equal(models.at(-1), 'nemotron-3-550b');
  assert.ok(models.slice(0,-1).every(model => model === 'nemotron-3-super-120b'));
});

test('agent records primary timeout, fallback continuation and independent review', async () => {
  const queue = actions();
  const attempts: Array<{ stage: string; modelUsed: string; outcome: string; fallback: boolean }> = [];
  let primaryFailed = false;
  let timeoutCheckpoint: unknown;
  const result = await runEngineeringAgent('Change count to 2', [{ path: 'main.ts', content: source }], {
    signal: new AbortController().signal,
    checkpoint: async state => { if (state.modelAttempts?.at(-1)?.outcome === 'timeout') timeoutCheckpoint = structuredClone(state.modelAttempts); },
    check: async (files, kind) => ({ kind, revision: revision(files), status: 'passed', output: 'build passed' }),
    call: async (model, messages) => {
      if (model === 'gemini-3.8-flash' && messages[0]?.content?.includes('Independently review'))
        return text('{"findings":[],"limitations":[]}');
      if (model === 'gemini-3.8-flash' && !primaryFailed) {
        primaryFailed = true;
        throw new Error('Request timed out');
      }
      assert.equal(model, 'gemini-3.5-flash');
      return queue.shift()!;
    },
  }, (event, data) => { if (event === 'agent_model_attempt') attempts.push(data); });
  assert.equal(result.checksPassed, true);
  assert.ok(timeoutCheckpoint);
  assert.deepEqual(attempts.slice(0, 2).map(({modelUsed, outcome, fallback}) => ({modelUsed, outcome, fallback})), [
    {modelUsed: 'gemini-3.8-flash', outcome: 'timeout', fallback: false},
    {modelUsed: 'gemini-3.5-flash', outcome: 'succeeded', fallback: true},
  ]);
  assert.equal(attempts.at(-1)?.stage, 'INDEPENDENT_REVIEW');
  assert.equal(attempts.at(-1)?.modelUsed, 'gemini-3.8-flash');
  assert.ok(attempts.filter(attempt => attempt.stage === 'IMPLEMENTATION' && attempt.modelUsed === 'gemini-3.5-flash').every(attempt => attempt.fallback));
  assert.deepEqual(result.modelAttempts, attempts);
});

test('provider failover starts a fresh transcript while preserving staged workspace state', async () => {
  const queue = actions();
  let primaryCalls = 0;
  let sawFreshHandoff = false;
  const result = await runEngineeringAgent('Change count to 2', [{ path: 'main.ts', content: source }], {
    model: 'gpt-oss-120b',
    signal: new AbortController().signal,
    check: async (files, kind) => ({ kind, revision: revision(files), status: 'passed', output: 'build passed' }),
    call: async (model, messages) => {
      if (model === 'gpt-oss-120b') {
        primaryCalls++;
        if (primaryCalls === 1) return tool('read_file', { path: 'main.ts' });
        throw Object.assign(new Error('rate limit exceeded'), { status: 429 });
      }
      if (messages[0]?.content?.includes('Independently review'))
        return text('{"findings":[],"limitations":[]}');
      if (!sawFreshHandoff) {
        sawFreshHandoff = true;
        assert.equal(model, 'gemini-3.8-flash');
        assert.equal(messages.length, 2);
        assert.equal(messages[1].role, 'user');
        assert.match(messages[1].content || '', /Continue the BuildX task/);
        assert.ok(!messages.some(message => message.role === 'tool' || message.tool_calls?.length));
      }
      return queue.shift()!;
    },
  }, () => {});
  assert.equal(primaryCalls, 2);
  assert.equal(sawFreshHandoff, true);
  assert.equal(result.stagedDiffs['main.ts'].modified, 'export const count = 2;');
  assert.equal(result.checksPassed, true);
});

test('agent does not bounce repeatedly between rate-limited free models', async () => {
  const models: string[] = [];
  await assert.rejects(runEngineeringAgent('Change count to 2', [{ path: 'main.ts', content: source }], {
    signal: new AbortController().signal,
    call: async model => {
      models.push(model);
      throw Object.assign(new Error('Provider temporarily unavailable'), { status: 503 });
    },
  }, () => {}), /temporarily unavailable/);
  assert.deepEqual(models, ['gemini-3.8-flash', 'gemini-3.5-flash']);
});

test('reviewer outage switches to an independent fresh review context', async () => {
  const queue=actions();let failed=false;
  const result=await runEngineeringAgent('Change count to 2',[{path:'main.ts',content:source}],{
    model:'north-mini-code-free',signal:new AbortController().signal,
    check:async(files,kind)=>({kind,revision:revision(files),status:'passed',output:'build passed'}),
    call:async(model,messages)=>{
      if(model==='north-mini-code-free')return queue.shift()!;
      if(model==='gemini-3.8-flash'){failed=true;throw Object.assign(new Error('Unavailable'),{status:503});}
      assert.equal(model,'gemini-3.5-flash');assert.equal(messages.length,2);
      assert.ok(!messages.some(message=>message.role==='tool'));
      return text('{"findings":[],"limitations":[]}');
    },
  },()=>{});
  assert.equal(failed,true);assert.equal(result.checksPassed,true);
  assert.ok(result.modelAttempts.some(attempt=>attempt.stage==='INDEPENDENT_REVIEW'&&attempt.fallback));
});

test('resumed specialist budget prevents dispatch and is persisted before a failed call', async () => {
  let calls=0;let snapshot:any;
  const resume={original:{'main.ts':source},files:{'main.ts':source},messages:[{role:'user' as const,content:'Inspect'}],
    plan:[],checks:[],calls:5,tokens:0,repairs:0,model:'north-mini-code-free',readPaths:[],specialistCalls:5};
  await assert.rejects(runEngineeringAgent('Inspect',[{path:'main.ts',content:source}],{
    model:'north-mini-code-free',fallbackModel:null,resume,signal:new AbortController().signal,
    checkpoint:async state=>{snapshot=structuredClone(state);},
    call:async()=>{calls++;assert.equal(snapshot.specialistCalls,6);throw new Error('Request timed out');},
  },()=>{}),/timed out/);
  await assert.rejects(runEngineeringAgent('Inspect',[{path:'main.ts',content:source}],{
    model:'north-mini-code-free',fallbackModel:null,resume:snapshot,signal:new AbortController().signal,
    call:async()=>{calls++;return text('Unexpected');},
  },()=>{}),/specialist request budget/);
  assert.equal(calls,1);
});

test('failed model attempts consume the call budget before fallback', async () => {
  let providerCalls = 0;
  let checkpointCalls = 0;
  await assert.rejects(runEngineeringAgent('Change count to 2', [{ path: 'main.ts', content: source }], {
    signal: new AbortController().signal,
    resume: {
      original: { 'main.ts': source }, files: { 'main.ts': source },
      messages: [{ role: 'user', content: 'Change count to 2' }],
      plan: [], checks: [], calls: 23, tokens: 0, repairs: 0,
      model: 'glm-5.2', readPaths: [],
    },
    checkpoint: async state => { checkpointCalls = state.calls; },
    call: async () => { providerCalls++; throw new Error('Request timed out'); },
  }, () => {}), /Agent call budget exhausted/);
  assert.equal(providerCalls, 1);
  assert.equal(checkpointCalls, 24);
});

test('authentication and invalid-request failures do not trigger another provider', async () => {
  for (const status of [400, 401, 403]) {
    const used: string[] = [];
    const attempts: Array<{httpStatus?:number}> = [];
    await assert.rejects(runEngineeringAgent('Change count to 2', [{ path: 'main.ts', content: source }], {
      signal: new AbortController().signal,
      call: async model => {
        used.push(model);
        throw Object.assign(new Error(`Provider rejected request (${status})`), {status});
      },
    }, (event,data) => {if(event==='agent_model_attempt')attempts.push(data);}), new RegExp(String(status)));
    assert.deepEqual(used, ['gemini-3.8-flash']);
    assert.equal(attempts[0]?.httpStatus,status);
  }
});

test('free-only evaluation can disable an unverified fallback without changing runtime defaults', async () => {
  const used:string[]=[];
  await assert.rejects(runEngineeringAgent('Change count to 2',[{path:'main.ts',content:source}],{
    model:'nemotron-3-super-120b',fallbackModel:null,signal:new AbortController().signal,
    call:async model=>{used.push(model);throw new Error('Request timed out');},
  },()=>{}),/Request timed out/);
  assert.deepEqual(used,['nemotron-3-super-120b']);
});

test('missing sandbox is explicitly unverified, never a passed check', async () => {
  const queue = actions();
  const result = await runEngineeringAgent('Change count', [{ path: 'main.ts', content: source }], {
    signal: new AbortController().signal,
    check: async (files, kind) => ({ kind, revision: revision(files), status: 'unavailable', output: 'No sandbox' }),
    call: async model => model === 'gemini-3.5-flash' ? text('{"findings":[],"limitations":["Runtime untested"]}') : queue.shift()!,
  }, () => {});
  assert.equal(result.checksPassed, false);
  assert.match(result.message, /unavailable/);
});

test('failed validation cannot be overridden by finish or reviewer', async () => {
  const queue = actions(); let reviews = 0;
  await assert.rejects(runEngineeringAgent('Change count', [{ path: 'main.ts', content: source }], {
    signal: new AbortController().signal,
    check: async (files, kind) => ({ kind, revision: revision(files), status: 'failed', output: 'Regression' }),
    call: async model => { if (model === 'gemini-3.5-flash') reviews++; return queue.shift() || tool('finish', { summary: 'Done' }); },
  }, () => {}), /three identical failures/);
  assert.equal(reviews, 0);
});

test('malformed patch is rejected without mutating candidate files', async () => {
  const controller = new AbortController();
  const queue = [tool('read_file', { path: 'main.ts' }), tool('apply_patch', { path: 'main.ts', before: source, after: 'export const count = ;' })];
  let latest: any;
  await assert.rejects(runEngineeringAgent('Change count', [{ path: 'main.ts', content: source }], {
    signal: controller.signal,
    checkpoint: async state => { latest = structuredClone(state); if (!queue.length && state.calls === 2 && state.messages[state.messages.length - 1]?.role === 'tool') controller.abort(); },
    call: async () => queue.shift()!,
  }, () => {}));
  assert.equal(latest.files['main.ts'], source);
});

test('patch mismatch reports match count and asks for a fresh exact read', async () => {
  const controller = new AbortController();
  const queue = [tool('read_file', {path:'main.ts'}), tool('apply_patch', {path:'main.ts',before:'count = 99',after:'count = 2'})];
  let failure = '';
  await assert.rejects(runEngineeringAgent('Change count', [{path:'main.ts',content:source}], {
    signal:controller.signal,
    checkpoint:async state => { if (!queue.length && state.calls === 2 && state.messages[state.messages.length - 1]?.role === 'tool') controller.abort(); },
    call:async () => queue.shift()!,
  }, (event,data) => { if (event === 'tool_result' && data.tool === 'apply_patch') failure = data.result.error; }));
  assert.match(failure,/matched 0 occurrences; exactly one is required/);
  assert.match(failure,/Re-read main\.ts/);
});

test('small-file replacement requires a fresh file revision and still validates the candidate', async () => {
  const queue = [
    tool('define_acceptance',{criteria:[{id:'build',description:'Changed source builds',project:'.',kind:'build'}]}),
    tool('read_file',{path:'main.ts'}),
    tool('replace_file',{path:'main.ts',expectedRevision:revision({'main.ts':source}),content:'export const count = 2;'}),
    tool('run_check',{kind:'build',project:'.'}),
    tool('finish',{summary:'Changed count'}),
  ];
  let readRevision = '';
  const result = await runEngineeringAgent('Change count to 2',[{path:'main.ts',content:source}],{
    signal:new AbortController().signal,
    check:async(files,kind)=>({kind,revision:revision(files),status:'passed',output:'build passed'}),
    call:async model=>model==='gemini-3.5-flash'
      ? text('{"findings":[],"limitations":[]}') : queue.shift()!,
  },(event,data)=>{if(event==='tool_result'&&data.tool==='read_file')readRevision=data.result.fileRevision;});
  assert.equal(readRevision,revision({'main.ts':source}));
  assert.equal(result.stagedDiffs['main.ts'].modified,'export const count = 2;');
  assert.equal(result.checksPassed,true);
});

test('small-file replacement refuses stale revisions and protected files', async () => {
  for(const protectedPath of [false,true]){
    const controller=new AbortController();
    const queue=[tool('read_file',{path:'main.ts'}),tool('replace_file',{
      path:'main.ts',expectedRevision:protectedPath?revision({'main.ts':source}):'stale',content:'export const count = 2;'
    })];
    let failure='';let snapshot:any;
    await assert.rejects(runEngineeringAgent('Change count',[{path:'main.ts',content:source}],{
      signal:controller.signal,protectedPaths:protectedPath?['main.ts']:[],
      checkpoint:async state=>{snapshot=structuredClone(state);if(!queue.length && state.calls===2 && state.messages[state.messages.length-1]?.role==='tool')controller.abort();},
      call:async()=>queue.shift()!,
    },(event,data)=>{if(event==='tool_result'&&data.tool==='replace_file')failure=data.result.error;}));
    assert.match(failure,protectedPath?/read-only/:/changed since read_file/);
    assert.equal(snapshot.files['main.ts'],source);
  }
});

test('staged unverified edits trigger one budget reminder before another model call', async () => {
  const controller=new AbortController();let calls=0;let reminders=0;
  await assert.rejects(runEngineeringAgent('Change count',[{path:'main.ts',content:source}],{
    signal:controller.signal,
    call:async(_model,messages)=>{
      calls++;
      if(calls===3){
        assert.ok(messages.some(message=>String(message.content).includes('Host verification reminder')));
        controller.abort();
        throw new Error('Test stopped after reminder');
      }
      const turn=calls===1?tool('read_file',{path:'main.ts'}):tool('apply_patch',{path:'main.ts',before:'count = 1',after:'count = 2'});
      if(calls===2)turn.usage={total_tokens:37000};
      return turn;
    },
  },event=>{if(event==='budget_guidance')reminders++;}));
  assert.equal(reminders,1);
  assert.equal(calls,3);
});

test('small untouched workspace gets one progress reminder after four calls', async () => {
  const controller=new AbortController();let reminders=0;let calls=0;
  await assert.rejects(runEngineeringAgent('Change count',[{path:'main.ts',content:source}],{
    signal:controller.signal,
    resume:{original:{'main.ts':source},files:{'main.ts':source},messages:[{role:'user',content:'Change count'}],
      plan:[],checks:[],calls:4,tokens:25000,repairs:0,model:'gemini-3.8-flash',readPaths:[]},
    call:async(_model,messages)=>{
      calls++;
      assert.ok(messages.some(message=>String(message.content).includes('Host progress reminder')));
      controller.abort();throw new Error('Test stopped after reminder');
    },
  },event=>{if(event==='progress_guidance')reminders++;}));
  assert.equal(reminders,1);
  assert.equal(calls,1);
});

test('cancellation never falls through to another model', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(runEngineeringAgent('Change count', [{ path: 'main.ts', content: source }], {
    signal: controller.signal,
    call: async () => { calls++; controller.abort(); throw new Error('cancel'); },
  }, () => {}));
  assert.equal(calls, 1);
});

test('adapter preserves tool history and refuses truncated/reasoning-only outputs', async () => {
  process.env.AUDIT_PROVIDER_KEY = 'test';
  const provider = new ChatProvider('test', ['AUDIT_PROVIDER_KEY'], 'https://invalid.example', 1000);
  let response: any = { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, reasoning_content: 'opaque state', tool_calls: [{ id: '1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] } }] };
  (provider as any).client = { chat: { completions: { create: async () => response } } };
  const result = await provider.turn([]);
  assert.equal(result.message.reasoning_content, 'opaque state');
  assert.equal(result.toolCalls[0].id, '1');
  response = { choices: [{ finish_reason: 'length', message: { content: 'export const' } }] };
  await assert.rejects(provider.complete([]), /Incomplete/);
  response = { choices: [{ finish_reason: 'stop', message: { reasoning: 'not final source' } }] };
  await assert.rejects(provider.complete([]), /no final content/);
  delete process.env.AUDIT_PROVIDER_KEY;
});

test('unconfigured execution returns unavailable without starting a host process', async () => {
  const old = process.env.AGENT_SANDBOX_IMAGE;
  delete process.env.AGENT_SANDBOX_IMAGE;
  try { assert.equal((await runSandboxCheck({}, 'build', '.', new AbortController().signal)).status, 'unavailable'); }
  finally { if (old) process.env.AGENT_SANDBOX_IMAGE = old; }
});

test('architect consultation is bounded and never grants write authority', async () => {
  const controller = new AbortController(); let consultations = 0;
  const queue = [tool('consult_architect', { question: 'How should this be validated?' }), tool('consult_architect', { question: 'Again?' })];
  const results: any[] = [];
  await assert.rejects(runEngineeringAgent('Inspect', [{ path: 'main.ts', content: source }], {
    signal: controller.signal,
    call: async (_model, _messages, tools) => {
      if (!tools) { consultations++; assert.equal(tools, undefined); return text('Check the count.'); }
      return queue.shift()!;
    },
    checkpoint: async () => { if (!queue.length) controller.abort(); },
  }, (event, data) => { if (event === 'tool_result') results.push(data.result); }));
  assert.equal(consultations, 1);
  assert.match(results[1].error, /already used/);
});

test('review blockers stop after bounded repair cycles instead of consuming the full budget', async () => {
  const queue = actions(); let reviews = 0;
  await assert.rejects(runEngineeringAgent('Change count', [{ path: 'main.ts', content: source }], {
    signal: new AbortController().signal,
    check: async (files, kind) => ({ kind, revision: revision(files), status: 'passed', output: 'passed' }),
    call: async model => {
      if (model === 'gemini-3.5-flash') {
        reviews++;
        return text(JSON.stringify({ findings: [{ severity: 'high', path: 'main.ts', line: 1, problem: 'Unresolved invariant', evidence: 'Count must remain one' }], limitations: [] }));
      }
      return queue.shift() || tool('finish', { summary: 'Done' });
    },
  }, () => {}), /two repair cycles/);
  assert.equal(reviews, 3);
});

test('durable workspace lock rejects overlap and recovers a confirmed dead local worker', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { createHash } = await import('node:crypto');
  process.env.ALLOW_DB_FALLBACK = 'true';
  const { acquireWorkspace } = await import('../lib/agent/store');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildx-lock-test-'));
  const previous = process.env.AGENT_RUN_DIRECTORY;
  process.env.AGENT_RUN_DIRECTORY = dir;
  try {
    const release = await acquireWorkspace('project');
    await assert.rejects(acquireWorkspace('project'), /active/);
    await release();
    const lock = path.join(dir, createHash('sha256').update('project').digest('hex') + '.lock');
    await fs.writeFile(lock, JSON.stringify({ pid: 2147483647, hostname: os.hostname() }));
    const recovered = await acquireWorkspace('project');
    await recovered();
  } finally {
    if (previous === undefined) delete process.env.AGENT_RUN_DIRECTORY;
    else process.env.AGENT_RUN_DIRECTORY = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('acceptance files cannot be overwritten by the agent', async () => {
  const controller = new AbortController();
  const queue = [tool('read_file',{path:'acceptance.test.js'}),tool('apply_patch',{path:'acceptance.test.js',before:'throw new Error("failure");',after:'// bypass'})];
  const outputs: any[] = [];
  await assert.rejects(runEngineeringAgent('Fix failing test',[{path:'acceptance.test.js',content:'throw new Error("failure");'}],{
    signal:controller.signal,protectedPaths:['acceptance.test.js'],
    call:async()=>queue.shift()!, checkpoint:async()=>{if(!queue.length)controller.abort();},
  },(event,data)=>{if(event==='tool_result')outputs.push(data.result);}));
  assert.match(outputs[1].error,/read-only/);
});

test('an explicit blocker stops promptly without switching models or saving files', async () => {
  let calls = 0;
  await assert.rejects(runEngineeringAgent('Connect database', [{path:'main.ts',content:source}], {
    signal:new AbortController().signal,
    call:async()=>{calls++;return tool('report_blocker',{reason:'Database configuration is missing'});},
  },()=>{}),/Database configuration is missing/);
  assert.equal(calls,1);
});

test('backend checks cannot stand in for a changed frontend project', async () => {
  const controller = new AbortController();
  const queue = [tool('read_file',{path:'frontend/main.ts'}),tool('apply_patch',{path:'frontend/main.ts',before:'count = 1',after:'count = 2'}),tool('run_check',{kind:'build',project:'backend'}),tool('finish',{summary:'done'})];
  const errors: string[] = [];
  await assert.rejects(runEngineeringAgent('Change count', [{path:'frontend/main.ts',content:source},{path:'frontend/package.json',content:'{}'}], {
    signal:controller.signal,
    call:async()=>queue.shift()!,
    check:async(files,kind)=>({kind,revision:revision(files),status:'passed',output:'passed'}),
    checkpoint:async()=>{if(!queue.length)controller.abort();},
  },(event,data)=>{if(event==='tool_result' && data.result.error)errors.push(data.result.error);}));
  assert.ok(errors.some(error=>error.includes('frontend')));
});

test('blueprint refinement uses checked specification edits and independent review', async () => {
  const { buildBlueprint } = await import('../lib/agent/blueprint');
  const fixture = require('../../test/fixtures/blueprint.json');
  const queue = [tool('define_acceptance',{criteria:[{id:'spec',description:'Blueprint contract remains valid',project:'.',kind:'typecheck'}]}),tool('read_file',{path:'blueprint.json'}),tool('apply_patch',{path:'blueprint.json',before:JSON.stringify(fixture.appName),after:'"Verified project"'}),tool('run_check',{kind:'typecheck',project:'.'}),tool('finish',{summary:'Refined name'})];
  let reviewed = false;
  const result = await buildBlueprint('Rename to Verified project',undefined,fixture.stack,{},undefined,fixture,async model=>{
    if(model==='gemini-3.5-flash'){reviewed=true;return text('{"findings":[],"limitations":[]}');}
    return queue.shift() || tool('report_blocker',{reason:'Unexpected repeated check failure'});
  });
  assert.equal(result.appName,'Verified project');
  assert.deepEqual(result.stack,fixture.stack);
  assert.equal(reviewed,true);
});
