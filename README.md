# BuildX — AI App Architect

Turn an app idea into a structured blueprint, an editable full-stack workspace, and reviewable code changes.

BuildX combines product planning with a tool-using engineering agent. Describe an application, choose its stack, inspect the generated specification, and continue working in a browser-based editor with previews and agent-assisted changes.

**Current status:** active development. Builds and local regression tests pass. Live free-tier model reliability and staging integration checks remain release gates; generated output is a candidate to validate, not a guarantee of a working application.

## Features

- **Blueprint Studio:** generate and refine features, database schemas, API endpoints, UI screens, architecture, diagrams, and effort estimates.
- **Stack selection:** Next.js, Express, or Fastify; PostgreSQL, Supabase, or MongoDB; JWT, Clerk, or NextAuth scaffolding.
- **Engineering workspace:** file explorer, CodeMirror editor, inline diffs, responsive previews, and project-agent chat backed by a persisted virtual file system.
- **Checked agent changes:** repository inspection, acceptance criteria, scoped patches, sandbox checks, bounded repair, and separate-model review before presenting candidate changes.
- **Progress and recovery:** streamed status and tool activity, model-attempt telemetry, cancellation, and optional durable jobs that retain checkpoints across interruptions.
- **Project management:** saved blueprints, gallery, sharing controls, ZIP export, and GitHub OAuth repository export.
- **Product experience:** dark interface, BX interlock identity, animated loading sequence, and a landing-page product demonstration separate from the real Studio prompt flow.

## Technology

| Layer | Implementation |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| UI and editor | Carbon icons, Radix primitives, CodeMirror 6, Mermaid |
| Client data | TanStack React Query, workspace context, SSE/job clients |
| Backend | Node.js 22, Express, TypeScript, Zod |
| Persistence | PostgreSQL; explicit development-only JSON fallback |
| Authentication | JWT, bcrypt, GitHub OAuth |
| AI providers | Google AI Studio, Groq, OpenRouter, prototype-only NVIDIA NIM |
| Agent execution | Tool loop, versioned skills, checkpoint storage, independent review |
| Code verification | Restricted Docker runner with a prebuilt toolchain |
| CI | GitHub Actions builds, lint, tests, queue/recovery checks, and tracked-file guards |

## How the agent works

The default runtime uses one engineering loop for blueprint creation, refinement, code generation, and workspace editing. The older stage orchestrator remains available through `AGENT_RUNTIME=legacy`; it is not the default execution architecture.

```text
Idea or change request
        ↓
Inspect context → Define acceptance criteria → Plan and edit
        ↑                                           ↓
        └──────────── Bounded repair ← Run checks ──┘
                                            ↓
                                  Independent review
                                            ↓
                               Reviewable candidate output
```

The host controls tools and execution limits. Models can inspect files, search, apply checked edits, request validation, and consult a read-only architect. Predefined skills cover repository inspection, safe changes, dependency verification, and independent review.

Key safeguards:

- Maximum 24 model attempts and an 80,000-token budget per run, with up to two review repair cycles.
- Source/path validation, protected files, revision-aware changes, and staged output rather than unchecked workspace replacement.
- Fresh review context; successful implementation models cannot review their own work. Reviewer failover stays bounded.
- One author fallback switch; authentication/configuration errors and cancellation do not trigger indiscriminate provider retries.
- Blueprint checks validate the specification contract and starter-code syntax. They do **not** claim an application build or runtime has passed.
- Code checks run inside the configured Docker sandbox. Missing Docker or toolchain configuration reports **unavailable**, never passed.

When enabled, PostgreSQL-backed jobs add admission limits, workspace locking, checkpoints, cancellation, scheduled retries for provider-capacity failures, and recoverable candidate results.

## Model routing

The default configuration is `AGENT_MODEL_PROFILE=baseline`.

| Role | Default route |
| --- | --- |
| Automatic author | Gemini 3.8 Flash |
| Author fallback | Gemini 3.5 Flash |
| Independent review | A different eligible model, normally the other Gemini Flash model |
| Additional independent-review option | Groq GPT-OSS 120B when earlier author participation excludes the Gemini choices |
| Explicit model selection | Preserved; does not automatically become a specialist task route |

Configure Google AI Studio for the default route and Groq for the optional GPT-OSS route. Verify that the provider accounts remain on their intended free plans. Free quotas can produce rate limits and outages; the harness handles failure without treating it as a successful result.

### Experimental free specialists

`AGENT_MODEL_PROFILE=free-specialists` is an **opt-in evaluation profile**, not the release default:

| Task | Candidate |
| --- | --- |
| Edits in workspaces with at most three files | North Mini Code free |
| Larger edits and code generation | Laguna S 2.1 free |
| Explicit comparison runs | Laguna XS 2.1 free |
| Blueprint author / coding reviewer, with development prototype opt-in | Nemotron Super free |
| Read-only architect, with development prototype opt-in | Nemotron Ultra free |

Without prototype opt-in, blueprint authorship and review retain eligible baseline routes. NVIDIA hosted routes require `AGENT_ALLOW_PROTOTYPE_MODELS=true` and are blocked when `NODE_ENV=production`, including NVIDIA free variants on OpenRouter.

OpenRouter calls require explicit `:free` models, current zero pricing, supported capabilities, and available free quota. Requests enforce zero-price provider limits; there is no implicit paid OpenRouter fallback. A run allows at most six specialist attempts, including failures and review, with the consumed budget persisted before dispatch.

These candidates have not passed the application-quality gate. In the latest bounded screening, North returned valid tool calls but did not edit before exhausting its budget; Laguna returned HTTP 429. Poolside free endpoints may use submitted data for training, so evaluate them with public or synthetic projects. See `backend/src/lib/llm/specialists.ts` for routing policies.

