import { getLLMProvider, getMaxTokensForModel } from './llm/router';
import { extractJSON } from './jsonExtract';
import { Blueprint, BlueprintSchema } from './types';
import { Response } from 'express';
import { coerceBlueprintInput } from './normalizeBlueprint';
import {
  initSSE,
  sendSSE,
  endSSE,
  tryParsePartial,
  detectNewSections,
  SectionKey,
} from './stream';

const SYSTEM_PROMPT = `You are BuildX — an elite AI product architect, full-stack engineer, and UX designer.
Transform a plain-English app idea into a complete, actionable product blueprint.

CRITICAL RULES:
- Return ONLY a single valid JSON object
- No markdown code fences (no backtick blocks)
- No explanation text before or after the JSON
- No trailing commas in JSON
- Escape internal quotes in strings as \\"
- Use \\n for newlines inside code string values

Return exactly this JSON shape (fill every field with real, specific content for the given app idea, choosing the database technology like MongoDB or PostgreSQL dynamically depending on user request or app needs):
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
        { "name": "id", "type": "UUID PRIMARY KEY DEFAULT gen_random_uuid() (for SQL) OR ObjectId (for MongoDB)", "note": "PK" },
        { "name": "email", "type": "VARCHAR(255) NOT NULL UNIQUE (for SQL) OR String (for MongoDB)", "note": "" }
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
    "database": "PostgreSQL 15 + Prisma ORM OR MongoDB + Mongoose OR SQLITE",
    "auth": "JWT access tokens (15m) + refresh tokens (7d) + bcrypt",
    "hosting": "Vercel (frontend) + Railway (backend + DB) OR Vercel (FE) + Atlas/Render (BE & DB)",
    "flow": "React → Express API → Database"
  },
  "code": {
    "frontend": "import React, { useState, useEffect } from 'react';\\n\\nexport default function Dashboard() {\\n  const [data, setData] = useState([]);\\n  useEffect(() => { fetch('/api/items').then(r => r.json()).then(setData); }, []);\\n  return <div>{JSON.stringify(data)}</div>;\\n}",
    "backend": "import { Router, Request, Response } from 'express';\\nconst router = Router();\\nrouter.get('/', async (req: Request, res: Response) => {\\n  try { res.json({ items: [] }); } catch (err) { res.status(500).json({ error: 'Server error' }); }\\n});\\nexport default router;",
    "sql": "CREATE TABLE ... (for SQL) OR Mongoose schema definitions (for MongoDB)"
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
4. schema must have 5-8 tables/collections with proper columns/fields
5. endpoints must have 12-20 routes covering all features
6. screens must have 6-10 screens with detailed component lists
7. code values must be real working code (SQL or Mongo-appropriate based on database architecture chosen)
8. Choose database (MongoDB, PostgreSQL, MySQL, SQLite etc.) dynamically depending on the prompt or technology request.
9. Adjust code.sql and schema format accordingly (use collections/fields for MongoDB, tables/columns for SQL)`;

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

function parseAndValidate(rawText: string): Blueprint {
  const rawJSON = extractJSON(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJSON);
  } catch {
    console.error('[Groq] JSON.parse failed. Extracted (first 600):', rawJSON.slice(0, 600));
    throw new Error('AI returned malformed JSON. Please try again.');
  }

  return coerceBlueprintInput(parsed);
}

// ─── Non-streaming generation (original) ──────────────────

const FALLBACK_MODELS = ['gemini-3.5-flash', 'gpt-oss-120b', 'nemotron-3-550b'];

export async function generateBlueprint(idea: string, requestedModel?: string): Promise<Blueprint> {
  const modelsToTry = requestedModel
    ? [requestedModel, ...FALLBACK_MODELS.filter((m) => m !== requestedModel)]
    : FALLBACK_MODELS;

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const provider = getLLMProvider(model);
      const maxTokens = getMaxTokensForModel(model);

      console.log(`[LLM] Trying model=${model} | max_tokens=${maxTokens} | ideaLength=${idea.length}`);

      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        {
          role: 'user' as const,
          content: `App idea: ${idea}\n\nRespond with ONLY the JSON object. No markdown, no explanation.`,
        },
      ];

      const rawText = await provider.complete(messages, { temperature: 0.4, maxTokens });
      if (!rawText) {
        throw new Error('LLM returned an empty response. Please try again.');
      }

      console.log(`[LLM] ${rawText.length} chars received.`);

      try {
        return parseAndValidate(rawText);
      } catch (firstErr) {
        console.warn(`[LLM] JSON parse failed for ${model}, retrying with temperature: 0`);
        const retryText = await provider.complete(messages, { temperature: 0, maxTokens });
        if (!retryText) throw firstErr;
        return parseAndValidate(retryText);
      }
    } catch (err) {
      console.error(`[LLM] Failed generation using model ${model}:`, (err as Error).message);
      lastError = err as Error;
      console.log('[LLM] Attempting fallback to next model...');
    }
  }

  throw lastError || new Error('All model attempts failed');
}

// ─── Streaming generation (SSE) ───────────────────────────

export async function generateBlueprintStream(
  idea: string,
  res: Response,
  requestedModel?: string
): Promise<Blueprint> {
  const provider = getLLMProvider(requestedModel);
  const maxTokens = getMaxTokensForModel(requestedModel);

  console.log(`[LLM:stream] model=${requestedModel || 'default'} | max_tokens=${maxTokens} | ideaLength=${idea.length}`);

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `App idea: ${idea}\n\nRespond with ONLY the JSON object. No markdown, no explanation.`,
    },
  ];

  initSSE(res);
  sendSSE(res, 'status', { message: 'Connecting to AI model...' });

  let buffer = '';
  let charCount = 0;
  let chunkIndex = 0;
  let lastParsed: Record<string, unknown> | null = null;
  const emittedSections = new Set<SectionKey>();

  for await (const content of provider.stream(messages, { temperature: 0.4, maxTokens })) {
    if (!content) continue;

    buffer += content;
    charCount += content.length;
    chunkIndex++;

    // Strip <think> blocks from buffer for partial parsing
    const cleanedBuffer = buffer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Send progress every 5 chunks
    if (chunkIndex % 5 === 0) {
      sendSSE(res, 'progress', { chars: charCount });
    }

    // Try partial parse every 10 chunks to detect new sections
    if (chunkIndex % 10 === 0) {
      const partial = tryParsePartial(cleanedBuffer);
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

  console.log(`[LLM:stream] ${charCount} chars received.`);

  // Final parse and validate — auto-retry once with temperature: 0 if parsing fails
  let blueprint: Blueprint;
  try {
    blueprint = parseAndValidate(buffer);
  } catch (firstErr) {
    console.warn('[LLM:stream] JSON parse failed, retrying with temperature: 0');
    sendSSE(res, 'status', { message: 'Retrying with higher precision...' });
    const retryText = await provider.complete(messages, { temperature: 0, maxTokens });
    if (!retryText) throw firstErr;
    blueprint = parseAndValidate(retryText);
  }

  // Emit any sections that weren't caught during streaming
  sendSSE(res, 'complete', blueprint);

  return blueprint;
}
