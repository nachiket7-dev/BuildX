// Disposable manual QA server. Every /api request is handled here, never proxied.
import { createServer } from "vite";
import path from "node:path";
const frontendRoot = path.resolve(import.meta.dirname, "..");
process.chdir(frontendRoot);

const project = {
  description: "An isolated local workspace for UI verification.",
  targetUsers: "QA reviewers",
  complexity: "Low",
  schema: [],
  endpoints: Array.from({ length: 14 }, (_, index) => ({
    method: index % 2 ? "GET" : "POST",
    path: `/api/teams/[teamId]/projects/[projectId]/activity/${index}`,
    description: "Project activity with team access rules and audit history.",
    auth: true,
  })),
  screens: [],
  features: {
    authentication: ["Workspace membership and access control"],
    core: Array.from(
      { length: 12 },
      (_, i) =>
        `Project capability ${i + 1}: review changes and coordinate work across the team.`,
    ),
    admin: ["Manage team permissions"],
    optional: [],
  },
  architecture: {
    frontend: "React",
    backend: "Express",
    database: "Postgres",
    auth: "JWT",
    hosting: "Local",
    flow: "",
  },
  code: { frontend: "", backend: "", sql: "" },
  effort: { time: "", complexity: "", cost: "", team: "" },
};
// Uneven, long data exercises shared blueprint panel density and alignment.
if (process.argv.includes('--panels')) {
  project.complexity = 'High';
  project.effort = { time: '6–8 weeks', cost: '$20,000', team: '1 Developer + 1 QA Designer', complexity: 'High Complexity — requires schema integration, authentication, and state management.' };
  project.features.authentication = ['Multi-factor authentication and social sign-in', 'Synchronize account profiles to the database', 'Role-based permissions for members and administrators'];
  project.features.core = project.features.core.slice(0, 6);
  project.features.admin = ['Manage team permissions', 'Review activity and audit history'];
  project.features.optional = ['Personalized suggestions', 'Notification preferences', 'Custom workspace branding'];
  project.schema = Array.from({ length: 6 }, (_, i) => ({
    table: ['users', 'member_profiles', 'projects', 'memberships', 'activity_events', 'notification_preferences'][i],
    columns: [
      { name: 'id', type: 'UUID', note: 'PRIMARY KEY' },
      { name: 'user_id', type: 'UUID', note: 'REFERENCES users(id), UNIQUE, NOT NULL' },
      { name: 'name', type: 'VARCHAR(255)', note: 'NOT NULL' },
      { name: 'status', type: 'VARCHAR(20)', note: "CHECK (status IN ('pending','verified','rejected')), DEFAULT 'pending'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', note: 'DEFAULT now()' },
      ...(i % 2 ? [{ name: 'additional_configuration_description', type: 'TEXT' }, { name: 'updated_at', type: 'TIMESTAMPTZ', note: 'DEFAULT now()' }] : []),
    ],
  }));
  project.screens = [{name:'Dashboard',icon:'layers',components:'Summary cards, activity list'}, {name:'Team settings',icon:'user',components:'Member list, invitations, role controls, notification settings'}, {name:'Project overview',icon:'code',components:'Project brief, architecture, progress'}];
}
project.id = "qa-workspace";
project.appName = "Atlas QA";
project.isOwner = true;
project.createdAt = new Date().toISOString();
project.idea = project.description;
project.views = 0;
project.endpointsCount = project.endpoints.length;
project.schemaCount = project.schema.length;
project.screensCount = project.screens.length;
// Opt-in overflow fixture; regular workspace checks keep their original one-project setup.
const workspaceList = process.argv.includes('--long-list')
  ? [...Array.from({ length: 23 }, (_, index) => ({
      ...project,
      id: `qa-list-${index + 1}`,
      appName: `Project ${String(index + 1).padStart(2, '0')}`,
      idea: index === 0 ? 'A workspace with a longer description to check readable wrapping across desktop and mobile layouts.' : project.idea,
    })), project]
  : [project];
const files = [
  {
    path: "src/App.tsx",
    language: "typescript",
    content:
      "export default function App() {\n  return <main><h1>Atlas QA</h1><p>A local test workspace.</p></main>;\n}\n",
  },
  {
    path: "src/styles.css",
    language: "css",
    content: "body { font-family: sans-serif; padding: 24px; }",
  },
];
const user = {
  id: "qa-user",
  name: "QA Reviewer",
  email: "qa@example.test",
  githubConnected: false,
};
const chatHistory = [
  {
    role: "user",
    content: "Add a useful empty state to the project dashboard.",
  },
  {
    role: "assistant",
    content:
      "Prepared an empty state with a clear heading and a create-project action. Review the proposed changes in the editor.",
    thinkingSteps: [
      "Read the dashboard component.",
      "Checked the existing navigation actions.",
    ],
    telemetry: {
      planner: { modelUsed: "nemotron-3-550b" },
      patches: [{ filePath: "src/App.tsx", modelUsed: "kimi-k3" }],
    },
  },
  {
    role: "user",
    content:
      "Fix the runtime preview error in src/App.tsx.\n\n" +
      Array.from(
        { length: 12 },
        (_, i) =>
          `Line ${i + 1}: configuration value is unavailable while the project loads.`,
      ).join("\n"),
  },
  {
    role: "assistant",
    content:
      "The request could not finish because the model service was unavailable. Your workspace files are unchanged. Please try again.",
    error: true,
  },
];
let failNextSave = true;
const server = await createServer({
  root: frontendRoot,
  configFile: path.join(frontendRoot, "vite.config.ts"),
  server: { port: 5190, strictPort: true },
  plugins: [
    {
      name: "isolated-qa-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/api/")) return next();
          res.setHeader("Content-Type", "application/json");
          let result = { success: true, data: [] };
          if (req.url === "/api/auth/login")
            result = { token: "local-qa-fixture-token", user };
          else if (req.url === "/api/auth/me") result = { user };
          else if (req.url === "/api/auth/chat/qa-workspace")
            result = { success: true, data: chatHistory };
          else if (
            req.url === "/api/agent/qa-workspace/chat" &&
            req.method === "POST"
          ) {
            let body = "";
            for await (const chunk of req) body += chunk;
            const { prompt } = JSON.parse(body);
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            const emit = (event, data) =>
              res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            emit("agent_plan", {
              plan: [
                "Review the current component",
                "Describe a focused improvement",
              ],
            });
            for (const [index, stage] of [
              "INGESTION",
              "PLANNING",
              "DIFF_GENERATION",
              "SCHEMA_VERIFIER",
            ].entries()) {
              if (res.destroyed) return;
              emit("pipeline_heartbeat", {
                activeStage: stage,
                elapsedMs: index * 1600,
                activeModel: "local-qa-model",
              });
              emit("thinking", {
                step: `Local verification: ${stage.toLowerCase().replaceAll("_", " ")}.`,
              });
              await new Promise((resolve) => setTimeout(resolve, 1600));
            }
            if (prompt.toLowerCase().includes("simulate failure"))
              emit("error", {
                error:
                  "Simulated connection failure. Your files are unchanged.",
              });
            else
              emit("done", {
                message: "Review complete. This local test changed no files.",
                modifiedFiles: [],
                telemetry: { planner: { modelUsed: "local-qa-model" } },
              });
            res.end();
            return;
          } else if (req.url.includes("/vfs/file") && req.method === "PUT") {
            let body = "";
            for await (const chunk of req) body += chunk;
            if (failNextSave) {
              failNextSave = false;
              res.statusCode = 503;
              res.end(JSON.stringify({ error: "Simulated save failure" }));
              return;
            }
            const value = JSON.parse(body);
            const file = files.find((file) => file.path === value.path);
            if (file) file.content = value.content;
            result = { success: true };
          } else if (
            req.url.includes("/files/contents") ||
            req.url.endsWith("/vfs")
          )
            result = {
              success: true,
              data: {
                files,
                fileTree: Object.fromEntries(
                  files.map((file) => [file.path, file.content]),
                ),
              },
            };
          else if (req.url === "/api/blueprint/qa-workspace")
            result = { success: true, data: project };
          else if (
            req.url.includes("/blueprint/list") ||
            req.url.includes("/auth/my-blueprints")
          )
            result = { success: true, data: workspaceList };
          res.end(JSON.stringify(result));
        });
      },
    },
  ],
});
await server.listen();
console.log(
  "Isolated QA workspace at http://localhost:5190/agent/qa-workspace",
);
