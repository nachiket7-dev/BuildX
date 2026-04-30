# ⚡ BuildX — AI App Architect

> Turn any app idea into a complete full-stack blueprint in seconds.

BuildX is a production-ready full-stack application powered by **Groq's multi-model API** (free tier). Choose from Llama 3.3 70B, Llama 3.1 8B, Qwen 3 32B, or OpenAI GPT-OSS 120B. Describe your app idea in plain English and instantly get a complete product blueprint: database schema, REST API endpoints, UI screens, architecture decisions, real starter code, and effort estimates.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | TanStack React Query v5 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| Validation | Zod (backend input + AI output) |
| AI | Groq API · Multi-Model (Llama, Qwen, GPT-OSS) |
| Auth | JWT + bcrypt |
| Deploy FE | Vercel |
| Deploy BE | Render |

---

## 📁 Project Structure

```
buildx/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express: cors, helmet, rate limiting
│   │   ├── index.ts            # Server entry
│   │   ├── lib/
│   │   │   ├── auth.ts         # JWT middleware (requireAuth, optionalAuth)
│   │   │   ├── db.ts           # PostgreSQL queries + migrations
│   │   │   ├── generator.ts    # Blueprint AI generation + auto-retry
│   │   │   ├── groq.ts         # Groq client (OpenAI-compatible)
│   │   │   ├── refine.ts       # Blueprint refinement via chat
│   │   │   ├── scaffold.ts     # ZIP project export
│   │   │   ├── stream.ts       # SSE streaming helpers
│   │   │   └── types.ts        # Zod schemas + TypeScript types
│   │   └── routes/
│   │       ├── auth.ts         # Signup, login, user blueprints
│   │       └── blueprint.ts    # Generate, stream, export, refine, visibility
│   ├── .env.example
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Hero.tsx              # Idea input + model selector + example chips
│   │   │   ├── StreamingView.tsx     # Animated streaming progress
│   │   │   ├── BlueprintOutput.tsx   # Tab orchestrator + model badge + visibility toggle
│   │   │   ├── BlueprintPanels.tsx   # 7 tab panels (features, schema, API, UI, arch, code, effort)
│   │   │   ├── DiagramsPanel.tsx     # Mermaid ER/architecture/API flow diagrams
│   │   │   ├── RefinementChat.tsx    # Floating chat for blueprint refinement
│   │   │   ├── GalleryPage.tsx       # Public blueprint gallery
│   │   │   ├── Sidebar.tsx           # User blueprint history
│   │   │   ├── AuthModal.tsx         # Login/signup modal
│   │   │   ├── TabBar.tsx
│   │   │   ├── Logo.tsx
│   │   │   └── ErrorBanner.tsx
│   │   ├── hooks/
│   │   │   ├── useStreamBlueprint.ts # SSE streaming hook
│   │   │   ├── useBlueprint.ts       # React Query mutation hook
│   │   │   ├── useAuth.ts            # Auth context + JWT management
│   │   │   ├── useModel.tsx          # Model selection state
│   │   │   └── useRefinement.ts      # Chat refinement hook
│   │   └── lib/
│   │       ├── api.ts                # API client (axios + SSE fetch)
│   │       ├── types.ts              # Shared TS interfaces
│   │       ├── utils.ts              # Helpers + example ideas
│   │       └── diagrams.ts           # Mermaid diagram generators
│   ├── .env.example
│   ├── vercel.json
│   └── vite.config.ts               # Dev proxy → backend
│
└── package.json                     # Monorepo with npm workspaces
```

---

## 🚀 Getting Started

### 1. Get a free Groq API key

1. Go to **https://console.groq.com**
2. Sign up (free, no credit card needed)
3. Click **API Keys → Create API Key**
4. Copy the key — it starts with `gsk_`

### 2. Clone and install

```bash
git clone https://github.com/yourname/buildx.git
cd buildx
npm run install:all
```

### 3. Configure

```bash
cp backend/.env.example backend/.env
# Open backend/.env and set:
#   GROQ_API_KEY=gsk_your_key_here
#   DATABASE_URL=postgresql://user:password@localhost:5432/buildx
#   JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

cp frontend/.env.example frontend/.env
# No changes needed for local dev
```

### 4. Run

```bash
npm run dev
# Backend → http://localhost:3001
# Frontend → http://localhost:5173
```

---

## 🔧 Environment Variables

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Free key from https://console.groq.com |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Random secret for signing auth tokens (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `PORT` | No | Server port (default: `3001`) |
| `NODE_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGINS` | ✅ Production | CORS origin allowlist. Default: `http://localhost:5173`. **In production:** set to your Vercel frontend URL |

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ Production | Backend URL in production (e.g. `https://buildx-api.onrender.com`). Leave empty for local dev |

---

## 🌐 Deployment

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repository
3. Set **Root Directory** to `backend`
4. Set **Environment** to `Node`
5. Set **Build Command** to `npm install && npm run build`
6. Set **Start Command** to `npm start`
7. Add Environment Variables:
   - `GROQ_API_KEY`: your key from Groq
   - `DATABASE_URL`: your PostgreSQL connection string
   - `JWT_SECRET`: a random secure string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `ALLOWED_ORIGINS`: your Vercel frontend URL (e.g. `https://buildx.vercel.app`)
   - `NODE_ENV`: `production`

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com), set root to `frontend`
2. Add env var: `VITE_API_URL` = your Render backend URL (e.g., `https://buildx-api.onrender.com`)
3. Deploy — Vercel auto-detects Vite

---

## 🔌 API

### `POST /api/blueprint/generate`
```json
// Request
{ "idea": "A food delivery app with restaurant listings and Stripe payments", "model": "llama-3.3-70b" }

// Response
{ "success": true, "data": { "appName": "...", "schema": [...], ... }, "id": "abc123" }
```

### `POST /api/blueprint/generate-stream` — SSE streaming generation
### `POST /api/blueprint/refine` — Refine an existing blueprint via chat
### `POST /api/blueprint/export` — Download project scaffold as ZIP
### `PATCH /api/blueprint/:id/visibility` — Toggle public/private (auth required)
### `GET /api/blueprint/list` — Public blueprint gallery
### `GET /api/blueprint/:id` — Fetch a saved blueprint
### `GET /health` — Server health check
### `GET /api/blueprint/health` — Checks Groq key is configured

Rate limited: **10 AI generations/minute** per IP.

---

## 🤖 Available Models

| Model ID | Display Name | Daily Limit |
|----------|-------------|-------------|
| `llama-3.3-70b` | Llama 3.3 70B | Unlimited |
| `llama-3.1-8b` | Llama 3.1 8B | Unlimited |
| `qwen-3-32b` | Qwen 3 32B | Unlimited |
| `gpt-oss-120b` | GPT-OSS 120B | 5/day (login required) |

---

## 🛡️ Security

- Helmet.js secure headers
- Strict CORS allowlist (configurable via `ALLOWED_ORIGINS`)
- Rate limiting (200/min global, 10/min on AI endpoints)
- Zod validation on all inputs and AI outputs
- JWT authentication with bcrypt password hashing
- API key never exposed to the frontend
- All SQL queries use parameterised statements
- Blueprint visibility controls (public/private)

---

## 📝 License

MIT
