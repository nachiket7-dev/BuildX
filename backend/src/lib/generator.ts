import { getGroqClient } from './groq';
import { Blueprint, BlueprintSchema } from './types';
import { Response } from 'express';
import {
  initSSE,
  sendSSE,
  endSSE,
  tryParsePartial,
  detectNewSections,
  SectionKey,
} from './stream';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are BuildX — an elite AI product architect, full-stack engineer, and UX designer.
Transform a plain-English app idea into a complete, actionable product blueprint.

CRITICAL RULES:
- Return ONLY a single valid JSON object
- No markdown code fences (no backtick blocks)
- No explanation text before or after the JSON
- No trailing commas in JSON
- Escape internal quotes in strings as \\"
- Use \\n for newlines inside code string values

Return exactly this JSON shape (fill every field with real, specific content for the given app idea):
{
  "appName": "concise product name",
  "description": "2-3 sentences: what it does, who its for, key value prop",
  "targetUsers": "specific user persona",
  "complexity": "Medium",
  "features": {
    "authentication": ["JWT signup/login", "OAuth Google", "Password reset via email", "Email verification"],
    "core": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5", "feature 6"],
    "admin": ["admin feature 1", "admin feature 2", "admin feature 3", "admin feature 4"],
    "optional": ["optional 1", "optional 2", "optional 3", "optional 4"]
  },
  "schema": [
    {
      "table": "users",
      "columns": [
        { "name": "id", "type": "UUID PRIMARY KEY DEFAULT gen_random_uuid()", "note": "PK" },
        { "name": "email", "type": "VARCHAR(255) NOT NULL UNIQUE", "note": "" },
        { "name": "password_hash", "type": "VARCHAR(255)", "note": "" },
        { "name": "created_at", "type": "TIMESTAMPTZ DEFAULT NOW()", "note": "" }
      ]
    }
  ],
  "endpoints": [
    { "method": "POST", "path": "/api/auth/signup", "description": "Register new user, returns JWT", "auth": false },
    { "method": "POST", "path": "/api/auth/login", "description": "Login with email and password", "auth": false },
    { "method": "GET", "path": "/api/auth/me", "description": "Get current authenticated user", "auth": true }
  ],
  "screens": [
    { "name": "Login", "icon": "🔐", "components": "Email/password form, OAuth buttons, forgot password link, error states, loading spinner" }
  ],
  "architecture": {
    "frontend": "React 18 + TypeScript + Vite + Tailwind CSS + React Query",
    "backend": "Node.js + Express + TypeScript + Zod",
    "database": "PostgreSQL 15 + Prisma ORM",
    "auth": "JWT access tokens (15m) + refresh tokens (7d) + bcrypt",
    "hosting": "Vercel (frontend) + Railway (backend + DB)",
    "flow": "React → Express API → PostgreSQL"
  },
  "code": {
    "frontend": "import React, { useState, useEffect } from 'react';\\n\\nexport default function Dashboard() {\\n  const [data, setData] = useState([]);\\n  useEffect(() => { fetch('/api/items').then(r => r.json()).then(setData); }, []);\\n  return <div>{JSON.stringify(data)}</div>;\\n}",
    "backend": "import { Router, Request, Response } from 'express';\\nimport { z } from 'zod';\\nconst router = Router();\\nrouter.get('/', async (req: Request, res: Response) => {\\n  try { res.json({ items: [] }); } catch (err) { res.status(500).json({ error: 'Server error' }); }\\n});\\nexport default router;",
    "sql": "CREATE EXTENSION IF NOT EXISTS pgcrypto;\\n\\nCREATE TABLE users (\\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\\n  email VARCHAR(255) NOT NULL UNIQUE,\\n  password_hash VARCHAR(255),\\n  created_at TIMESTAMPTZ DEFAULT NOW()\\n);"
  },
  "effort": {
    "time": "8-12 weeks with 2 developers",
    "complexity": "Medium — auth, CRUD, integrations required",
    "cost": "$12,000-$35,000 freelance",
    "team": "1 full-stack dev + 1 designer minimum"
  }
}

