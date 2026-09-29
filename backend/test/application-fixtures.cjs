const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tasks = require('../evaluation/application-tasks.cjs');

function check(task, files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'buildx-application-fixture-'));
  try {
    for (const [name, content] of Object.entries({...files, 'acceptance.test.mjs':task.acceptance})) {
      const target = path.join(directory, name);
      fs.mkdirSync(path.dirname(target), {recursive:true});
      fs.writeFileSync(target, content);
    }
    const env = {...process.env};
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, ['--test', 'acceptance.test.mjs'],
      {cwd:directory,encoding:'utf8',timeout:10000,env});
  } finally {
    fs.rmSync(directory, {recursive:true,force:true});
  }
}

for (const task of tasks) test(`${task.id} rejects the broken application and accepts the reference`, () => {
  const broken = check(task, task.files);
  assert.notEqual(broken.status, 0, `${task.id} accepted its broken starting point:\n${broken.stdout}\n${broken.stderr}`);
  const repaired = check(task, {...task.files,...task.reference});
  assert.equal(repaired.status, 0, `${task.id} reference failed:\n${repaired.stdout}\n${repaired.stderr}`);
});
