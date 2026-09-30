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
    const timeout = setTimeout(resolve, 12000);
    options.signal.addEventListener('abort', () => { clearTimeout(timeout); reject(new Error('cancelled')); }, { once: true });
  });
  
  return { message: 'Prepared test change', revision: revision(Object.fromEntries(files.map(f => [f.path, f.content]))), stagedDiffs: { 'main.ts': { original: 'export const n = 1;', modified: 'export const n = 2;' } }, modifiedFiles: [{ path: 'main.ts', content: 'export const n = 2;' }] };
};

process.env.ALLOWED_ORIGINS='http://127.0.0.1:5189';
const apiApp=load('app.js').default;
const express=require('express');
const app=express();
app.use('/api', (req,res,next)=>{req.url='/api'+req.url;apiApp(req,res,next)});
app.use(express.static(path.join(root,'frontend/dist')));
app.get('*',(_req,res)=>res.sendFile(path.join(root,'frontend/dist/index.html')));
const server=app.listen(5189,'127.0.0.1');
(async()=>{
 const bcrypt=require('bcryptjs');
 const userId=await db.createUser('Recovery Test','recovery@example.test',await bcrypt.hash('Recovery-test-123',10));
 const fixture=require('./fixtures/blueprint.json');
 const id=await db.saveBlueprint('Recovery test workspace',fixture,userId);
 await db.saveBlueprintFile(id,'main.ts','export const n = 1;','typescript');
 console.log(JSON.stringify({url:'http://127.0.0.1:5189',email:'recovery@example.test',password:'Recovery-test-123',blueprintId:id}));
})().catch(console.error);
process.on('SIGINT',()=>{server.closeAllConnections();server.close(()=>{fs.rmSync(temp,{recursive:true,force:true});process.exit(0)});});
