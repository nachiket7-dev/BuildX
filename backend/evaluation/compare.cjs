// Compare two evaluator JSON artifacts without making provider or network calls.
const fs = require('node:fs');

function validateRun(run, label) {
  if (!run || typeof run !== 'object' || !/^[a-f0-9]{64}$/.test(run.taskCatalogRevision || ''))
    throw new Error(`${label}: missing task catalog revision`);
  if (!Number.isInteger(run.repeat) || run.repeat < 1 || run.repeat > 5 ||
      !Array.isArray(run.taskManifest) || !run.taskManifest.length || !Array.isArray(run.results))
    throw new Error(`${label}: missing run configuration or results`);
  const ids = new Set();
  for (const task of run.taskManifest) {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
        !['development', 'held-out'].includes(task.split))
      throw new Error(`${label}: invalid or duplicate task manifest`);
    ids.add(task.id);
  }
  const keys = new Set();
  for (const result of run.results) {
    if (!result || !ids.has(result.id) || !Number.isInteger(result.attempt) ||
        result.attempt < 1 || result.attempt > run.repeat || typeof result.passed !== 'boolean' ||
        !Number.isFinite(result.ms) || result.ms < 0 ||
        !Number.isInteger(result.calls) || result.calls < 0 ||
        !Number.isFinite(result.tokens) || result.tokens < 0 ||
        !Number.isInteger(result.usageReports) || result.usageReports < 0 ||
        result.usageReports > result.calls || !Array.isArray(result.trace))
      throw new Error(`${label}: malformed result`);
    const key = `${result.id}#${result.attempt}`;
    if (keys.has(key)) throw new Error(`${label}: duplicate result ${key}`);
    keys.add(key);
  }
  if (keys.size !== ids.size * run.repeat)
    throw new Error(`${label}: incomplete task/repeat coverage`);
  return new Map(run.results.map(result => [`${result.id}#${result.attempt}`, result]));
}

function percentile(values, p) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * p) - 1];
}

function summarize(results) {
  const attempts = results.flatMap(result => result.trace.filter(item => item.event === 'agent_model_attempt'));
  const completeUsage = results.every(result => result.usageReports === result.calls);
  const reportedTokens = results.reduce((sum, result) => sum + result.tokens, 0);
  return {
    runs: results.length,
    passed: results.filter(result => result.passed).length,
    passRate: results.filter(result => result.passed).length / results.length,
    p50Ms: percentile(results.map(result => result.ms), 0.5),
    p95Ms: percentile(results.map(result => result.ms), 0.95),
    providerCalls: results.reduce((sum, result) => sum + result.calls, 0),
    fallbackRuns: results.filter(result => result.trace.some(item => item.event === 'agent_model_attempt' && item.fallback)).length,
    timeouts: attempts.filter(item => item.outcome === 'timeout').length,
    rateLimits: attempts.filter(item => item.outcome === 'rate_limited').length,
    providerFailures: attempts.filter(item => item.outcome === 'failed').length,
    serverErrors: attempts.filter(item => item.httpStatus >= 500 && item.httpStatus <= 599).length,
    reportedTokens,
    totalTokensIfComplete: completeUsage ? reportedTokens : null,
    usageReports: results.reduce((sum, result) => sum + result.usageReports, 0),
    tokenUsageComplete: completeUsage,
  };
}

function compareRuns(baseline, candidate) {
  const base = validateRun(baseline, 'baseline');
  const next = validateRun(candidate, 'candidate');
  if (baseline.taskCatalogRevision !== candidate.taskCatalogRevision ||
      baseline.repeat !== candidate.repeat ||
      JSON.stringify(baseline.taskManifest) !== JSON.stringify(candidate.taskManifest))
    throw new Error('Runs must use the exact same fixture revision, manifest and repeat count');
  const ordered = baseline.taskManifest.flatMap(task =>
    Array.from({length: baseline.repeat}, (_, index) => ({task, key: `${task.id}#${index + 1}`})));
  const baseResults = ordered.map(({key}) => base.get(key));
  const candidateResults = ordered.map(({key}) => next.get(key));
  const bySplit = {};
  for (const split of ['development', 'held-out']) {
    const keys = ordered.filter(item => item.task.split === split).map(item => item.key);
    if (keys.length) bySplit[split] = {
      baseline: summarize(keys.map(key => base.get(key))),
      candidate: summarize(keys.map(key => next.get(key))),
    };
  }
  const perTask = baseline.taskManifest.map(task => {
    const keys = Array.from({length: baseline.repeat}, (_, index) => `${task.id}#${index + 1}`);
    return {
      id: task.id, split: task.split,
      baselinePassed: keys.filter(key => base.get(key).passed).length,
      candidatePassed: keys.filter(key => next.get(key).passed).length,
    };
  });
  const before = summarize(baseResults);
  const after = summarize(candidateResults);
  const heldOut = perTask.filter(task => task.split === 'held-out');
  const enoughCoverage = baseline.repeat >= 3 && perTask.length >= 10 && heldOut.length >= 5;
  const qualityRegressions = perTask.filter(task => task.candidatePassed < task.baselinePassed);
  const reliabilityRegressed = after.timeouts > before.timeouts ||
    after.rateLimits > before.rateLimits || after.providerFailures > before.providerFailures ||
    after.serverErrors > before.serverErrors || after.fallbackRuns > before.fallbackRuns;
  const latencyRegressed = after.p95Ms > before.p95Ms * 1.2;
  const heldOutAfter = bySplit['held-out']?.candidate;
  const minimumQualityMet = after.passRate >= 0.8 && !!heldOutAfter && heldOutAfter.passRate >= 0.8;
  const gate = !enoughCoverage ? 'insufficient_coverage'
    : qualityRegressions.length || reliabilityRegressed || latencyRegressed ? 'regression_requires_investigation'
    : !minimumQualityMet || !after.tokenUsageComplete ? 'quality_or_usage_insufficient'
    : 'candidate_for_manual_review';
  return {
    baseline: {model:baseline.model,skills:baseline.skills,summary:before},
    candidate: {model:candidate.model,skills:candidate.skills,summary:after},
    taskCatalogRevision:baseline.taskCatalogRevision,
    tasks:perTask,
    bySplit,
    pairedTransitions: {
      gained: ordered.filter(({key}) => !base.get(key).passed && next.get(key).passed).length,
      lost: ordered.filter(({key}) => base.get(key).passed && !next.get(key).passed).length,
    },
    gate: {status:gate,minimum:{repeats:3,tasks:10,heldOutTasks:5,overallPassRate:0.8,heldOutPassRate:0.8},
      qualityRegressionTaskIds:qualityRegressions.map(task => task.id),
      reliabilityRegressed,latencyRegressed,minimumQualityMet,tokenUsageComplete:after.tokenUsageComplete},
    note:'Offline synthetic-task comparison only. A passing screen never changes routes or certifies production quality. Missing provider usage is not treated as zero cost.',
  };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--baseline' || args[2] !== '--candidate')
      throw new Error('Usage: node evaluation/compare.cjs --baseline baseline.json --candidate candidate.json');
    const baseline = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const candidate = JSON.parse(fs.readFileSync(args[3], 'utf8'));
    console.log(JSON.stringify(compareRuns(baseline, candidate), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {compareRuns};
