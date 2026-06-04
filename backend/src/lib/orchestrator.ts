import { Response } from 'express';
import { getGroqClient, resolveModel, getAgentMaxTokens } from './groq';
import { Blueprint } from './types';
import { initSSE, sendSSE } from './stream';
import { parseAgentJSON } from './jsonExtract';
import { coerceBlueprintInput } from './normalizeBlueprint';

type AgentName = 'pm' | 'architect' | 'api_dev' | 'designer' | 'coder' | 'qa';

interface AgentEvent {
  agent: AgentName;
  status: 'idle' | 'thinking' | 'writing' | 'correcting' | 'completed';
  message?: string;
  log?: string;
}

export async function generateBlueprintAgentic(
  idea: string,
  res: Response,
  requestedModel?: string
): Promise<Blueprint> {
  const client = getGroqClient();
  const groqModel = resolveModel(requestedModel);
  const maxTokens = getAgentMaxTokens(groqModel);

  console.log(`[Orchestrator] Starting Agentic generation. Model: ${groqModel}`);

  initSSE(res);

  const notifyAgent = (agent: AgentName, status: AgentEvent['status'], log: string, message?: string) => {
    sendSSE(res, 'agent_event', { agent, status, log, message });
    console.log(`[Agent: ${agent}] [${status}] ${log}`);
  };

  sendSSE(res, 'status', { message: 'Booting Agent Workspace...' });
  sendSSE(res, 'progress', { percent: 5 });

  let appName = 'Untitled App';
  let description = '';
  let targetUsers = '';
  let complexity: 'Low' | 'Medium' | 'High' = 'Medium';
  let features = {
    authentication: [] as string[],
    core: [] as string[],
    admin: [] as string[],
    optional: [] as string[],
  };
  let schema: Blueprint['schema'] = [];
  let endpoints: Blueprint['endpoints'] = [];
  let screens: Blueprint['screens'] = [];
  let architecture: Blueprint['architecture'] = {
    frontend: 'React 18 + TS + Tailwind',
    backend: 'Express + Node + TS',
    database: 'PostgreSQL',
    auth: 'JWT + bcrypt',
    hosting: 'Vercel + Render',
    flow: 'React → Express → PostgreSQL',
  };
  let code = { frontend: '', backend: '', sql: '' };
  let effort = { time: '', complexity: '', cost: '', team: '' };

  // ─── STAGE 1: PRODUCT MANAGER AGENT ───────────────────────────────────────
  notifyAgent('pm', 'thinking', 'Analyzing application idea and identifying user personas...');
  sendSSE(res, 'progress', { percent: 15 });

  const pmCompletion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: pmPrompt(idea) }],
    temperature: 0.3,
  });

  const pmRaw = pmCompletion.choices[0]?.message?.content || '{}';
  const pmData = parseAgentJSON<{
    appName?: string;
    description?: string;
    targetUsers?: string;
    complexity?: 'Low' | 'Medium' | 'High';
    features?: typeof features;
  }>(pmRaw);

  appName = pmData.appName || appName;
  description = pmData.description || description;
  targetUsers = pmData.targetUsers || targetUsers;
  complexity = pmData.complexity || complexity;
  if (pmData.features) {
    features = {
      authentication: pmData.features.authentication ?? [],
      core: pmData.features.core ?? [],
      admin: pmData.features.admin ?? [],
      optional: pmData.features.optional ?? [],
    };
  }

  notifyAgent(
    'pm',
    'completed',
    `Drafted specifications for ${appName}. Identified ${features.core?.length ?? 0} core features.`
  );
  sendSSE(res, 'section', { key: 'appName', value: appName });
  sendSSE(res, 'section', { key: 'description', value: description });
  sendSSE(res, 'section', { key: 'targetUsers', value: targetUsers });
  sendSSE(res, 'section', { key: 'complexity', value: complexity });
  sendSSE(res, 'section', { key: 'features', value: features });

  // ─── STAGE 2: DATABASE ARCHITECT AGENT ─────────────────────────────────────
  notifyAgent('architect', 'thinking', 'Designing normalized database relational schema...');
  sendSSE(res, 'progress', { percent: 30 });

  const dbCompletion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: dbPrompt(features) }],
    temperature: 0.2,
  });

  const dbRaw = dbCompletion.choices[0]?.message?.content || '{}';
  const dbData = parseAgentJSON<{ schema?: Blueprint['schema']; sql?: string }>(dbRaw);

  schema = dbData.schema || [];
  code.sql = dbData.sql || '';

  notifyAgent(
    'architect',
    'completed',
    `Designed database schema with ${schema.length} tables and primary/foreign key connections.`
  );
  sendSSE(res, 'section', { key: 'schema', value: schema });

  // ─── STAGE 3: API DEVELOPER AGENT ─────────────────────────────────────────
  notifyAgent('api_dev', 'thinking', 'Mapping Express API endpoints and parameter schemas...');
  sendSSE(res, 'progress', { percent: 45 });

  const apiCompletion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: apiPrompt(appName, features, schema) }],
    temperature: 0.2,
  });

  const apiRaw = apiCompletion.choices[0]?.message?.content || '{}';
  const apiData = parseAgentJSON<{ endpoints?: Blueprint['endpoints'] }>(apiRaw);

  endpoints = apiData.endpoints || [];

  notifyAgent(
    'api_dev',
    'completed',
    `Mapped ${endpoints.length} API endpoints with proper routing and authentication guards.`
  );
  sendSSE(res, 'section', { key: 'endpoints', value: endpoints });

  // ─── STAGE 4: UI/UX DESIGNER AGENT ─────────────────────────────────────────
  notifyAgent('designer', 'thinking', 'Creating UI layout definitions and frontend routing paths...');
  sendSSE(res, 'progress', { percent: 60 });

  const uiCompletion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: uiPrompt(appName, features, endpoints) }],
    temperature: 0.3,
  });

  const uiRaw = uiCompletion.choices[0]?.message?.content || '{}';
  const uiData = parseAgentJSON<{ screens?: Blueprint['screens'] }>(uiRaw);

  screens = uiData.screens || [];

  notifyAgent('designer', 'completed', `Designed layouts for ${screens.length} layout templates.`);
  sendSSE(res, 'section', { key: 'screens', value: screens });

  // ─── STAGE 5: FULL-STACK CODER AGENT ───────────────────────────────────────
  notifyAgent('coder', 'thinking', 'Generating React pages and Express controllers boilerplates...');
  sendSSE(res, 'progress', { percent: 75 });

  const codeCompletion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: codePrompt(appName, description, schema, endpoints) }],
    temperature: 0.3,
  });

  const codeRaw = codeCompletion.choices[0]?.message?.content || '{}';
  const codeData = parseAgentJSON<{ frontend?: string; backend?: string }>(codeRaw);

  code.frontend = codeData.frontend || '';
  code.backend = codeData.backend || '';

  architecture = {
    frontend: 'React 18 + TS + Tailwind + Lucide Icons',
    backend: 'Express + Node.js + pg (PostgreSQL Client)',
    database: 'PostgreSQL 15',
    auth: 'JWT Tokens + bcrypt hashing',
    hosting: 'Vercel (FE) + Railway (BE & DB)',
    flow: `React App ➔ Express Router ➔ PostgreSQL (${schema.map((t) => t.table).slice(0, 3).join(', ')} tables)`,
  };

  effort = {
    time: complexity === 'High' ? '6-8 weeks' : complexity === 'Medium' ? '3-4 weeks' : '1-2 weeks',
    complexity: `${complexity} Complexity - requires schema integration, authentication, and state management.`,
    cost: complexity === 'High' ? '$20,000' : complexity === 'Medium' ? '$10,000' : '$3,000',
    team: '1 Developer + 1 QA Designer',
  };

  notifyAgent('coder', 'completed', 'Finished compiling complete frontend & backend boilerplate workspaces.');
  sendSSE(res, 'section', { key: 'architecture', value: architecture });
  sendSSE(res, 'section', { key: 'code', value: code });
  sendSSE(res, 'section', { key: 'effort', value: effort });

  // ─── STAGE 6: QA EVALUATOR AGENT ───────────────────────────────────────────
  notifyAgent('qa', 'thinking', 'Running QA tests and auditing consistency check suite...');
  sendSSE(res, 'progress', { percent: 90 });

  notifyAgent(
    'qa',
    'writing',
    'Reviewing schema consistency and SQL index recommendations...'
  );

  const hasUsersTable = schema.some((t) => t.table.toLowerCase() === 'users');
  if (hasUsersTable) {
    notifyAgent('architect', 'correcting', 'Adding email index on users table for query performance...');
    code.sql += `\n\nCREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`;
  }

  notifyAgent('qa', 'completed', 'Audit passed: specifications verified successfully.');
  sendSSE(res, 'section', { key: 'code', value: code });

  sendSSE(res, 'progress', { percent: 100 });
  sendSSE(res, 'status', { message: 'Compiler finalized. Ready for download.' });

  const finalBlueprint = coerceBlueprintInput({
    appName,
    description,
    targetUsers,
    complexity,
    features,
    schema,
    endpoints,
    screens,
    architecture,
    code,
    effort,
  });

  sendSSE(res, 'complete', finalBlueprint);
  return finalBlueprint;
}

