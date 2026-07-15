# ⚡ BuildX — AI App Architect

> Turn any app idea into a complete full-stack blueprint in seconds.

BuildX is a production-ready full-stack application that turns plain-English app ideas into complete product blueprints: database schema, REST API endpoints, UI screens, architecture decisions, starter code, live previews, and exportable project scaffolds.

**AI providers:** Groq (free), Google AI Studio / Gemini (free), and NVIDIA NIM (free credits).

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | TanStack React Query v5 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (JSON fallback for local dev) |
| Validation | Zod (backend input + AI output) |
| AI | Multi-provider LLM router (Groq, Gemini, NVIDIA) |
| Auth | JWT + bcrypt + GitHub OAuth |
| Deploy FE | Vercel |
| Deploy BE | Render |

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Blueprint generation** | Single-shot or agentic SSE streaming (PM → Architect → API → UI → Coder → QA) |
| **Refinement chat** | Iteratively patch blueprints via natural language |
| **Code generation** | Stream full monorepo source files into the Code Studio |
| **Live preview** | Self-contained HTML sandbox with responsive viewport controls |
| **ZIP export** | Download a starter project scaffold |
| **GitHub export** | Push scaffold to a new or existing repo (OAuth) |
| **Public gallery** | Share blueprints publicly or keep them private |
| **Multi-model** | Switch between Groq, Gemini, and NVIDIA models |

---

## 📁 Project Structure

```
buildx/
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── db.ts
│   │   │   ├── generator.ts
│   │   │   ├── orchestrator.ts      # Agentic SSE blueprint generation
│   │   │   ├── refine.ts
│   │   │   ├── scaffold.ts
│   │   │   ├── stream.ts
│   │   │   ├── types.ts
│   │   │   ├── llm/                 # Multi-provider router (Groq, Gemini, NVIDIA)
│   │   │   └── codegen/             # Code generation + preview HTML
│   │   └── routes/
│   │       ├── auth.ts              # Signup, login, GitHub OAuth
│   │       └── blueprint.ts
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CodeStudio.tsx       # File tree + editor + codegen
│   │   │   ├── PreviewPanel.tsx     # Live preview sandbox
│   │   │   ├── CodePreviewSplit.tsx # Side-by-side code + preview
│   │   │   ├── BlueprintOutput.tsx
│   │   │   └── ...
│   │   └── hooks/
│   │       ├── useStreamBlueprint.ts
│   │       ├── useCodeGeneration.ts
│   │       └── useModel.tsx
│   └── .env.example
│
└── package.json
```

---

## 🚀 Getting Started

### 1. Get API keys (at least one required)

| Provider | URL | Required |
|----------|-----|----------|
| Groq | https://console.groq.com | Recommended |
| Google AI Studio | https://aistudio.google.com/app/apikey | Optional |
| NVIDIA NIM | https://build.nvidia.com | Optional |

### 2. Clone and install

```bash
git clone https://github.com/yourname/buildx.git
cd buildx
npm run install:all
```

### 3. Configure

```bash
cp backend/.env.example backend/.env
# Set at minimum:
#   GROQ_API_KEY=gsk_...
#   DATABASE_URL=postgresql://user:password@localhost:5432/buildx
#   JWT_SECRET=<random 64-char hex>

cp frontend/.env.example frontend/.env
# Local dev: leave VITE_API_URL empty (Vite proxies /api → :3001)
```

### 4. Run

```bash
npm run dev
# Backend → http://localhost:3001
# Frontend → http://localhost:5173
```

If ports are busy:

```bash
kill $(lsof -t -i:3001) 2>/dev/null
kill $(lsof -t -i:5173) 2>/dev/null
```

---

## 🔧 Environment Variables

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅* | Free key from https://console.groq.com |
| `GEMINI_API_KEY` | Optional | Free key from Google AI Studio |
| `NVIDIA_API_KEY` | Optional | Key from build.nvidia.com |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Random secret for JWT signing |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth app secret |
| `PORT` | No | Default `3001` |
| `ALLOWED_ORIGINS` | Production | Comma-separated frontend URLs |

\*At least one of `GROQ_API_KEY`, `GEMINI_API_KEY`, or `NVIDIA_API_KEY` must be set.

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Production | Backend URL (empty for local dev) |
| `VITE_GITHUB_CLIENT_ID` | Optional | Must match backend `GITHUB_CLIENT_ID` |

---

## 🔌 API (selected)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/blueprint/generate-stream` | ✅ | SSE agentic blueprint generation |
| `POST` | `/api/blueprint/refine` | ✅ | Refine blueprint via chat |
| `POST` | `/api/blueprint/:id/codegen` | ✅ | SSE code generation |
| `GET` | `/api/blueprint/:id/files/contents` | Optional | All generated files + content |
| `GET` | `/api/blueprint/:id/preview` | Optional | Live preview HTML |
| `POST` | `/api/blueprint/export-github` | ✅ | Push scaffold to GitHub |
| `GET` | `/api/blueprint/health` | No | LLM provider configuration status |

Rate limited: **10 AI generations/minute** on `/generate`, `/generate-stream`, `/refine`, `/regenerate`, and `/:id/codegen`.

---

## 🤖 Available Models

### Groq (free)

| Model ID | Display Name | Daily Limit |
|----------|-------------|-------------|
| `qwen-3-32b` | Qwen 3 32B | Unlimited |
| `gpt-oss-120b` | GPT-OSS 120B | 5/day |

### Google AI Studio (free)

| Model ID | Display Name |
|----------|-------------|
| `gemini-3.5-flash` | Gemini 3.5 Flash |
| `gemini-3.1-pro` | Gemini 3.1 Pro (Preview) |

### NVIDIA NIM

| Model ID | Display Name |
|----------|-------------|
| `nemotron-3-550b` | Nemotron-3 Ultra 550B |

---

## 🛡️ Security

- Helmet.js secure headers
- Strict CORS allowlist (`ALLOWED_ORIGINS`)
- Rate limiting (200/min global, 10/min on AI endpoints)
- Zod validation on inputs and AI outputs
- JWT + bcrypt authentication
- API keys never exposed to the frontend
- Parameterised SQL queries
- Blueprint visibility controls (public/private)

---

## 📝 License

MIT
