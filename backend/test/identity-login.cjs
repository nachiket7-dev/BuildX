// Real NextAuth HTTP login/cookie/session flow with a synthetic Credentials provider.
// This does not verify an external OAuth or Clerk tenant.
const assert=require('node:assert/strict');
const Module=require('node:module');
const ts=require('typescript');
const express=require('express');
const NextAuth=require('../sandbox/node_modules/next-auth').default;
const Credentials=require('../sandbox/node_modules/next-auth/providers/credentials').default;
const jwt=require('../sandbox/node_modules/next-auth/jwt');
const fixture=structuredClone(require('./fixtures/blueprint.json'));
fixture.architecture.auth='NextAuth';
const source=require('../dist/lib/scaffoldRuntime').generatedAuth(fixture);
const mod=new Module(__filename,module);mod.filename=__filename;mod.paths=module.paths;
const original=mod.require.bind(mod);mod.require=key=>key==='next-auth/jwt'?jwt:original(key);
mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,__filename);
process.env.NEXTAUTH_SECRET='local-login-rehearsal-secret-not-a-real-account';
let authorized=0,server,base;
const app=express();app.use(express.urlencoded({extended:false}));app.use(express.json());
app.use('/api/auth',(req,res,next)=>{
 req.query={...req.query,nextauth:req.path.split('/').filter(Boolean)};
 req.cookies=Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(part=>{const at=part.indexOf('=');return [part.slice(0,at).trim(),decodeURIComponent(part.slice(at+1))];}));
 const handler=NextAuth({secret:process.env.NEXTAUTH_SECRET,session:{strategy:'jwt'},providers:[Credentials({credentials:{email:{type:'email'},password:{type:'password'}},authorize:async credentials=>{
  authorized++;return credentials?.email==='qa@example.test'&&credentials?.password==='Synthetic-login-123'?{id:'synthetic-user',name:'QA',email:'qa@example.test'}:null;
 }})]});
 Promise.resolve(handler(req,res)).catch(next);
});
app.get('/protected',async(req,res)=>{try{res.json({user:await mod.exports.authenticate(req.headers.authorization)});}catch{res.status(401).json({error:'Unauthorized'});}});
(async()=>{
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;process.env.NEXTAUTH_URL=base;
 const jar=new Map();
 const request=async(path,body)=>{
  const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?new URLSearchParams(body):undefined});
  for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],at=pair.indexOf('=');if(pair.slice(at+1))jar.set(pair.slice(0,at),pair.slice(at+1));else jar.delete(pair.slice(0,at));}
  return response;
 };
 assert.deepEqual(await(await request('/api/auth/session')).json(),{});
 const csrf=await(await request('/api/auth/csrf')).json();assert.ok(csrf.csrfToken);
 await request('/api/auth/callback/credentials',{csrfToken:'wrong',email:'qa@example.test',password:'Synthetic-login-123',json:'true'});
 assert.equal(authorized,0,'Bad CSRF must not invoke authorize');
 const failed=await(await request('/api/auth/callback/credentials',{csrfToken:csrf.csrfToken,email:'qa@example.test',password:'wrong',json:'true'})).json();assert.match(failed.url,/CredentialsSignin/);
 assert.deepEqual(await(await request('/api/auth/session')).json(),{});
 const success=await request('/api/auth/callback/credentials',{csrfToken:csrf.csrfToken,email:'qa@example.test',password:'Synthetic-login-123',json:'true'});assert.equal(success.status,200);
 const session=await(await request('/api/auth/session')).json();assert.equal(session.user.email,'qa@example.test');
 const token=decodeURIComponent(jar.get('next-auth.session-token'));assert.ok(token && token!=='undefined');
 assert.equal((await fetch(base+'/protected')).status,401);
 const protectedResponse=await fetch(base+'/protected',{headers:{Authorization:'Bearer '+token}});assert.equal(protectedResponse.status,200);assert.equal((await protectedResponse.json()).user,'synthetic-user');
 const signoutCsrf=await(await request('/api/auth/csrf')).json();await request('/api/auth/signout',{csrfToken:signoutCsrf.csrfToken,json:'true'});
 assert.deepEqual(await(await request('/api/auth/session')).json(),{});assert.equal(jar.has('next-auth.session-token'),false);
 console.log('PASS: real NextAuth HTTP CSRF rejection, bad credentials, successful login, encrypted cookie/session, generated API bearer verifier and logout');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}});
