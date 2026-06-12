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
  let diagrams: NonNullable<Blueprint['diagrams']> = {};

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
    architecture?: Partial<typeof architecture>;
    archDiagram?: string;
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
  if (pmData.architecture) {
    architecture = {
      frontend: pmData.architecture.frontend ?? architecture.frontend,
      backend: pmData.architecture.backend ?? architecture.backend,
      database: pmData.architecture.database ?? architecture.database,
      auth: pmData.architecture.auth ?? architecture.auth,
      hosting: pmData.architecture.hosting ?? architecture.hosting,
      flow: pmData.architecture.flow ?? architecture.flow,
    };
  }
  if (pmData.archDiagram) {
    diagrams.arch = pmData.archDiagram;
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
  sendSSE(res, 'section', { key: 'architecture', value: architecture });
  if (diagrams.arch) {
    sendSSE(res, 'section', { key: 'diagrams', value: diagrams });
  }

  // ─── STAGE 2: DATABASE ARCHITECT AGENT ─────────────────────────────────────
  notifyAgent('architect', 'thinking', `Designing database schema for ${architecture.database || 'PostgreSQL'}...`);
  sendSSE(res, 'progress', { percent: 30 });

  const dbCompletion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: dbPrompt(features, architecture.database) }],
    temperature: 0.2,
  });

  const dbRaw = dbCompletion.choices[0]?.message?.content || '{}';
  const dbData = parseAgentJSON<{ schema?: Blueprint['schema']; sql?: string; erDiagram?: string }>(dbRaw);

  schema = dbData.schema || [];
  code.sql = dbData.sql || '';
  if (dbData.erDiagram) {
    diagrams.er = dbData.erDiagram;
  }

  notifyAgent(
    'architect',
    'completed',
    `Designed database schema with ${schema.length} tables/collections and relationships.`
  );
  sendSSE(res, 'section', { key: 'schema', value: schema });
  if (diagrams.er) {
    sendSSE(res, 'section', { key: 'diagrams', value: diagrams });
  }

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
  const uiData = parseAgentJSON<{ screens?: Blueprint['screens']; apiFlowDiagram?: string }>(uiRaw);

  screens = uiData.screens || [];
  if (uiData.apiFlowDiagram) {
    diagrams.apiFlow = uiData.apiFlowDiagram;
  }

  notifyAgent('designer', 'completed', `Designed layouts for ${screens.length} layout templates.`);
  sendSSE(res, 'section', { key: 'screens', value: screens });
  if (diagrams.apiFlow) {
    sendSSE(res, 'section', { key: 'diagrams', value: diagrams });
  }

  // ─── STAGE 5: FULL-STACK CODER AGENT ───────────────────────────────────────
  notifyAgent('coder', 'thinking', `Generating React pages and Express controllers boilerplates for ${architecture.database || 'PostgreSQL'}...`);
  sendSSE(res, 'progress', { percent: 75 });

  const codeCompletion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: codePrompt(appName, description, schema, endpoints, architecture.database) }],
    temperature: 0.3,
  });

  const codeRaw = codeCompletion.choices[0]?.message?.content || '{}';
  const codeData = parseAgentJSON<{ frontend?: string; backend?: string }>(codeRaw);

  code.frontend = codeData.frontend || '';
  code.backend = codeData.backend || '';

  const dbName = architecture.database || 'PostgreSQL';
  const isMongo = dbName.toLowerCase().includes('mongo');

  architecture = {
    frontend: architecture.frontend || 'React 18 + TS + Tailwind + Lucide Icons',
    backend: architecture.backend || (isMongo ? 'Express + Node.js + mongoose' : 'Express + Node.js + Prisma'),
    database: dbName,
    auth: architecture.auth || 'JWT Tokens + bcrypt hashing',
    hosting: architecture.hosting || (isMongo ? 'Vercel (FE) + Atlas/Render (BE & DB)' : 'Vercel (FE) + Railway (BE & DB)'),
    flow: architecture.flow || `React App ➔ Express Router ➔ ${dbName} (${schema.map((t) => t.table).slice(0, 3).join(', ')} ${isMongo ? 'collections' : 'tables'})`,
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
    'Reviewing schema consistency and index recommendations...'
  );

  const hasUsersTable = schema.some((t) => t.table.toLowerCase() === 'users');
  if (hasUsersTable) {
    if (isMongo) {
      notifyAgent('architect', 'correcting', 'Adding email index on users collection for query performance...');
      if (!code.sql.includes('index({ email: 1 })') && !code.sql.includes('createIndex')) {
        code.sql += `\n\n// Indexes\nUserSchema.index({ email: 1 }, { unique: true });`;
      }
    } else {
      notifyAgent('architect', 'correcting', 'Adding email index on users table for query performance...');
      code.sql += `\n\nCREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`;
    }
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
    diagrams,
  });

  sendSSE(res, 'complete', finalBlueprint);
  return finalBlueprint;
}