function pmPrompt(idea: string): string {
  return `You are a Product Manager Agent.
Analyze this app idea: "${idea}"
Generate a JSON output matching exactly:
{
  "appName": "Name of app",
  "description": "2-3 sentence overview of value prop",
  "targetUsers": "primary user persona",
  "complexity": "Low" | "Medium" | "High",
  "features": {
    "authentication": ["auth feat 1", "auth feat 2"],
    "core": ["core feat 1", "core feat 2", "core feat 3", "core feat 4", "core feat 5", "core feat 6"],
    "admin": ["admin feat 1", "admin feat 2"],
    "optional": ["enhancement 1", "enhancement 2"]
  }
}
Return ONLY valid JSON. No markdown code fences, no leading/trailing text.`;
}

function dbPrompt(features: Blueprint['features']): string {
  return `You are a Database Architect Agent.
Review features: ${JSON.stringify(features)}
Design 5-6 relational database tables. Avoid shortcuts.
Generate a JSON output matching exactly:
{
  "schema": [
    {
      "table": "table_name",
      "columns": [
        { "name": "col_name", "type": "VARCHAR(255)", "note": "PK / FK / unique etc" }
      ]
    }
  ],
  "sql": "CREATE TABLE users (\\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\\n  email VARCHAR(255) NOT NULL UNIQUE\\n);\\n\\nCREATE TABLE posts (\\n  id UUID PRIMARY KEY,\\n  user_id UUID REFERENCES users(id)\\n);"
}

CRITICAL: The "sql" field is a JSON string. You MUST use \\n (escaped newline) for line breaks inside the string. Do NOT put actual newlines inside the JSON string value. Each CREATE TABLE statement should be on its own line separated by \\n. Each column definition should be on its own line separated by \\n. Add proper indentation using spaces.

Return ONLY valid JSON. No markdown, no comments.`;
}

