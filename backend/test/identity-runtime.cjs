// Real NextAuth cryptography with synthetic credentials; no external accounts.
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const jwt = require('../sandbox/node_modules/next-auth/jwt');
const fixture = require('../../audit/backend-2026-09-20/fixture.json');
fixture.architecture.auth = 'NextAuth';
const source = require('../dist/lib/scaffoldRuntime').generatedAuth(fixture);
const mod = new Module(__filename,module);
mod.filename = __filename; mod.paths=module.paths;
const original=mod.require.bind(mod);
mod.require=key=>key==='next-auth/jwt'?jwt:original(key);
mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,__filename);
(async()=>{
 process.env.NEXTAUTH_SECRET='synthetic-nextauth-secret-not-an-account';
 const token=await jwt.encode({token:{sub:'test-user'},secret:process.env.NEXTAUTH_SECRET,maxAge:300});
 assert.equal(await mod.exports.authenticate('Bearer '+token),'test-user');
 await assert.rejects(mod.exports.authenticate('Bearer '+token.slice(0,-5)+'wrong'));
 const expired=await jwt.encode({token:{sub:'test-user'},secret:process.env.NEXTAUTH_SECRET,maxAge:-60});
 await assert.rejects(mod.exports.authenticate('Bearer '+expired));
 const missing=await jwt.encode({token:{},secret:process.env.NEXTAUTH_SECRET,maxAge:300});
 await assert.rejects(mod.exports.authenticate('Bearer '+missing));
 process.env.NEXTAUTH_SECRET='different-secret';
 await assert.rejects(mod.exports.authenticate('Bearer '+token));
 delete process.env.NEXTAUTH_SECRET;
 await assert.rejects(mod.exports.authenticate('Bearer '+token));
 console.log('NextAuth passed: real encrypted token accepted; tampered, expired, missing subject, wrong/missing secret rejected. Provider login not tested.');
})().catch(error=>{console.error(error);process.exitCode=1});