## Local setup

### Desktop app

BuildX also includes a small Electron wrapper for macOS and Windows. It opens the
existing website and requires internet access. Run `npm run dev`, then
`npm run desktop:dev` in another terminal. The landing page's **Download Desktop**
button offers installers once a desktop GitHub release is published.

See [desktop/README.md](desktop/README.md) for packaging, signing, release setup,
and a short explanation for a viva.

### Prerequisites

- Node.js 22 and npm.
- PostgreSQL for normal persistence and durable jobs.
- A Google AI Studio API key for the default model route; a Groq key for optional selection/review fallback.
- Docker for generated-code verification. Blueprint contract checks do not require Docker.

### Install

```sh
git clone https://github.com/nachiket7-dev/BuildX.git
cd BuildX
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set these values in `backend/.env` using your own credentials:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Strong randomly generated signing secret |
| `GEMINI_API_KEY` | Default Gemini author/reviewer routes |
| `GROQ_API_KEY` | Optional GPT-OSS selection and review route |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins; locally `http://localhost:5173`. Production also permits the shipped `https://my-buildx.vercel.app` website used by Electron. |
| `AGENT_MODEL_PROFILE` | Keep `baseline` for the current default behavior |
| `AGENT_ALLOW_PROTOTYPE_MODELS` | Keep `false` unless evaluating prototype endpoints locally |

For specialist evaluation, add `OPENROUTER_API_KEY`; `OPEN_ROUTER_API_KEY` is also accepted. `NVIDIA_API_KEY` is needed only for direct NIM prototype evaluation. GitHub login/export additionally requires `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and matching `VITE_GITHUB_CLIENT_ID` in the frontend configuration.

Keep `VITE_API_URL` empty locally so Vite proxies `/api` to port 3001. For a separately hosted frontend, set it to the deployed backend URL. Never place provider keys in `VITE_*` variables or commit `.env` files.

The optional `ALLOW_DB_FALLBACK=true` JSON store is for local development only; durable jobs require PostgreSQL.

### Start the application

```sh
npm run dev
```

Frontend: `http://localhost:5173` · API: `http://localhost:3001` · Health: `http://localhost:3001/health`

### Enable code verification

```sh
docker build -t buildx-checks:local backend/sandbox
```

Set `AGENT_SANDBOX_IMAGE=buildx-checks:local` in `backend/.env`, keep Docker running, and restart the backend. The runner uses an ephemeral workspace, restricted resources, and a prebuilt dependency set; the running agent cannot install arbitrary packages or access the network. Custom dependencies require a matching provisioned image. See `backend/sandbox/Dockerfile` for the verification toolchain.

### Optional durable worker

For local queue testing, set `AGENT_QUEUE_ENABLED=true` in the API/worker environment and `VITE_AGENT_QUEUE_ENABLED=true` in the frontend environment. Both backend processes must use the same PostgreSQL database and provider/sandbox configuration.

Start the worker before submitting queued jobs, then restart the API and frontend with their queue flags:

```sh
npm run build --workspace=backend
npm run worker --workspace=backend
```

The worker runs in a separate terminal/process. Keep queue flags disabled in deployed environments until staging verification has been completed.

## Validation

From the repository root:

```sh
npm run build
npm run lint
npm test --workspace=backend
npm test --workspace=frontend
```

Latest local check, **29 September 2026**: backend and frontend builds passed; **72 backend tests** and **18 frontend tests** passed. The frontend build reports large-chunk warnings. Test counts are a dated snapshot, not a live CI status.

Additional suites cover HTTP behavior, Docker checks, generated stack combinations, database persistence, identity flows, durable queues, and recovery drills (see `backend/test/`). Do not point disposable integration tests at a real application database.

Model evaluation lists tasks without making API calls by default:

```sh
npm run evaluate --workspace=backend -- --suite screening --limit 1
```

Live evaluation requires `--live`, verified prices, and an explicit free-only or spending policy. Protocol/tool-call success alone does not establish end-to-end task quality.

GitHub's **Release checks** workflow runs application checks and a separate disposable PostgreSQL/Docker recovery suite. Pushing source for review is separate from promoting a deployment.

## Repository layout

```text
backend/
  src/
    app.ts                  Express middleware and routes
    agent-worker.ts         Durable-job worker entry point
    agent-maintenance.ts    Retention and worker-health commands
    lib/agent/              Tool loop, skills, validation, sandbox, queue, checkpoints
    lib/llm/                Provider adapters, routing, eligibility and retry policy
    lib/codegen/            Generated-code workflows
    routes/                 Auth, blueprints, workspace and job endpoints
  evaluation/               Synthetic tasks and bounded live evaluation
  sandbox/                  Pinned Docker verification toolchain
  test/                     Integration and operational tests
frontend/
  src/
    brand/                  Shared BX identity assets
    components/             Landing, Studio, blueprint inspector, editor and agent UI
    context/                Virtual-file-system state
    hooks/                  Blueprint, generation, refinement and model flows
    lib/                    API and durable-job clients
  test/                     Frontend regression and workspace checks
.github/workflows/          Release checks
```

## Release scope and limitations

The current source is suitable for a reviewable GitHub checkpoint. It is not yet a verified replacement for a live production deployment:

- No tested free-tier route has completed the documented live end-to-end engineering fixture reliably enough for promotion.
- Deployed browser → API → worker → provider → sandbox validation, quota/load checks, and rollback rehearsal remain staging gates.
- Real Clerk tenant flows, GitHub OAuth/export, and generated-app external NextAuth sign-in need their account-backed checks; local Credentials tests do not cover external providers.
- MongoDB 7 persistence was tested locally; MongoDB 8 needs a compatible test host.
- The local Docker runner is a verification baseline, not a hardened public multi-tenant execution service.