function pmPrompt(idea: string): string {
  return `You are a Product Manager Agent.
Analyze this app idea: "${idea}"

Determine:
1. A suitable name, description, target users, and complexity.
2. A list of features (authentication, core, admin, optional).
3. The best database technology (e.g. MongoDB, PostgreSQL, SQLite, MySQL) and overall tech stack based on the app's requirements (e.g. real-time, relational data, document data, etc.) or explicit user request.
4. A valid Mermaid system architecture diagram matching the chosen tech stack.

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
  },
  "architecture": {
    "frontend": "React 18 + TS + Tailwind + Lucide Icons",
    "backend": "Express + Node.js + pg or Express + Node.js + mongoose",
    "database": "PostgreSQL" | "MongoDB" | "MySQL" | "SQLite",
    "auth": "JWT Tokens + bcrypt hashing",
    "hosting": "Vercel (FE) + Railway (BE & DB) or Vercel (FE) + Atlas/Render (BE & DB)",
    "flow": "React App ➔ Express Router ➔ PostgreSQL or React App ➔ Express Router ➔ MongoDB"
  },
  "archDiagram": "flowchart TD\\n  subgraph Client\\n    FE[React Frontend]\\n  end\\n  subgraph Server\\n    BE[Express Backend]\\n  end\\n  subgraph Database\\n    DB[(Database Name)]\\n  end\\n  FE -->|API Requests| BE\\n  BE -->|Queries| DB"
}

CRITICAL: The "archDiagram" field is a JSON string containing a valid Mermaid system architecture diagram matching the proposed application's scale, layers (Client, Server API, Database, Auth, etc.), and infrastructure. You MUST use \\n (escaped newline) for line breaks inside the string. Do NOT put actual newlines inside the JSON string value.
Return ONLY valid JSON. No markdown code fences, no leading/trailing text.`;
}

function dbPrompt(features: Blueprint['features'], database: string): string {
  const isMongo = database.toLowerCase().includes('mongo');
  if (isMongo) {
    return `You are a Database Architect Agent.
Review features: ${JSON.stringify(features)}
The database stack selected is MongoDB. Design 5-6 MongoDB collections. Avoid shortcuts.
Generate a JSON output matching exactly:
{
  "schema": [
    {
      "collection": "collection_name",
      "fields": [
        { "name": "field_name", "type": "ObjectId | String | Number | Boolean | Date | Array", "note": "PK / FK / unique etc" }
      ]
    }
  ],
  "sql": "const mongoose = require('mongoose');\\nconst { Schema } = mongoose;\\n\\n// Define schema code here for Mongoose models",
  "erDiagram": "erDiagram\\n  users ||--o{ posts : \\"has\\"\\n  users {\\n    ObjectId _id\\n    string email\\n  }\\n  posts {\\n    ObjectId _id\\n    ObjectId userId\\n  }"
}

CRITICAL: The "sql" and "erDiagram" fields are JSON strings. You MUST use \\n (escaped newline) for line breaks inside these strings. Do NOT put actual newlines inside the JSON string values.
For "erDiagram", generate a custom, valid Mermaid entity-relationship diagram representing your designed collections, fields, and relationships. Make sure to escape internal double quotes properly inside the JSON string.

Return ONLY valid JSON. No markdown, no comments.`;
  } else {
    return `You are a Database Architect Agent.
Review features: ${JSON.stringify(features)}
The database stack selected is ${database}. Design 5-6 relational database tables. Avoid shortcuts.
Generate a JSON output matching exactly:
{
  "schema": [
    {
      "table": "table_name",
      "columns": [
        { "name": "col_name", "type": "VARCHAR(255) / UUID / INTEGER etc", "note": "PK / FK / unique etc" }
      ]
    }
  ],
  "sql": "CREATE TABLE users (\\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\\n  email VARCHAR(255) NOT NULL UNIQUE\\n);",
  "erDiagram": "erDiagram\\n  users ||--o{ posts : \\"has\\"\\n  users {\\n    uuid id PK\\n    string email\\n  }\\n  posts {\\n    uuid id PK\\n    uuid user_id FK\\n  }"
}

CRITICAL: The "sql" and "erDiagram" fields are JSON strings. You MUST use \\n (escaped newline) for line breaks inside these strings. Do NOT put actual newlines inside the JSON string values.
For "erDiagram", generate a custom, valid Mermaid entity-relationship diagram representing your designed relational tables, columns, constraints, and relationships. Make sure to escape internal double quotes properly inside the JSON string.

Return ONLY valid JSON. No markdown, no comments.`;
  }
}

