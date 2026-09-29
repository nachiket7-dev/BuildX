// Explicit, free-tier-only provider conformance probe. No project data is sent.
const fs = require('node:fs');
const path = require('node:path');
const DEFAULT_MODELS = ['gemini-3.5-flash', 'glm-5.2', 'nemotron-3-550b'];
const args = process.argv.slice(2);
const allowed = new Set(['--live', '--free-only', '--prices', '--model', '--repeat']);
const values = {};
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (!allowed.has(flag) || flag in values) throw new Error(`Unknown or duplicate option: ${flag}`);
  if (flag === '--live' || flag === '--free-only') values[flag] = true;
  else {
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    values[flag] = value;
  }
}
const models = values['--model'] ? [values['--model']] : DEFAULT_MODELS;
const repeat = Number(values['--repeat'] || 3);
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 10) throw new Error('Invalid --repeat');
if (!values['--live']) {
  console.log(JSON.stringify({mode:'catalog-only',models,repeat,note:'No provider calls. Live probing requires --live --free-only --prices and confirmed free-tier eligibility.'},null,2));
  process.exit(0);
}
if (!values['--free-only'] || !values['--prices']) throw new Error('Live probing requires --free-only and a verified --prices file');
const prices = JSON.parse(fs.readFileSync(values['--prices'], 'utf8'));
for (const model of models) {
  const price = prices[model];
  if (!price || price.input !== 0 || price.output !== 0)
    throw new Error(`Free-tier price verification missing for ${model}`);
}
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { getLLMProvider, resolveModelKey } = require('../dist/lib/llm/router');
for (const model of models) resolveModelKey(model);

async function probe(model, attempt) {
  const started = Date.now();
  const provider = getLLMProvider(model);
  const messages = [{ role: 'user', content: 'Call read_marker to learn the marker. Do not guess. After its result, return exactly the marker.' }];
  const tools = [{ type: 'function', function: { name: 'read_marker', description: 'Read the marker', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } } }];
  const signal = AbortSignal.timeout(120000);
  try {
    const firstStarted = Date.now();
    const first = await provider.turn(messages, { tools, maxTokens: 2048, signal });
    const toolTurnMs = Date.now() - firstStarted;
    if (first.toolCalls.length !== 1 || first.toolCalls[0].function.name !== 'read_marker') throw Object.assign(new Error('Expected one read_marker tool call'), {code:'tool_call_missing'});
    const finalStarted = Date.now();
    const final = await provider.turn([...messages, first.message, { role: 'tool', tool_call_id: first.toolCalls[0].id, content: '{"marker":"BUILD_X_TOOL_OK"}' }], { tools, maxTokens: 2048, signal });
    const continuationMs = Date.now() - finalStarted;
    if (final.toolCalls.length || final.text.trim() !== 'BUILD_X_TOOL_OK') throw Object.assign(new Error('Final response did not use tool result correctly'), {code:'continuation_mismatch'});
    return { model, attempt, passed: true, durationMs: Date.now() - started, toolTurnMs, continuationMs,
      totalTokens: (first.usage?.total_tokens || 0) + (final.usage?.total_tokens || 0) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = signal.aborted || /timed? out|timeout/i.test(message) ? 'timeout'
      : ['tool_call_missing','continuation_mismatch'].includes(error?.code) ? error.code
      : /no final content or tool calls/i.test(message) ? 'empty_output'
      : /incomplete model output/i.test(message) ? 'incomplete_output'
      : /connection/i.test(message) ? 'connection'
      : /rate.?limit|too many requests/i.test(message) ? 'rate_limit'
      : Number(error?.status)===401 || Number(error?.status)===403 ? 'auth'
      : 'other_provider_error';
    return { model, attempt, passed: false, durationMs: Date.now() - started, failure };
  }
}

(async () => {
  const results = [];
  for (const model of models) for (let attempt = 1; attempt <= repeat; attempt++) results.push(await probe(model, attempt));
  const summary = models.map(model => {
    const runs = results.filter(result => result.model === model);
    const durations = runs.filter(result => result.passed).map(result => result.durationMs).sort((a,b) => a-b);
    return { model, attempts: runs.length, passed: runs.filter(result => result.passed).length,
      timeouts: runs.filter(result => result.failure === 'timeout').length,
      p95SuccessfulMs: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null };
  });
  console.log(JSON.stringify({mode:'live-free-tier',results,summary,note:'Synthetic conformance only; no code-quality or production-readiness claim.'},null,2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