Requirements:
1. complexity must be exactly one of: Low, Medium, High
2. method values must be exactly one of: GET, POST, PUT, PATCH, DELETE
3. features.core must have at least 6 items specific to this app
4. schema must have 5-8 tables with proper columns and foreign keys
5. endpoints must have 12-20 routes covering all features
6. screens must have 6-10 screens with detailed component lists
7. code values must be real working code, not stubs`;

function extractJSON(raw: string): string {
  let cleaned = raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No valid JSON object found in AI response. Got: ' + cleaned.slice(0, 200));
  }
  return cleaned.slice(start, end + 1);
}

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type ValidMethod = typeof VALID_METHODS[number];

function safeMethod(m: unknown): ValidMethod {
  if (typeof m === 'string' && VALID_METHODS.includes(m as ValidMethod)) {
    return m as ValidMethod;
  }
  return 'GET';
}

function safeComplexity(c: unknown): 'Low' | 'Medium' | 'High' {
  if (c === 'Low' || c === 'Medium' || c === 'High') return c;
  return 'Medium';
}

function applyFallbacks(partial: Record<string, unknown>): Blueprint {
  const f = (partial.features as Record<string, unknown>) ?? {};
  const a = (partial.architecture as Record<string, unknown>) ?? {};
  const code = (partial.code as Record<string, unknown>) ?? {};
  const effort = (partial.effort as Record<string, unknown>) ?? {};
  const endpoints = Array.isArray(partial.endpoints) ? partial.endpoints : [];

  return {
    appName: String(partial.appName ?? 'Untitled App'),
    description: String(partial.description ?? 'No description provided.'),
    targetUsers: String(partial.targetUsers ?? 'General users'),
    complexity: safeComplexity(partial.complexity),
    features: {
      authentication: Array.isArray(f.authentication) ? f.authentication.map(String) : [],
      core: Array.isArray(f.core) ? f.core.map(String) : [],
      admin: Array.isArray(f.admin) ? f.admin.map(String) : [],
      optional: Array.isArray(f.optional) ? f.optional.map(String) : [],
    },
    schema: Array.isArray(partial.schema) ? partial.schema as Blueprint['schema'] : [],
    endpoints: endpoints.map((ep: Record<string, unknown>) => ({
      method: safeMethod(ep.method),
      path: String(ep.path ?? '/'),
      description: String(ep.description ?? ''),
      auth: Boolean(ep.auth),
    })),
    screens: Array.isArray(partial.screens) ? partial.screens as Blueprint['screens'] : [],
    architecture: {
      frontend: String(a.frontend ?? 'React + TypeScript'),
      backend: String(a.backend ?? 'Node.js + Express'),
      database: String(a.database ?? 'PostgreSQL'),
      auth: String(a.auth ?? 'JWT'),
      hosting: String(a.hosting ?? 'Vercel + Railway'),
      flow: String(a.flow ?? 'Frontend → API → Database'),
    },
    code: {
      frontend: String(code.frontend ?? '// No frontend code generated'),
      backend: String(code.backend ?? '// No backend code generated'),
      sql: String(code.sql ?? '-- No SQL generated'),
    },
    effort: {
      time: String(effort.time ?? 'Estimate unavailable'),
      complexity: String(effort.complexity ?? 'Medium'),
      cost: String(effort.cost ?? 'Contact for estimate'),
      team: String(effort.team ?? '2-3 developers'),
    },
  };
}

function parseAndValidate(rawText: string): Blueprint {
  const rawJSON = extractJSON(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJSON);
  } catch {
    console.error('[Groq] JSON.parse failed. Extracted (first 600):', rawJSON.slice(0, 600));
    throw new Error('AI returned malformed JSON. Please try again.');
  }

  const result = BlueprintSchema.safeParse(parsed);
  if (!result.success) {
    console.warn('[Groq] Zod issues (using fallbacks):', result.error.issues.slice(0, 5));
    return applyFallbacks(parsed as Record<string, unknown>);
  }

  return result.data;
}

// ─── Non-streaming generation (original) ──────────────────

export async function generateBlueprint(idea: string): Promise<Blueprint> {
  const client = getGroqClient();

  console.log(`[Groq] Calling ${GROQ_MODEL} for: "${idea.slice(0, 80)}"`);

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 6000,
    temperature: 0.4,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `App idea: ${idea}\n\nRespond with ONLY the JSON object. No markdown, no explanation.`,
      },
    ],
  });

  const rawText = completion.choices[0]?.message?.content;
  if (!rawText) {
    throw new Error('Groq returned an empty response. Please try again.');
  }

  const finishReason = completion.choices[0].finish_reason;
  console.log(`[Groq] ${rawText.length} chars received. Finish: ${finishReason}`);

  if (finishReason === 'length') {
    console.warn('[Groq] Response truncated — hit max_tokens. JSON may be incomplete.');
  }

  return parseAndValidate(rawText);
}

// ─── Streaming generation (SSE) ───────────────────────────

export async function generateBlueprintStream(
  idea: string,
  res: Response
): Promise<Blueprint> {
  const client = getGroqClient();

  console.log(`[Groq:stream] Calling ${GROQ_MODEL} for: "${idea.slice(0, 80)}"`);

  initSSE(res);
  sendSSE(res, 'status', { message: 'Connecting to AI model...' });

  const stream = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 6000,
    temperature: 0.4,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `App idea: ${idea}\n\nRespond with ONLY the JSON object. No markdown, no explanation.`,
      },
    ],
  });

  let buffer = '';
  let charCount = 0;
  let chunkIndex = 0;
  let lastParsed: Record<string, unknown> | null = null;
  const emittedSections = new Set<SectionKey>();

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (!content) continue;

    buffer += content;
    charCount += content.length;
    chunkIndex++;

    // Send progress every 5 chunks
    if (chunkIndex % 5 === 0) {
      sendSSE(res, 'progress', { chars: charCount });
    }

    // Try partial parse every 10 chunks to detect new sections
    if (chunkIndex % 10 === 0) {
      const partial = tryParsePartial(buffer);
      if (partial) {
        const newSections = detectNewSections(lastParsed, partial);
        for (const key of newSections) {
          if (!emittedSections.has(key)) {
            emittedSections.add(key);
            sendSSE(res, 'section', { key, value: partial[key] });
          }
        }
        lastParsed = partial;
      }
    }
  }

  console.log(`[Groq:stream] ${charCount} chars received.`);

  // Final parse and validate
  const blueprint = parseAndValidate(buffer);

  // Emit any sections that weren't caught during streaming
  sendSSE(res, 'complete', blueprint);

  return blueprint;
}
