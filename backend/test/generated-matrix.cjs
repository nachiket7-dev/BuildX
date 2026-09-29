const {generateMonorepoFiles}=require('../dist/lib/scaffold');
const {runSandboxCheck}=require('../dist/lib/agent/sandbox');
const fixture=require('../../audit/backend-2026-09-20/fixture.json');
process.env.AGENT_SANDBOX_IMAGE='buildx-checks:local';
(async()=>{
 const results=[];
 for(const framework of ['Express','Fastify','Next.js']) {
  for(const [database,auth] of [['PostgreSQL','JWT'],['MongoDB','Clerk'],['Supabase','NextAuth']]) {
   const bp=structuredClone(fixture);
   bp.architecture={...bp.architecture,backend:framework==='Fastify'?'Fastify':'Express',frontend:framework==='Next.js'?'Next.js':'React + Vite',database,auth};
   bp.code.backend = '';
   const files=generateMonorepoFiles(bp);
   const pkg=JSON.parse(files['backend/package.json']);
   pkg.scripts.test='tsc && node startup.cjs';
   files['backend/package.json']=JSON.stringify(pkg);
   files['backend/startup.cjs']=`const assert=require('node:assert/strict');
const app=require('./dist/app').default;
(async()=>{
 if(typeof app.ready==='function') {
  await app.ready();
  const response=await app.inject({method:'GET',url:'/health'});
  assert.equal(response.statusCode,200);await app.close();
 } else {
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/health');
  assert.equal(response.status,200);await new Promise(resolve=>server.close(resolve));
 }
 console.log('Backend compiled and health route served');
})().catch(error=>{console.error(error);process.exitCode=1});`;

   for(const project of ['backend','frontend']) {
    const check=await runSandboxCheck(files,project==='backend'?'test':'build',project,AbortSignal.timeout(100000));
    const result={framework,database,auth,project,status:check.status,...(check.status==='passed'?{}:{output:check.output})};
    results.push(result);console.log(JSON.stringify(result));
   }
  }
 }
 console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,total:results.length}));
 if(results.some(r=>r.status!=='passed')) process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
