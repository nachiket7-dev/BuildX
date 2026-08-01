# ⚡ BuildX — AI App Architect

> Turn any app idea into a complete full-stack blueprint and running VFS codebase in seconds.

BuildX is a high-performance full-stack application that turns plain-English app ideas into complete product blueprints and working codebases: database schemas, REST API endpoints, UI screens, architecture decisions, live previews, and exportable project scaffolds driven by an autonomous multi-model pipeline.

**AI providers:** Groq, Google AI Studio (Gemini), Moonshot (Kimi), Z-AI (GLM), and NVIDIA NIM.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion |
| UI Design | Studio Obsidian Dark Theme (`#08080a`), Glassmorphism, Lucide Icons |
| State | TanStack React Query v5 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (JSON fallback for local dev) |
| Validation | Zod (backend input + AI output) |
| AI Pipeline | Autonomous Multi-Model Router (Kimi K2.6, GLM-5.2, Nemotron, Gemini, Qwen) |
| Auth | JWT + bcrypt + GitHub OAuth |
| Deploy FE | Vercel |
| Deploy BE | Render |

---

## 🤖 Autonomous Multi-Model Pipeline Architecture

BuildX uses specialized, stage-optimal LLMs for each step of blueprint generation, code generation, and automated self-correction:

```
┌─────────────────┐    ┌─────────────────┐    ┌────────────────────┐    ┌──────────────────────┐
│    PLANNING     │ ➔ │    INGESTION    │ ➔ │  DIFF GENERATION   │ ➔ │    AUTO-FIX & QA     │
│ Nemotron 3 550B │    │ Gemini 3.5 Flash│    │    Z-AI GLM-5.2    │    │ Moonshot Kimi K2.6   │
└─────────────────┘    └─────────────────┘    └────────────────────┘    └──────────────────────┘
```

| Stage | Primary Model | Fallback Model | Description |
|-------|---------------|----------------|-------------|
| **1. PLANNING** | Nemotron 3 Ultra 550B | Moonshot Kimi K2.6 / GLM-5.2 | High-level system architecture, spec decomposition, and schema modeling |
| **2. INGESTION** | Gemini 3.5 Flash | Z-AI GLM-5.2 | Context gathering, component layout synthesis, and endpoint contract drafting |
| **3. DIFF GENERATION** | Z-AI GLM-5.2 | Gemini 3.5 Flash | AST-safe patch generation and file tree scaffolding |
| **4. AUTO-FIX & QA** | Moonshot Kimi K2.6 | Z-AI GLM-5.2 | Autonomous VFS self-correction, index optimizations, and syntax auditing |

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Autonomous Multi-Model Router** | Multi-stage pipeline routing requests across Kimi K2.6, GLM-5.2, Nemotron, Gemini, and Qwen |
| **Studio 3-Column Layout** | Linear/Vercel-grade studio workspace featuring File Tree, Code Editor, and Cortex Agent Chat |
| **Real-time SSE Streaming** | Live progress indicators, agent reasoning accordions, and stage telemetry badges |
| **AST-Safe Diff Patching** | Dynamic incremental patch application in Code Studio with emerald glow visual feedback |
| **Refinement Chat** | Natural language blueprint modification with stage-by-stage multi-model telemetry |
| **Live Interactive Preview** | Transpiled HTML/JS sandbox with responsive viewport controls and instant state updates |
| **Framer Motion Animations** | Scale-crossfade route transitions, spring physics sidebar collapsing, and morphing badges |
| **GitHub & ZIP Export** | One-click export to GitHub repository or downloadable project ZIP scaffold |

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
│   │   │   ├── orchestrator.ts      # Multi-model SSE stage orchestration
│   │   │   ├── refine.ts            # Natural language blueprint refinement
│   │   │   ├── scaffold.ts
│   │   │   ├── stream.ts
│   │   │   ├── types.ts
│   │   │   ├── llm/                 # Router (Kimi K2.6, GLM-5.2, Nemotron, Gemini, Groq)
│   │   │   └── codegen/             # Diff parser + preview transpiler
│   │   └── routes/
│   │       ├── agent.ts
│   │       ├── auth.ts              # Signup, login, GitHub OAuth
│   │       └── blueprint.ts
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentPage.tsx        # 3-Column Studio Workspace
│   │   │   ├── CodeStudio.tsx       # Monaco-style Editor + Diff Patching
│   │   │   ├── RefinementChat.tsx   # Live chat + multi-model stage badges
│   │   │   ├── StreamingView.tsx    # Pipeline stage badges & progress stream
│   │   │   ├── MarketingHeader.tsx  # Studio top navigation header
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

### 1. Get API Keys (at least one required)

| Provider | URL | Required |
|----------|-----|----------|
| NVIDIA NIM | https://build.nvidia.com | Recommended |
| Google AI Studio | https://aistudio.google.com/app/apikey | Recommended |
| Groq | https://console.groq.com | Optional |

### 2. Clone & Install

```bash
git clone https://github.com/nachiket7-dev/BuildX.git
cd buildx
npm run install:all
```

### 3. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
# Set at minimum:
#   NVIDIA_API_KEY=nvapi-...
#   GEMINI_API_KEY=AIzaSy...
#   DATABASE_URL=postgresql://user:password@localhost:5432/buildx
#   JWT_SECRET=<random 64-char hex>

cp frontend/.env.example frontend/.env
# Local dev: leave VITE_API_URL empty (Vite proxies /api → :3001)
```

### 4. Run Locally

```bash
npm run dev
# Backend → http://localhost:3001
# Frontend → http://localhost:5173
```

---

## 🤖 Integrated Model Suite

| Provider | Model ID | Stage Specialization |
|----------|----------|----------------------|
| **Moonshot AI** | `moonshotai/kimi-k2.6` | Auto-Fix & QA, Automated Self-Correction |
| **Z-AI** | `z-ai/glm-5.2` | Diff Generation, Code Patch Synthesis |
| **NVIDIA NIM** | `nvidia/nemotron-3-ultra-550b-a55b` | Architectural Planning & Spec Decomposition |
| **Google AI Studio** | `gemini-3.5-flash` | Ingestion, Component Layout & REST API Contracts |
| **Groq** | `qwen-3-32b` | Fast Single-Shot Fallbacks |

---

## 🛡️ Security

- Helmet.js secure header defaults
- Strict CORS allowlist (`ALLOWED_ORIGINS`)
- Rate limiting (200 req/min global, 10 req/min on AI endpoints)
- Zod schema validation on backend inputs and AI outputs
- JWT authentication + bcrypt password hashing
- Secure API key proxying (keys never exposed to client)
- Parameterised SQL query execution

---

## 📝 License

MIT
