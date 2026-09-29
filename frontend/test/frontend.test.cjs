const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
// Compile the small units under test; no bundler, browser, or provider service required.
for (const extension of [".ts", ".tsx"])
  require.extensions[extension] = (module, filename) => {
    const output = ts.transpileModule(
      fs.readFileSync(filename, "utf8").replaceAll("import.meta.env", "({})"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText;
    module._compile(output, filename);
  };
const { FileSaveQueue } = require("../src/lib/fileSaveQueue.ts");
const { ProductDemo } = require("../src/components/landing/ProductDemo.tsx");
const { Input } = require("../src/components/ui/Input.tsx");
const { Textarea } = require("../src/components/ui/Textarea.tsx");
const { Button } = require("../src/components/ui/Button.tsx");
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("guided demo exposes playback and inspection without a live composer", () => {
  const markup = renderToStaticMarkup(React.createElement(ProductDemo));
  assert.match(markup, /<figure[^>]+aria-label=/);
  assert.match(markup, /Linkspace/);
  assert.match(markup, /Simulated outputs/);
  assert.match(markup, /Replay product demo/);
  assert.match(markup, /Demo generation stages/);
  assert.doesNotMatch(markup, /<(?:input|textarea|iframe|form)\b/);
});
const { agentState } = require("../src/lib/generationStages.ts");
test("agent progress never fabricates completion and respects correction events", () => {
  assert.equal(agentState([], "architect"), "waiting");
  const events = [
    { agent: "architect", status: "completed" },
    { agent: "api_dev", status: "thinking" },
  ];
  assert.equal(agentState(events, "architect"), "complete");
  assert.equal(agentState(events, "designer"), "waiting");
  assert.equal(
    agentState(
      [...events, { agent: "architect", status: "correcting" }],
      "architect",
    ),
    "active",
  );
});
test("field error descriptions point to rendered content and preserve caller descriptions", () => {
  for (const Component of [Input, Textarea]) {
    const markup = renderToStaticMarkup(
      React.createElement(Component, {
        id: "idea",
        label: "Idea",
        error: "Required",
        helperText: "Hidden help",
        "aria-describedby": "external",
      }),
    );
    assert.match(markup, /aria-describedby="external idea-error"/);
    assert.match(markup, /id="idea-error"/);
    assert.doesNotMatch(markup, /idea-helper/);
    assert.match(markup, /aria-invalid="true"/);
  }
});
test("loading buttons cannot submit repeatedly", () => {
  const markup = renderToStaticMarkup(
    React.createElement(Button, { loading: true, type: "submit" }, "Save"),
  );
  assert.match(markup, /disabled=""/);
  assert.match(markup, /aria-busy="true"/);
});
test("rapid edits coalesce to the latest content", async () => {
  const writes = [];
  const queue = new FileSaveQueue(
    async (path, content) => {
      writes.push([path, content]);
    },
    () => {},
    60000,
  );
  queue.schedule("App.tsx", "first");
  queue.schedule("App.tsx", "latest");
  await queue.flushAll();
  assert.deepEqual(writes, [["App.tsx", "latest"]]);
  assert.equal(queue.hasUnsaved(), false);
});
test("writes to a file remain ordered while the first request is delayed", async () => {
  const writes = [];
  let release;
  const queue = new FileSaveQueue(
    async (path, content) => {
      writes.push(content);
      if (content === "first")
        await new Promise((resolve) => {
          release = resolve;
        });
    },
    () => {},
    60000,
  );
  queue.schedule("App.tsx", "first");
  const pending = queue.flush("App.tsx");
  await tick();
  queue.schedule("App.tsx", "latest");
  await queue.flush("App.tsx");
  assert.deepEqual(writes, ["first"]);
  release();
  await pending;
  assert.deepEqual(writes, ["first", "latest"]);
  assert.equal(queue.hasUnsaved(), false);
});
test("failed saves stay dirty and retry preserves the latest edit", async () => {
  let fail = true;
  const writes = [];
  const states = [];
  const queue = new FileSaveQueue(
    async (path, content) => {
      if (fail) throw new Error("offline");
      writes.push(content);
    },
    (path, state) => states.push(state),
    60000,
  );
  queue.schedule("App.tsx", "keep me");
  await queue.flushAll();
  assert.equal(queue.hasUnsaved(), true);
  assert.equal(states.at(-1), "error");
  fail = false;
  await queue.flushAll();
  assert.deepEqual(writes, ["keep me"]);
  assert.equal(states.at(-1), "saved");
});
test("a delayed file does not prevent another file from saving", async () => {
  let release;
  const writes = [];
  const queue = new FileSaveQueue(
    async (path) => {
      if (path === "slow")
        await new Promise((resolve) => {
          release = resolve;
        });
      writes.push(path);
    },
    () => {},
    60000,
  );
  queue.schedule("slow", "a");
  queue.schedule("fast", "b");
  const pending = queue.flushAll();
  await tick();
  assert.deepEqual(writes, ["fast"]);
  release();
  await pending;
  assert.deepEqual(writes, ["fast", "slow"]);
});

const {
  AgentMessage,
  AgentRunStatus,
} = require("../src/components/AgentConversation.tsx");
test("agent replies never invent verification or default pipeline models", () => {
  const plain = renderToStaticMarkup(
    React.createElement(AgentMessage, {
      message: { role: "assistant", content: "Connection failed." },
    }),
  );
  assert.match(plain, /Connection failed/);
  assert.doesNotMatch(plain, /Verified|Gemini|Kimi|GLM|Nemotron|<details/);
  const recorded = renderToStaticMarkup(
    React.createElement(AgentMessage, {
      message: {
        role: "assistant",
        content: "Prepared changes.",
        thinkingSteps: ["Read the component"],
        telemetry: { planner: { modelUsed: "actual-model" } },
      },
    }),
  );
  assert.match(recorded, /Run details/);
  assert.match(recorded, /actual-model/);
  assert.match(recorded, /Read the component/);
  assert.doesNotMatch(recorded, /<details[^>]*\bopen/);
});
test("long requests retain their full text behind a disclosure and live status uses supplied events", () => {
  const content = "Runtime issue\n" + "Detailed diagnostic line.\n".repeat(25);
  const markup = renderToStaticMarkup(
    React.createElement(AgentMessage, { message: { role: "user", content } }),
  );
  assert.match(markup, /Show full request/);
  assert.ok(markup.includes(content));
  assert.doesNotMatch(markup, /<details[^>]*\bopen/);
  const running = renderToStaticMarkup(
    React.createElement(AgentRunStatus, {
      stage: "PLANNING",
      elapsedMs: 65000,
      steps: [],
      plan: "",
    }),
  );
  assert.match(running, /Planning the changes/);
  assert.match(running, /1:05/);
  assert.doesNotMatch(running, /Verified|Gemini|Kimi|GLM|Nemotron/);
});

const { DurableJobClient, jobProgressLabel } = require('../src/lib/durableJobs.ts');
function memoryStorage() {
  const data = new Map();
  return { getItem:key=>data.get(key)??null, setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key) };
}
const jsonResponse = (value,status=200) => new Response(JSON.stringify(value),{status});
test('delayed capacity retries update job progress without losing the recovery record',async()=>{
 const storage=memoryStorage();let polls=0;const progress=[];
 const client=new DurableJobClient('owner',storage,async(_url,init)=>{
  if(init?.method==='POST')return jsonResponse({jobId:'00000000-0000-4000-8000-000000000005'});
  polls++;
  if(polls===1)return jsonResponse({status:'queued',attempt:0});
  if(polls===2)return jsonResponse({status:'queued',attempt:1,nextAttemptAt:'2026-09-29T08:00:00.000Z'});
  return jsonResponse({status:'completed',attempt:2,result:{id:'done'}});
 },1);
 const record=client.begin('blueprint','/api/agent/blueprint-jobs',{idea:'test idea'});
 assert.deepEqual(await client.watch('blueprint',record,new AbortController().signal,job=>progress.push(job)),{id:'done'});
 assert.deepEqual(progress.map(job=>job.status),['queued','queued','completed']);
 assert.match(jobProgressLabel(progress[1]),/Waiting for AI capacity/);
 assert.ok(client.pending('blueprint'));
});
test('durable jobs recover an ambiguous submission using the same persisted key and isolate accounts', async()=>{
 const storage=memoryStorage();let first=true;const keys=[];
 const request=async(url,init)=>{
  if(init?.method==='POST'){
   keys.push(JSON.parse(init.body).key);
   if(first){first=false;throw new Error('Network lost after server accepted');}
   return jsonResponse({jobId:'00000000-0000-4000-8000-000000000001'});
  }
  return jsonResponse({status:'completed',result:{id:'project'},attempt:1});
 };
 const client=new DurableJobClient('owner',storage,request,1);
 const record=client.begin('blueprint','/api/agent/blueprint-jobs',{idea:'test idea'});
 await assert.rejects(client.watch('blueprint',record,new AbortController().signal),/Network lost/);
 const restarted=new DurableJobClient('owner',storage,request,1);
 assert.equal(new DurableJobClient('other',storage,request).pending('blueprint'),null);
 const pending=restarted.pending('blueprint');
 assert.deepEqual(await restarted.watch('blueprint',pending,new AbortController().signal),{id:'project'});
 assert.equal(keys[0],keys[1]);assert.ok(restarted.pending('blueprint'));
 restarted.forget('blueprint',pending);assert.equal(restarted.pending('blueprint'),null);
});
test('detachment never cancels server work; explicit Stop resolves the pending key and acknowledges cancellation', async()=>{
 const storage=memoryStorage();const requests=[];
 const client=new DurableJobClient('owner',storage,async(url,init)=>{
  requests.push(url);
  if(url.endsWith('/cancel'))return jsonResponse({cancelled:true});
  if(init?.method==='POST')return jsonResponse({jobId:'00000000-0000-4000-8000-000000000002'});
  return jsonResponse({status:'running',attempt:1});
 },1);
 const record=client.begin('blueprint','/api/agent/blueprint-jobs',{idea:'test idea'});
 const controller=new AbortController();
 await assert.rejects(client.watch('blueprint',record,controller.signal,()=>controller.abort()),{name:'AbortError'});
 assert.ok(client.pending('blueprint'));assert.ok(requests.every(url=>!url.endsWith('/cancel')));
 await client.stop('blueprint',record);assert.equal(client.pending('blueprint'),null);
 assert.ok(requests.some(url=>url.endsWith('/cancel')));
});
test('recovery rejects a different request; completed Stop retains the result and failed work permits a new request', async()=>{
 const storage=memoryStorage();let state='completed';
 const client=new DurableJobClient('owner',storage,async(url,init)=>{
  if(url.endsWith('/cancel'))return jsonResponse({cancelled:false});
  if(init?.method==='POST')return jsonResponse({jobId:'00000000-0000-4000-8000-000000000003'});
  return jsonResponse({status:state,attempt:1,result:{id:'saved'},error:state==='failed'?'Invalid candidate':undefined});
 });
 const record=client.begin('blueprint','/api/agent/blueprint-jobs',{idea:'original'});
 assert.throws(()=>client.begin('blueprint',record.endpoint,{idea:'different'}),/Another request/);
 await assert.rejects(client.stop('blueprint',record),/already completed/);
 assert.ok(client.pending('blueprint'));
 state='failed';await assert.rejects(client.watch('blueprint',record,new AbortController().signal),/Invalid candidate/);
 assert.equal(client.pending('blueprint'),null);
});
test('failure to persist a recovery key prevents any submission',()=>{
 let requested=false;
 const client=new DurableJobClient('owner',{getItem:()=>null,setItem:()=>{throw new Error('Storage unavailable');},removeItem:()=>{}},async()=>{requested=true;});
 assert.throws(()=>client.begin('blueprint','/api/agent/blueprint-jobs',{}),/Storage unavailable/);
 assert.equal(requested,false);
});
test('validation rejection releases recovery record but server failures retain its key', async()=>{
 const storage=memoryStorage();let status=400;
 const client=new DurableJobClient('owner',storage,async()=>jsonResponse({error:'Rejected'},status));
 const invalid=client.begin('blueprint','/api/agent/blueprint-jobs',{idea:'x'});
 await assert.rejects(client.submit('blueprint',invalid),/Rejected/);
 assert.equal(client.pending('blueprint'),null);
 status=503;
 const retry=client.begin('blueprint','/api/agent/blueprint-jobs',{idea:'Valid idea to recover'});
 await assert.rejects(client.submit('blueprint',retry),/Rejected/);
 assert.equal(client.pending('blueprint').key,retry.key);
});
test('specification jobs survive reload and expired artifacts release the local record', async()=>{
 const storage=memoryStorage();let expired=false;
 const client=new DurableJobClient('owner',storage,async(url,init)=>{
  if(init?.method==='POST')return jsonResponse({jobId:'00000000-0000-4000-8000-000000000004'});
  return expired?jsonResponse({error:'Artifacts expired'},410):jsonResponse({status:'completed',result:{id:'project',data:{description:'updated'}},attempt:1});
 });
 const record=client.begin('spec:project','/api/agent/project/spec-jobs',{kind:'refine',prompt:'Improve'});
 assert.equal(client.pending('spec:project').key,record.key);
 assert.equal((await client.watch('spec:project',record,new AbortController().signal)).data.description,'updated');
 expired=true;
 await assert.rejects(client.watch('spec:project',record,new AbortController().signal),/expired/);
 assert.equal(client.pending('spec:project'),null);
});
test('owned terminal history acknowledges an interrupted POST by request key, without clearing another request',()=>{
 const storage=memoryStorage();const client=new DurableJobClient('owner',storage,async()=>{throw new Error('No submission needed');});
 const pending=client.begin('workspace:test','/api/agent/test/jobs',{kind:'chat',prompt:'Change count'});
 client.acknowledge('workspace:test','00000000-0000-4000-8000-000000000001','different-key');
 assert.ok(client.pending('workspace:test'));
 client.acknowledge('workspace:test','00000000-0000-4000-8000-000000000001',pending.key);
 assert.equal(client.pending('workspace:test'),null);
});