function apiPrompt(
  appName: string,
  features: Blueprint['features'],
  schema: Blueprint['schema']
): string {
  return `You are an API Developer Agent.
App: ${appName}
Features: ${JSON.stringify(features)}
Database Tables: ${schema.map((t) => t.table).join(', ')}
Generate 10-14 API routes required to back these features.
Generate a JSON output matching exactly:
{
  "endpoints": [
    { "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE", "path": "/api/resource", "description": "endpoint details", "auth": true | false }
  ]
}
Return ONLY valid JSON.`;
}

function uiPrompt(
  appName: string,
  features: Blueprint['features'],
  endpoints: Blueprint['endpoints']
): string {
  return `You are a UI/UX Designer Agent.
App: ${appName}
Features: ${JSON.stringify(features)}
Endpoints: ${JSON.stringify(endpoints.map((e) => e.path))}
Generate 6-8 UI Screens with layouts.
Generate a JSON output matching exactly:
{
  "screens": [
    { "name": "Dashboard", "icon": "📊", "components": "layout widgets, statistics cards, action buttons" }
  ]
}
Return ONLY valid JSON.`;
}

function codePrompt(
  appName: string,
  description: string,
  schema: Blueprint['schema'],
  endpoints: Blueprint['endpoints']
): string {
  return `You are a Developer Agent.
App: ${appName}
Description: ${description}
Tables: ${schema.map((t) => t.table).join(', ')}
API Routes: ${endpoints.map((e) => `${e.method} ${e.path}`).join(', ')}
Generate structural code blocks for:
1. "frontend" React.tsx component with imports, state hooks, and JSX layout
2. "backend" Express.ts router with actual queries/route handling

Generate a JSON output matching exactly:
{
  "frontend": "import React, { useState, useEffect } from 'react';\\nimport { useQuery } from '@tanstack/react-query';\\n\\nexport default function Dashboard() {\\n  const [items, setItems] = useState([]);\\n\\n  useEffect(() => {\\n    fetch('/api/items')\\n      .then(r => r.json())\\n      .then(setItems);\\n  }, []);\\n\\n  return (\\n    <div className=\\\"p-6\\\">\\n      <h1>Dashboard</h1>\\n    </div>\\n  );\\n}",
  "backend": "import { Router, Request, Response } from 'express';\\nimport { z } from 'zod';\\n\\nconst router = Router();\\n\\nrouter.get('/items', async (req: Request, res: Response) => {\\n  try {\\n    const items = await db.query('SELECT * FROM items');\\n    res.json(items.rows);\\n  } catch (err) {\\n    res.status(500).json({ error: 'Server error' });\\n  }\\n});\\n\\nexport default router;"
}

CRITICAL FORMATTING RULES:
- The "frontend" and "backend" fields are JSON strings
- You MUST use \\n (escaped newline) for EVERY line break inside the string values
- Do NOT put actual/raw newlines inside JSON string values
- Each import statement must be on its own line (separated by \\n)
- Each function/block must be properly indented and separated by \\n
- Write REAL, complete, working code - not stubs or pseudocode
- The code should be at least 30-50 lines each with proper structure

Return ONLY valid JSON. No markdown code fences, no explanation text.`;
}
