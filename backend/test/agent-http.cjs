// Real HTTP and disposable database; provider boundary is stubbed, never live data.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
process.env.NODE_PATH = path.join(root, 'node_modules');
Module._initPaths();
for (const key of Object.keys(process.env)) if (/API_KEY|DATABASE_URL|JWT_SECRET/.test(key)) delete process.env[key];
Object.assign(process.env, { JWT_SECRET: 'isolated-test-not-production', ALLOW_DB_FALLBACK: 'true', NODE_ENV: 'test' });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'buildx-http-'));
process.env.AGENT_RUN_DIRECTORY = path.join(temp, 'runs');
fs.cpSync(path.join(root, 'backend/dist'), path.join(temp, 'backend/dist'), { recursive: true });
const load = file => require(path.join(temp, 'backend/dist', file));
const db = load('lib/db.js');
const { revision } = load('lib/agent/validation.js');
load('lib/agent/engine.js').runEngineeringAgent = async (prompt, files, options) => {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, 180);
    options.signal.addEventListener('abort', () => { clearTimeout(timeout); reject(new Error('cancelled')); }, { once: true });
  });
  if (prompt === 'concurrent edit') await db.saveBlueprintFile(projectId, 'main.ts', 'export const n = 9;', 'typescript');
  return { message: 'Prepared test change', revision: revision(Object.fromEntries(files.map(f => [f.path, f.content]))), stagedDiffs: { 'main.ts': { original: 'export const n = 1;', modified: 'export const n = 2;' } }, modifiedFiles: [{ path: 'main.ts', content: 'export const n = 2;' }] };
};
const server = load('app.js').default.listen(0, '127.0.0.1');
let base, projectId;
async function request(route, method = 'GET', body, token) {
  return fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function run() {
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
  const signup = await request('/api/auth/signup', 'POST', { name: 'Test', email: 'test@example.test', password: 'test-pass-123' });
  assert.equal(signup.status, 201);
  const { token, user } = await signup.json();
  const bp = JSON.parse(fs.readFileSync(path.join(root, 'audit/backend-2026-09-20/fixture.json')));
  projectId = await db.saveBlueprint('Test workspace', bp, user.id);
  const vfs = `/api/blueprints/${projectId}/vfs`;
  assert.deepEqual((await (await request(vfs, 'GET', undefined, token)).json()).data.files, []);
  await db.saveBlueprintFile(projectId, 'main.ts', 'export const n = 1;', 'typescript');
  await request(vfs + '/init', 'POST', {}, token);
  assert.equal((await db.getBlueprintFiles(projectId)).length, 1);
  assert.equal((await request(vfs + '/file', 'PUT', { path: 'main.ts', content: 'bad', expectedContent: 'stale' }, token)).status, 409);
  assert.equal((await request('/api/auth/login', 'POST', { email: {}, password: 'x' })).status, 400);
  const endpoint = `/api/agent/${projectId}`;
  let response = await request(endpoint + '/chat', 'POST', { prompt: 'normal', requestId: randomUUID() }, token);
  let stream = await response.text();
  assert.match(stream, /event: done/);
  assert.doesNotMatch(stream, /event: error/);
  assert.equal((await db.getBlueprintFiles(projectId))[0].content, 'export const n = 1;');
  response = await request(endpoint + '/chat', 'POST', { prompt: 'concurrent edit' }, token);
  stream = await response.text();
  assert.match(stream, /Workspace changed/);
  assert.doesNotMatch(stream, /event: staged_diff/);
  const runId = randomUUID();
  response = await request(endpoint + '/chat', 'POST', { prompt: 'cancel this', requestId: runId }, token);
  assert.equal((await request(endpoint + '/chat', 'POST', { prompt: 'competing' }, token)).status, 409);
  assert.equal((await request(endpoint + '/runs/' + runId + '/cancel', 'POST', {}, token)).status, 200);
  stream = await response.text();
  assert.match(stream, /event: error/);
  assert.doesNotMatch(stream, /event: done/);
  const saved = await (await request(endpoint + '/runs/' + runId, 'GET', undefined, token)).json();
  assert.equal(saved.status, 'cancelled');
  assert.equal((await db.getBlueprintFiles(projectId))[0].content, 'export const n = 9;');
  const detachedId = randomUUID();
  response = await request(endpoint + '/chat', 'POST', {prompt:'detached',requestId:detachedId}, token);
  await response.body.cancel();
  await new Promise(resolve => setTimeout(resolve,350));
  const detached = await (await request(endpoint+'/runs/'+detachedId,'GET',undefined,token)).json();
  assert.equal(detached.status,'completed');
  assert.ok(detached.events.some(event=>event.event==='done'));
  assert.ok((await (await request(endpoint+'/runs','GET',undefined,token)).json()).runs.some(run=>run.id===detachedId));
  await db.saveBlueprintFile(projectId,'frontend/src/App.tsx','export default () => <p>Actual saved edit</p>;','typescript');
  await db.saveBlueprintFile(projectId,'backend/.env','SECRET=private','text');
  const preview = await (await request('/api/blueprint/'+projectId+'/preview/source','GET',undefined,token)).json();
  assert.match(preview.files['frontend/src/App.tsx'],/Actual saved edit/);
  assert.equal(preview.files['backend/.env'],undefined);
  assert.equal((await request('/api/blueprint/'+projectId+'/preview/source')).status,404);
  console.log('HTTP integration passed: pure reads, idempotent init, stale-edit conflict, input validation, SSE completion, candidate isolation, concurrent edits, run locking and cancellation.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
});