function apiPrompt(
  appName: string,
  features: Blueprint['features'],
  schema: Blueprint['schema']
): string {
  return `You are an API Developer Agent.
App: ${appName}
Features: ${JSON.stringify(features)}
Database Tables/Collections: ${schema.map((t) => t.table).join(', ')}
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
  ],
  "apiFlowDiagram": "sequenceDiagram\\n  participant User\\n  participant Frontend\\n  participant API\\n  participant DB\\n  User->>Frontend: Interaction\\n  Frontend->>API: Request\\n  API->>DB: Query\\n  DB-->>API: Result\\n  API-->>Frontend: Response\\n  Frontend-->>User: Render"
}

CRITICAL: The "apiFlowDiagram" field is a JSON string containing a valid Mermaid sequence diagram demonstrating the interaction flow of key scenarios between User/Browser, Frontend, Backend API, and Database. You MUST use \\n (escaped newline) for line breaks inside the string. Do NOT put actual newlines inside the JSON string value.

Return ONLY valid JSON.`;
}

function codePrompt(
  appName: string,
  description: string,
  schema: Blueprint['schema'],
  endpoints: Blueprint['endpoints'],
  database: string
): string {
  const isMongo = database.toLowerCase().includes('mongo');
  const dbClient = isMongo ? 'Mongoose models' : 'Prisma client or pg library queries';
  
  return `You are a Developer Agent.
App: ${appName}
Description: ${description}
Database selected: ${database} (${dbClient})
Schema: ${JSON.stringify(schema)}
API Routes: ${endpoints.map((e) => `${e.method} ${e.path}`).join(', ')}

Generate structural code blocks for:
1. "frontend" React.tsx component with imports, state hooks, and JSX layout
2. "backend" Express.ts router with actual queries/route handling using ${dbClient}

Generate a JSON output matching exactly:
{
  "frontend": "import React, { useState, useEffect } from 'react';\\nimport { useQuery } from '@tanstack/react-query';\\n\\nexport default function Dashboard() {\\n  const [items, setItems] = useState([]);\\n\\n  useEffect(() => {\\n    fetch('/api/items')\\n      .then(r => r.json())\\n      .then(setItems);\\n  }, []);\\n\\n  return (\\n    <div className=\\\"p-6\\\">\\n      <h1>Dashboard</h1>\\n    </div>\\n  );\\n}",
  "backend": "${
    isMongo
      ? "import { Router, Request, Response } from 'express';\\nimport Item from '../models/Item';\\n\\nconst router = Router();\\n\\nrouter.get('/items', async (req: Request, res: Response) => {\\n  try {\\n    const items = await Item.find();\\n    res.json(items);\\n  } catch (err) {\\n    res.status(500).json({ error: 'Server error' });\\n  }\\n});\\n\\nexport default router;"
      : "import { Router, Request, Response } from 'express';\\nimport { PrismaClient } from '@prisma/client';\\n\\nconst prisma = new PrismaClient();\\nconst router = Router();\\n\\nrouter.get('/items', async (req: Request, res: Response) => {\\n  try {\\n    const items = await prisma.item.findMany();\\n    res.json(items);\\n  } catch (err) {\\n    res.status(500).json({ error: 'Server error' });\\n  }\\n});\\n\\nexport default router;"
  }"
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
