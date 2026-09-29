const assert = require('node:assert/strict');
const { runSandboxCheck } = require('../dist/lib/agent/sandbox');
process.env.AGENT_SANDBOX_IMAGE = 'buildx-checks:local';
(async () => {
  const files = { 'package.json': '{"scripts":{"build":"tsc --noEmit","test":"node --test test.cjs"}}', 'tsconfig.json': '{"compilerOptions":{"skipLibCheck":true,"strict":true},"include":["main.ts"]}', 'main.ts': 'export const value: number = 1;', 'test.cjs': "const assert = require('node:assert/strict'); assert.equal(process.env.OPENROUTER_API_KEY, undefined); assert.equal(require('fs').existsSync('/workspace/.env'), false);" , '.env': 'PRIVATE=never-expose' };
  const signal = AbortSignal.timeout(60000);
  const pass = await runSandboxCheck(files, 'build', '.', signal);
  assert.equal(pass.status, 'passed', pass.output);
  const tests = await runSandboxCheck(files, 'test', '.', signal);
  assert.equal(tests.status, 'passed', tests.output);
  const fail = await runSandboxCheck({ ...files, 'main.ts': 'export const value: number = "wrong";' }, 'typecheck', '.', signal);
  assert.equal(fail.status, 'failed', fail.output);
  assert.match(fail.output, /not assignable/);
  console.log('Sandbox passes valid code, rejects a type error, executes tests, and excludes host secrets/.env.');
})().catch(error => { console.error(error); process.exitCode = 1; });
