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
