const test = require('node:test');
const assert = require('node:assert/strict');
const {compareRuns} = require('../evaluation/compare.cjs');

function run() {
  const taskManifest = Array.from({length: 10}, (_, index) => ({
    id: `task-${index}`, category:'application',
    split:index < 5 ? 'development' : 'held-out',
  }));
  return {
    model:'pipeline', skills:'enabled', repeat:3,
    taskCatalogRevision:'a'.repeat(64), taskManifest,
    results:taskManifest.flatMap(task => Array.from({length:3}, (_, index) => ({
      id:task.id, attempt:index+1, passed:true, ms:1000, calls:2,
      tokens:100, usageReports:2,
      trace:[{event:'agent_model_attempt',outcome:'succeeded',fallback:false}],
    }))),
  };
}

test('paired comparison blocks incomplete, mismatched and underpowered evidence', () => {
  const baseline=run(), candidate=structuredClone(baseline);
  assert.equal(compareRuns(baseline,candidate).gate.status,'candidate_for_manual_review');
  candidate.taskCatalogRevision='b'.repeat(64);
  assert.throws(()=>compareRuns(baseline,candidate),/same fixture revision/);
  candidate.taskCatalogRevision=baseline.taskCatalogRevision;
  candidate.results.pop();
  assert.throws(()=>compareRuns(baseline,candidate),/incomplete task\/repeat coverage/);
  candidate.results=structuredClone(baseline.results);
  candidate.repeat=2;
  assert.throws(()=>compareRuns(baseline,candidate),/malformed result|same fixture revision/);
  candidate.repeat=3;
  candidate.taskManifest=candidate.taskManifest.slice(0,4);
  candidate.results=candidate.results.filter(result=>candidate.taskManifest.some(task=>task.id===result.id));
  const smallBaseline=structuredClone(candidate);
  assert.equal(compareRuns(smallBaseline,candidate).gate.status,'insufficient_coverage');
});

test('paired comparison surfaces held-out regressions, fallback, latency and unknown token usage', () => {
  const baseline=run(), candidate=structuredClone(baseline);
  candidate.results.find(result=>result.id==='task-7'&&result.attempt===1).passed=false;
  for (const result of candidate.results.slice(0,3)) result.ms=2000;
  candidate.results[0].usageReports=1;
  candidate.results[0].trace.push({event:'agent_model_attempt',outcome:'timeout',fallback:true});
  const report=compareRuns(baseline,candidate);
  assert.equal(report.gate.status,'regression_requires_investigation');
  assert.deepEqual(report.gate.qualityRegressionTaskIds,['task-7']);
  assert.equal(report.pairedTransitions.lost,1);
  assert.equal(report.bySplit['held-out'].candidate.passed,14);
  assert.equal(report.candidate.summary.timeouts,1);
  assert.equal(report.candidate.summary.fallbackRuns,1);
  assert.equal(report.candidate.summary.reportedTokens,3000);
  assert.equal(report.candidate.summary.totalTokensIfComplete,null);
  assert.equal(report.gate.latencyRegressed,true);
});

test('comparison detects increased provider server failures', () => {
  const baseline=run(),candidate=structuredClone(baseline);
  candidate.results[0].trace.push({event:'agent_model_attempt',outcome:'failed',httpStatus:500,fallback:false});
  const report=compareRuns(baseline,candidate);
  assert.equal(report.candidate.summary.providerFailures,1);
  assert.equal(report.candidate.summary.serverErrors,1);
  assert.equal(report.gate.status,'regression_requires_investigation');
});

test('matching failure rates and missing usage cannot qualify a model for manual review', () => {
  const baseline=run(), candidate=structuredClone(baseline);
  for (const result of baseline.results) result.passed=false;
  for (const result of candidate.results) result.passed=false;
  let report=compareRuns(baseline,candidate);
  assert.equal(report.gate.status,'quality_or_usage_insufficient');
  assert.equal(report.gate.minimumQualityMet,false);
  for (const result of baseline.results) result.passed=true;
  for (const result of candidate.results) result.passed=true;
  candidate.results[0].usageReports=0;
  report=compareRuns(baseline,candidate);
  assert.equal(report.gate.status,'quality_or_usage_insufficient');
  assert.equal(report.gate.minimumQualityMet,true);
  assert.equal(report.gate.tokenUsageComplete,false);
});
