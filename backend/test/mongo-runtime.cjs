// Disposable local MongoDB only. Never loads the application's .env.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const mongoose = require('../sandbox/node_modules/mongoose');
process.env.DATABASE_URL = 'mongodb://127.0.0.1:55440/buildx_test';
const fixture = require('../../audit/backend-2026-09-20/fixture.json');
fixture.architecture.database = 'MongoDB';
const source = require('../dist/lib/scaffoldRuntime').generatedRepository(fixture);
const mod = new Module(__filename,module);
mod.filename = path.resolve(__dirname,'generated-mongo.cjs');
mod.paths = module.paths;
const original = mod.require.bind(mod);
mod.require = key => key==='mongoose' ? mongoose : original(key);
mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,mod.filename);
const repo = mod.exports;
(async()=>{
 const id = process.argv[2] || randomUUID();
 if(process.argv[2]) { assert.equal((await repo.list('items','alice',id))[0].title,'Persisted'); return; }
 await repo.insert('items','alice',{id,title:'Persisted'});
 const child = require('node:child_process').spawnSync(process.execPath,[__filename,id],{encoding:'utf8',timeout:20000});
 assert.equal(child.status,0,child.stderr);
 assert.equal(await repo.update('items','bob',id,{title:'stolen'}),undefined);
 assert.equal((await repo.list('items','alice',id))[0].title,'Persisted');
 assert.equal((await repo.update('items','alice',id,{title:'Updated',id:'spoof'})).id,id);
 assert.equal((await repo.remove('items','alice',id)).title,'Updated');
 assert.equal((await repo.list('items','alice',id)).length,0);
 console.log('MongoDB passed: persistence across processes, CRUD, owner isolation, immutable IDs.');
})().then(()=>mongoose.disconnect()).catch(error=>{console.error(error);process.exit(1);});
