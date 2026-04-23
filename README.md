# ⚡ BuildX — AI App Architect

> Turn any app idea into a complete full-stack blueprint in seconds.

BuildX is a production-ready full-stack application powered by **Groq + Llama 3.3 70B** (free tier). Describe your app idea in plain English and instantly get a complete product blueprint: database schema, REST API endpoints, UI screens, architecture decisions, real starter code, and effort estimates.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | TanStack React Query v5 |
| Backend | Node.js + Express + TypeScript |
| Validation | Zod (backend input + AI output) |
| AI | Groq API · Llama 3.3 70B (FREE) |
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
│   │   │   ├── anthropic.ts    # Groq client (OpenAI-compatible)
│   │   │   ├── generator.ts    # Blueprint AI generation + fallbacks
│   │   │   └── types.ts        # Zod schemas + TypeScript types
│   │   └── routes/
│   │       └── blueprint.ts    # POST /api/blueprint/generate
│   ├── .env.example
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Hero.tsx              # Idea input + example chips
│   │   │   ├── LoadingScreen.tsx     # Animated step progress
│   │   │   ├── BlueprintOutput.tsx   # Tab orchestrator
│   │   │   ├── BlueprintPanels.tsx   # 7 tab panels
│   │   │   ├── TabBar.tsx
│   │   │   ├── Logo.tsx
│   │   │   └── ErrorBanner.tsx
│   │   ├── hooks/
│   │   │   └── useBlueprint.ts       # React Query mutation hook
│   │   └── lib/
│   │       ├── api.ts                # Axios client
│   │       ├── types.ts              # Shared TS interfaces
│   │       └── utils.ts             # Helpers + example ideas
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
# GROQ_API_KEY=gsk_your_key_here

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
| `PORT` | No | Server port (default: `3001`) |
| `NODE_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGINS` | No | CORS origin allowlist (default: `http://localhost:5173`) |

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend URL in production. Leave empty for local dev |

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
   - `ALLOWED_ORIGINS`: your Vercel frontend URL
   - `JWT_SECRET`: a random secure string for tokens

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com), set root to `frontend`
2. Add env var: `VITE_API_URL` = your Railway backend URL
3. Deploy — Vercel auto-detects Vite

---

## 🔌 API

### `POST /api/blueprint/generate`
```json
// Request
{ "idea": "A food delivery app with restaurant listings and Stripe payments" }

// Response
{ "success": true, "data": { "appName": "...", "schema": [...], ... } }
```
Rate limited: **5 requests/minute** per IP.

### `GET /health` — server health
### `GET /api/blueprint/health` — checks Groq key is configured

---

## 🛡️ Security

- Helmet.js secure headers
- Strict CORS allowlist
- Rate limiting (20/min global, 5/min on AI endpoint)
- Zod validation on all inputs and AI outputs
- API key never exposed to the frontend

---

## 📝 License

MIT
# BuildX
