const assert=require('node:assert/strict');
const tasks=[...require('../evaluation/integration-tasks.cjs'),...require('../evaluation/application-tasks.cjs')];
const {runSandboxCheck}=require('../dist/lib/agent/sandbox');
process.env.AGENT_SANDBOX_IMAGE='buildx-checks:local';
(async()=>{
 for(const task of tasks){
  const run=files=>runSandboxCheck({...files,'acceptance.test.mjs':task.acceptance},'test','.',AbortSignal.timeout(100000));
  const broken=await run(task.files);assert.equal(broken.status,'failed',task.id+' must reject original: '+broken.output);
  const repaired=await run({...task.files,...task.reference});assert.equal(repaired.status,'passed',task.id+': '+repaired.output);
  console.log(task.id+': rejects broken, accepts reference');
 }
})().catch(error=>{console.error(error);process.exitCode=1});
