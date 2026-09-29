function createFixtureCheck(runSandboxCheck, revision, acceptance, signal) {
 return async (files,kind) => {
  if(kind!=='test')return {
   kind,status:'unavailable',
   output:'This synthetic fixture defines only a test script. Run the test check for executable verification; build and typecheck are not configured.',
   revision:revision(files),
  };
  const actual=await runSandboxCheck({...files,'acceptance.test.mjs':acceptance},kind,'.',signal);
  return {...actual,revision:revision(files)};
 };
}
module.exports={createFixtureCheck};
