import archiver from 'archiver';
import { Response } from 'express';
import type { Blueprint } from './types';
import { isPlausibleSourceCode } from './codegen/skeletonizer';

// ─── Helpers ───────────────────────────────────────────────

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .replace(/[\s_\-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** Map SQL types to Prisma scalar types */
function sqlTypeToPrisma(sqlType: string, isMongo: boolean): string {
  const t = sqlType.toUpperCase();
  if (t.includes('UUID')) return isMongo ? 'String' : 'String @default(uuid())';
  if (t.includes('SERIAL') || t.includes('BIGSERIAL')) return isMongo ? 'Int' : 'Int @default(autoincrement())';
  if (t.includes('INT')) return 'Int';
  if (t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('NUMERIC'))
    return 'Float';
  if (t.includes('BOOL')) return 'Boolean';
  if (t.includes('TIMESTAMP') || t.includes('DATE')) return 'DateTime';
  if (t.includes('JSON')) return isMongo ? 'Json' : 'Json'; // Json is supported on both
  if (t.includes('TEXT')) return 'String';
  if (t.includes('VARCHAR')) return 'String';
  return 'String';
}

function isPrimaryKey(col: { name: string; type: string; note?: string }): boolean {
  const t = (col.type + ' ' + (col.note || '')).toUpperCase();
  return t.includes('PRIMARY KEY') || t.includes('PK');
}

// ─── File generators ───────────────────────────────────────

function generateRootPackageJson(bp: Blueprint): string {
  const name = toKebabCase(bp.appName);
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      description: bp.description,
      scripts: {
        'dev:backend': 'cd backend && npm run dev',
        'dev:frontend': 'cd frontend && npm run dev',
        dev: 'concurrently "npm run dev:backend" "npm run dev:frontend"',
        install: 'cd backend && npm install && cd ../frontend && npm install',
      },
      devDependencies: {
        concurrently: '^8.2.2',
      },
    },
    null,
    2
  );
}

function generateBackendPackageJson(bp: Blueprint): string {
  const name = toKebabCase(bp.appName) + '-backend';
  const isMongo = bp.architecture.database.toLowerCase().includes('mongo');
  const isSupabase = bp.architecture.database.toLowerCase().includes('supabase');
  const isFastify = bp.architecture.backend.toLowerCase().includes('fastify');
  const isClerk = bp.architecture.auth.toLowerCase().includes('clerk');
  const isNextAuth = bp.architecture.auth.toLowerCase().includes('nextauth') || bp.architecture.auth.toLowerCase().includes('auth.js');
  
  const dependencies: Record<string, string> = {
    dotenv: '^16.3.1',
    zod: '^3.22.4',
    // The generated route modules use the Express Router contract for every
    // stack, so keep the runtime dependency present even when Fastify is also
    // requested as an integration option.
    express: '^4.18.2',
    cors: '^2.8.5',
    helmet: '^7.1.0',
  };
  
  const devDependencies: Record<string, string> = {
    '@types/node': '^20.10.0',
    'ts-node-dev': '^2.0.0',
    typescript: '^5.3.2',
    '@types/express': '^4.17.21',
    '@types/cors': '^2.8.17',
  };

  if (isFastify) {
    dependencies['fastify'] = '^4.25.0';
    dependencies['@fastify/cors'] = '^9.0.0';
    dependencies['@fastify/helmet'] = '^11.1.1';
  }

  if (isMongo) {
    dependencies['mongoose'] = '^8.0.0';
  } else if (isSupabase) {
    dependencies['@supabase/supabase-js'] = '^2.39.0';
    dependencies['@prisma/client'] = '^5.7.0';
    devDependencies['prisma'] = '^5.7.0';
  } else {
    dependencies['@prisma/client'] = '^5.7.0';
    devDependencies['prisma'] = '^5.7.0';
  }

  if (isClerk) {
    dependencies['@clerk/clerk-sdk-node'] = '^4.13.0';
  } else if (isNextAuth) {
    dependencies['next-auth'] = '^4.24.5';
  } else {
    dependencies['jsonwebtoken'] = '^9.0.2';
    dependencies['bcryptjs'] = '^2.4.3';
    devDependencies['@types/jsonwebtoken'] = '^9.0.5';
    devDependencies['@types/bcryptjs'] = '^2.4.6';
  }

  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'ts-node-dev --respawn --transpile-only src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
      },
      dependencies,
      devDependencies,
    },
    null,
    2
  );
}

function generateBackendTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2
  );
}

function generatePrismaSchema(bp: Blueprint): string {
  const isMongo = bp.architecture.database.toLowerCase().includes('mongo');
  const provider = isMongo ? 'mongodb' : 'postgresql';
  let schema = `// Prisma schema generated by BuildX
// https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`;

  for (const table of bp.schema) {
    const modelName = toPascalCase(table.table);
    schema += `\nmodel ${modelName} {\n`;

    for (const col of table.columns) {
      const fieldName = toCamelCase(col.name);
      let prismaType = sqlTypeToPrisma(col.type, isMongo);

      // Handle primary key
      if (isPrimaryKey(col)) {
        if (isMongo) {
          prismaType = 'String @id @default(auto()) @map("_id") @db.ObjectId';
        } else {
          prismaType = prismaType.includes('@default')
            ? prismaType + ' @id'
            : prismaType + ' @id @default(autoincrement())';
        }
      }

      // Handle unique
      if (col.type.toUpperCase().includes('UNIQUE')) {
        prismaType += ' @unique';
      }

      // Handle NOT NULL — Prisma fields are required by default, add ? for nullable
      const isRequired = col.type.toUpperCase().includes('NOT NULL') || isPrimaryKey(col);
      const typeStr = isRequired ? prismaType : prismaType + '?';

      // Handle default timestamps
      if (col.type.toUpperCase().includes('DEFAULT NOW()') || col.type.toUpperCase().includes('DEFAULT CURRENT_TIMESTAMP')) {
        schema += `  ${fieldName.padEnd(20)} DateTime  @default(now())\n`;
      } else {
        schema += `  ${fieldName.padEnd(20)} ${typeStr}\n`;
      }
    }

    schema += '}\n';
  }

  return schema;
}

function generateBackendIndex(bp: Blueprint): string {
  const isFastify = bp.architecture.backend.toLowerCase().includes('fastify');
  if (isFastify) {
    return `import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => console.log(\`\\n⚡ ${bp.appName} API running on http://localhost:\${PORT}\\n\`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
`;
  }

  return `import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(\`\\n⚡ ${bp.appName} API running on http://localhost:\${PORT}\`);
  console.log(\`   ENV: \${process.env.NODE_ENV || 'development'}\\n\`);
});
`;
}

function generateBackendApp(bp: Blueprint): string {
  const isFastify = bp.architecture.backend.toLowerCase().includes('fastify');
  // Collect unique resource names from endpoints
  const resources = new Set<string>();
  for (const ep of bp.endpoints) {
    const parts = ep.path.split('/').filter(Boolean);
    // e.g. /api/auth/login → auth, /api/products → products
    if (parts.length >= 2) {
      resources.add(parts[1]);
    }
  }

  const imports = Array.from(resources)
    .map((r) => `import ${toCamelCase(r)}Router from './routes/${r}';`)
    .join('\n');

  const routes = Array.from(resources)
    .map((r) => `app.use('/api/${r}', ${toCamelCase(r)}Router);`)
    .join('\n');

  if (isFastify) {
    const fastifyImports = Array.from(resources)
      .map((r) => `import ${toCamelCase(r)}Routes from './routes/${r}';`)
      .join('\n');
    const fastifyRegistrations = Array.from(resources)
      .map((r) => `app.register(${toCamelCase(r)}Routes, { prefix: '/api/${r}' });`)
      .join('\n');
    return `import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

${fastifyImports}

const app = Fastify({ logger: true });

app.register(cors);
app.register(helmet);
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

${fastifyRegistrations}

export default app;
`;
  }

  return `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

${imports}

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
${routes}

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
`;
}

function generateRouteFile(resource: string, endpoints: Blueprint['endpoints'], isFastify = false): string {
  if (isFastify) return generateFastifyRouteFile(resource, endpoints);

  const filtered = endpoints.filter((ep) => {
    const parts = ep.path.split('/').filter(Boolean);
    return parts.length >= 2 && parts[1] === resource;
  });

  let code = `import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';

type ResourceRecord = Record<string, unknown> & { id: string };
const router = Router();
const records: ResourceRecord[] = [];

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.authorization) {
    res.status(401).json({ error: 'Authorization header is required' });
    return;
  }
  next();
}

function requestId(req: Request): string | undefined {
  const values = Object.values(req.params);
  return values.length > 0 ? String(values[0]) : undefined;
}

`;

  for (const ep of filtered) {
    // Get the sub-path after /api/<resource>
    const parts = ep.path.split('/').filter(Boolean);
    const subPath = '/' + parts.slice(2).join('/') || '/';
    const expressPath = subPath.replace(/:(\w+)/g, ':$1');
    const method = ep.method.toLowerCase();
    const routeDescription = JSON.stringify(ep.description || `${method.toUpperCase()} ${expressPath}`);
    const authGuard = ep.auth ? 'requireAuth, ' : '';

    code += `// ${ep.description}${ep.auth ? ' [AUTH]' : ''}
router.${method}(${JSON.stringify(expressPath)}, ${authGuard}async (req: Request, res: Response) => {
  try {
    const id = requestId(req);
    if ('${method}' === 'get') {
      const data = id ? records.filter((record) => record.id === id) : records;
      res.json({ data, message: ${routeDescription} });
      return;
    }
    if ('${method}' === 'post') {
      const record: ResourceRecord = { id: crypto.randomUUID(), ...(req.body || {}) };
      records.push(record);
      res.status(201).json({ data: record, message: ${routeDescription} });
      return;
    }
    if ('${method}' === 'put' || '${method}' === 'patch') {
      if (!id) {
        res.status(400).json({ error: 'A resource id is required for updates' });
        return;
      }
      const record = records.find((candidate) => candidate.id === id);
      if (!record) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }
      Object.assign(record, req.body || {});
      res.json({ data: record, message: ${routeDescription} });
      return;
    }
    if ('${method}' === 'delete') {
      if (!id) {
        res.status(400).json({ error: 'A resource id is required for deletion' });
        return;
      }
      const index = records.findIndex((candidate) => candidate.id === id);
      if (index === -1) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }
      const [deleted] = records.splice(index, 1);
      res.json({ data: deleted, message: ${routeDescription} });
      return;
    }
    res.status(501).json({ error: 'HTTP method is not supported by this generated route' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

`;
  }

  code += 'export default router;\n';
  return code;
}

function generateFastifyRouteFile(resource: string, endpoints: Blueprint['endpoints']): string {
  const filtered = endpoints.filter((ep) => {
    const parts = ep.path.split('/').filter(Boolean);
    return parts.length >= 2 && parts[1] === resource;
  });
  const functionName = `${toCamelCase(resource)}Routes`;
  let code = `import crypto from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type ResourceRecord = Record<string, unknown> & { id: string };
const records: ResourceRecord[] = [];

function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (!request.headers.authorization) {
    reply.code(401).send({ error: 'Authorization header is required' });
    return;
  }
  done();
}

export default async function ${functionName}(app: FastifyInstance): Promise<void> {
`;

  for (const ep of filtered) {
    const parts = ep.path.split('/').filter(Boolean);
    const routePath = '/' + parts.slice(2).join('/') || '/';
    const method = ep.method.toLowerCase();
    const description = JSON.stringify(ep.description || `${method.toUpperCase()} ${routePath}`);
    const options = ep.auth ? `, { preHandler: requireAuth }` : '';

    code += `  app.${method}(${JSON.stringify(routePath)}${options}, async (request, reply) => {
    const params = (request.params || {}) as Record<string, string>;
    const body = (request.body || {}) as Record<string, unknown>;
    const id = Object.values(params)[0];
    if ('${method}' === 'get') {
      reply.send({ data: id ? records.filter((record) => record.id === id) : records, message: ${description} });
      return;
    }
    if ('${method}' === 'post') {
      const record: ResourceRecord = { id: crypto.randomUUID(), ...body };
      records.push(record);
      reply.code(201).send({ data: record, message: ${description} });
      return;
    }
    if ('${method}' === 'put' || '${method}' === 'patch') {
      if (!id) { reply.code(400).send({ error: 'A resource id is required for updates' }); return; }
      const record = records.find((candidate) => candidate.id === id);
      if (!record) { reply.code(404).send({ error: 'Resource not found' }); return; }
      Object.assign(record, body);
      reply.send({ data: record, message: ${description} });
      return;
    }
    if ('${method}' === 'delete') {
      if (!id) { reply.code(400).send({ error: 'A resource id is required for deletion' }); return; }
      const index = records.findIndex((candidate) => candidate.id === id);
      if (index === -1) { reply.code(404).send({ error: 'Resource not found' }); return; }
      const [deleted] = records.splice(index, 1);
      reply.send({ data: deleted, message: ${description} });
      return;
    }
    reply.code(501).send({ error: 'HTTP method is not supported by this generated route' });
  });

`;
  }

  code += `}
`;
  return code;
}

function generateFrontendPackageJson(bp: Blueprint): string {
  const name = toKebabCase(bp.appName) + '-frontend';
  const isNext = bp.architecture.frontend.toLowerCase().includes('next');
  const isClerk = bp.architecture.auth.toLowerCase().includes('clerk');
  const isSupabase = bp.architecture.database.toLowerCase().includes('supabase');

  const dependencies: Record<string, string> = {
    axios: '^1.6.2',
    react: '^18.2.0',
    'react-dom': '^18.2.0',
    'lucide-react': '^0.300.0',
  };

  const devDependencies: Record<string, string> = {
    '@types/node': '^20.10.0',
    '@types/react': '^18.2.43',
    '@types/react-dom': '^18.2.17',
    autoprefixer: '^10.4.16',
    postcss: '^8.4.32',
    tailwindcss: '^3.3.6',
    typescript: '^5.3.2',
  };

  if (isNext) {
    dependencies['next'] = '^14.1.0';
  } else {
    dependencies['react-router-dom'] = '^7.18.2';
    devDependencies['@vitejs/plugin-react'] = '^4.2.1';
    devDependencies['vite'] = '^5.0.8';
  }

  if (isClerk) {
    dependencies['@clerk/clerk-react'] = '^4.30.0';
    if (isNext) dependencies['@clerk/nextjs'] = '^4.29.0';
  }

  if (isSupabase) {
    dependencies['@supabase/supabase-js'] = '^2.39.0';
  }

  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: isNext ? undefined : 'module',
      scripts: isNext
        ? {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
          }
        : {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
          },
      dependencies,
      devDependencies,
    },
    null,
    2
  );
}

function generateFrontendViteConfig(): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
}

function generateTailwindConfig(isNext: boolean): string {
  const config = `{
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`;
  return isNext
    ? `/** @type {import('tailwindcss').Config} */\nmodule.exports = ${config};\n`
    : `export default ${config};\n`;
}

function generatePostcssConfig(isNext: boolean): string {
  const config = `{ plugins: { tailwindcss: {}, autoprefixer: {} } }`;
  return isNext ? `module.exports = ${config};\n` : `export default ${config};\n`;
}

function generateNextLayout(bp: Blueprint): string {
  return `import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: ${JSON.stringify(bp.appName || 'BuildX App')},
  description: ${JSON.stringify(bp.description || '')},
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

function generateNextPage(bp: Blueprint): string {
  const source = isPlausibleSourceCode(bp.code.frontend, 'App.tsx')
    ? bp.code.frontend
    : generateFrontendApp(bp);
  return `'use client';

${source}
`;
}

export function generateFrontendPage(screen: Blueprint['screens'][number], _bp?: Partial<Blueprint>): string {
  const componentName = toPascalCase(screen.name.replace(/[^a-zA-Z0-9]/g, ''));
  const screenName = JSON.stringify(screen.name);
  const text = `${screen.name} ${screen.components || ''}`.toLowerCase();

  // 1. Authentication & Onboarding Screen
  if (/login|signup|sign.?up|register|auth|onboarding|account/.test(text)) {
    return `import React, { useState } from 'react';
import { Shield, Lock, Mail, User, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ${componentName}Page() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'customer' | 'partner'>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3500);
  };

  return (
    <div className="min-h-[600px] w-full flex items-center justify-center p-6 bg-[#090a0f] text-slate-100 font-sans">
      <div className="w-full max-w-md p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 mb-1">
            <Shield size={26} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{${screenName}}</h2>
          <p className="text-xs text-slate-400 font-mono">Secure Access & Partner Gateway</p>
        </div>

        {/* Mode & Role Switcher */}
        <div className="flex p-1 rounded-xl bg-black/40 border border-white/5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={\`flex-1 py-1.5 rounded-lg transition-all \${mode === 'login' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}\`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={\`flex-1 py-1.5 rounded-lg transition-all \${mode === 'register' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}\`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 rounded-xl text-xs text-white placeholder-slate-600 outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah.j@example.com"
                className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 rounded-xl text-xs text-white placeholder-slate-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 rounded-xl text-xs text-white placeholder-slate-600 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={role === 'partner'}
                onChange={(e) => setRole(e.target.checked ? 'partner' : 'customer')}
                className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0"
              />
              <span>Restaurant Partner Onboarding</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-xs tracking-wide shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
          >
            <span>{mode === 'login' ? 'Authenticate & Enter' : 'Complete Registration'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {isSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>Authentication successful! Access granted.</span>
          </div>
        )}
      </div>
    </div>
  );
}
`;
  }

  // 2. Discovery & Recommendation / Menu Screen
  if (/discovery|menu|cart|catalog|store|shop|food|recommendation/.test(text)) {
    return `import React, { useState } from 'react';
import { Search, Star, Clock, ShoppingBag, Plus, Sparkles, Filter } from 'lucide-react';

export default function ${componentName}Page() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cartCount, setCartCount] = useState(3);

  const categories = ['All', 'Wood-Fired Pizza', 'Artisan Sushi', 'Gourmet Burgers', 'Healthy Bowls', 'Desserts'];

  const items = [
    { id: 1, name: 'Truffle Wood-Fired Pizza', cat: 'Wood-Fired Pizza', price: '$19.50', rating: '4.9', time: '20-30 min', desc: 'San Marzano tomatoes, buffalo mozzarella, white truffle oil & wild arugula.', match: '98% AI Match', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60' },
    { id: 2, name: 'Tokyo Tonkotsu Ramen', cat: 'Artisan Sushi', price: '$16.75', rating: '4.8', time: '15-25 min', desc: '16-hour simmered pork bone broth, soft-boiled egg, fresh scallions, chashu pork.', match: '95% AI Match', img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=60' },
    { id: 3, name: 'Avocado Quinoa Power Bowl', cat: 'Healthy Bowls', price: '$14.25', rating: '4.7', time: '10-20 min', desc: 'Organic tri-color quinoa, Hass avocado, roasted sweet potato, kale & tahini dressing.', match: '91% AI Match', img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60' },
    { id: 4, name: 'Smoked Angus Truffle Burger', cat: 'Gourmet Burgers', price: '$18.00', rating: '4.9', time: '20-25 min', desc: 'Prime aged angus beef, smoked cheddar, caramelized shallots & brioche bun.', match: '89% AI Match', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60' },
    { id: 5, name: 'Classic Venetian Tiramisu', cat: 'Desserts', price: '$8.50', rating: '5.0', time: '10-15 min', desc: 'Espresso-soaked savoiardi, mascarpone cream & dusted Dutch cocoa.', match: '96% AI Match', img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&auto=format&fit=crop&q=60' },
    { id: 6, name: 'Wild Dragon Roll Combo', cat: 'Artisan Sushi', price: '$22.00', rating: '4.9', time: '20-30 min', desc: 'Fresh Atlantic salmon, unagi eel, tobiko caviar & avocado glaze.', match: '94% AI Match', img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=60' }
  ];

  const filtered = items.filter(i => {
    const matchCat = selectedCategory === 'All' || i.cat === selectedCategory;
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-6 space-y-6 font-sans">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Sparkles size={18} />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">{${screenName}}</h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">Real-Time AI Curation & Dynamic Storefront</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[260px]">
            <Search size={14} className="absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients, tags..."
              className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/10 focus:border-orange-500/50 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>

          <button
            onClick={() => setCartCount(c => c + 1)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition-all"
          >
            <ShoppingBag size={14} />
            <span>Cart ({cartCount})</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={\`px-3.5 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all \${
              selectedCategory === cat
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 font-semibold shadow-sm'
                : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:text-white hover:bg-white/5'
            }\`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item) => (
          <div key={item.id} className="group rounded-2xl bg-white/[0.02] border border-white/5 hover:border-orange-500/30 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/5 flex flex-col">
            <div className="relative h-44 overflow-hidden bg-black/40">
              <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                <Sparkles size={10} />
                <span>{item.match}</span>
              </div>
              <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1">
                <Star size={10} className="fill-amber-300" />
                <span>{item.rating}</span>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-white group-hover:text-orange-300 transition-colors">{item.name}</h3>
                  <span className="font-mono text-sm font-bold text-orange-400">{item.price}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">{item.desc}</p>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  <Clock size={12} />
                  <span>{item.time}</span>
                </div>
                <button
                  onClick={() => setCartCount(c => c + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-orange-500 text-slate-200 hover:text-white text-xs font-semibold transition-all"
                >
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
  }

  // 3. Tracking & Live Map Screen
  if (/tracking|map|telemetry|dispatch|live/.test(text)) {
    return `import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Phone, MessageSquare, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

export default function ${componentName}Page() {
  const [eta, setEta] = useState(18);

  useEffect(() => {
    const timer = setInterval(() => setEta(t => Math.max(t - 1, 1)), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-6 space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{${screenName}}</h1>
          <p className="text-xs text-slate-400 font-mono">Order #BST-9482 · Live GPS Driver Telemetry</p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Driver on Route ({eta} mins)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Simulator Panel */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-white/10 relative overflow-hidden h-[420px] flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
          
          {/* Simulated Route Line */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2/3 h-0.5 bg-gradient-to-r from-orange-500 via-indigo-500 to-emerald-500 relative">
              <div className="absolute -top-3 left-0 p-1.5 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/50">
                <MapPin size={14} />
              </div>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 p-2 rounded-full bg-indigo-600 text-white animate-bounce shadow-lg shadow-indigo-500/50">
                <Navigation size={14} />
              </div>
              <div className="absolute -top-3 right-0 p-1.5 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/50">
                <CheckCircle2 size={14} />
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                <Navigation size={16} />
              </span>
              <div>
                <p className="font-bold text-white">Carlos M. (Toyota Prius · CA 8KZ9)</p>
                <p className="text-slate-400">0.8 miles away · Heading south on Mission St</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"><Phone size={14} /></button>
              <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"><MessageSquare size={14} /></button>
            </div>
          </div>
        </div>

        {/* Stepper Timeline & Order Details */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Status Stepper</h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 size={16} />
                <span>1. Order Confirmed & Paid</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 size={16} />
                <span>2. Kitchen Prepared Dish</span>
              </div>
              <div className="flex items-center gap-3 text-indigo-300 font-bold animate-pulse">
                <Clock size={16} />
                <span>3. Out for Delivery</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <CheckCircle2 size={16} />
                <span>4. Delivered to Door</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 font-mono text-xs">
            <h3 className="font-bold text-slate-300">Digital Receipt</h3>
            <div className="flex justify-between text-slate-400">
              <span>2x Truffle Wood-Fired Pizza</span>
              <span className="text-white">$39.00</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>1x Classic Tiramisu</span>
              <span className="text-white">$8.50</span>
            </div>
            <div className="flex justify-between text-slate-400 pt-2 border-t border-white/5">
              <span>Delivery Fee & Tax</span>
              <span className="text-white">$4.75</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-orange-400 pt-1 border-t border-white/10">
              <span>Total Paid</span>
              <span>$52.25</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
  }

  // 4. Admin & Kanban Portal
  if (/admin|portal|fulfillment|kanban|management|kitchen/.test(text)) {
    return `import React, { useState } from 'react';
import { ChefHat, Check, Clock, AlertCircle, Plus, MoreHorizontal } from 'lucide-react';

export default function ${componentName}Page() {
  const [columns, setColumns] = useState({
    pending: [
      { id: '101', table: 'Order #101', items: '2x Truffle Pizza', time: '3m ago', priority: 'High' },
      { id: '102', table: 'Order #102', items: '1x Dragon Roll', time: '5m ago', priority: 'Normal' }
    ],
    preparing: [
      { id: '99', table: 'Order #99', items: '3x Tonkotsu Ramen', time: '12m ago', priority: 'High' }
    ],
    ready: [
      { id: '97', table: 'Order #97', items: '1x Angus Burger', time: '18m ago', priority: 'Normal' }
    ],
    dispatched: [
      { id: '94', table: 'Order #94', items: '2x Quinoa Bowl', time: '25m ago', priority: 'Completed' }
    ]
  });

  const moveOrder = (from: keyof typeof columns, to: keyof typeof columns, id: string) => {
    const item = columns[from].find(o => o.id === id);
    if (!item) return;
    setColumns(prev => ({
      ...prev,
      [from]: prev[from].filter(o => o.id !== id),
      [to]: [...prev[to], item]
    }));
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-6 space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ChefHat size={20} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{${screenName}}</h1>
            <p className="text-xs text-slate-400 font-mono">Live Kitchen Fulfillment & Order Pipeline</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all">
          <Plus size={14} />
          <span>New Menu Item</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(Object.entries(columns) as [keyof typeof columns, typeof columns['pending']][]).map(([colKey, items]) => (
          <div key={colKey} className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">{colKey}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400">{items.length}</span>
            </div>

            <div className="space-y-3 min-h-[300px]">
              {items.map(order => (
                <div key={order.id} className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/40 space-y-2 text-xs font-mono transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{order.table}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">{order.priority}</span>
                  </div>
                  <p className="text-slate-300 font-sans text-xs">{order.items}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-500">
                    <span>{order.time}</span>
                    {colKey === 'pending' && <button onClick={() => moveOrder('pending', 'preparing', order.id)} className="text-purple-400 hover:text-purple-300 font-bold">Start Cooking →</button>}
                    {colKey === 'preparing' && <button onClick={() => moveOrder('preparing', 'ready', order.id)} className="text-emerald-400 hover:text-emerald-300 font-bold">Mark Ready →</button>}
                    {colKey === 'ready' && <button onClick={() => moveOrder('ready', 'dispatched', order.id)} className="text-indigo-400 hover:text-indigo-300 font-bold">Dispatch →</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
  }

  // 5. Super-Admin Analytics Dashboard
  if (/analytics|dashboard|metrics|revenue|stats/.test(text)) {
    return `import React from 'react';
import { TrendingUp, DollarSign, Users, Clock, ArrowUpRight, BarChart3 } from 'lucide-react';

export default function ${componentName}Page() {
  const kpis = [
    { label: 'Total Platform Revenue', value: '$128,450', change: '+14.2%', up: true, icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Active Orders Today', value: '1,420', change: '+8.7%', up: true, icon: TrendingUp, color: 'text-indigo-400' },
    { label: 'Registered Customers', value: '14,890', change: '+12.4%', up: true, icon: Users, color: 'text-purple-400' },
    { label: 'Avg Delivery Time', value: '22 mins', change: '-4.1%', up: true, icon: Clock, color: 'text-amber-400' },
  ];

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-6 space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{${screenName}}</h1>
          <p className="text-xs text-slate-400 font-mono">Platform Telemetry, Financials & Partner Health</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-slate-400">
            Last 30 Days
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">{kpi.label}</span>
                <span className={\`p-2 rounded-xl bg-white/5 \${kpi.color}\`}>
                  <Icon size={16} />
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white font-mono">{kpi.value}</span>
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-0.5">
                  <ArrowUpRight size={12} />
                  {kpi.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & User Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Revenue Growth Velocity</h3>
            <span className="text-xs font-mono text-emerald-400">+22.4% vs last month</span>
          </div>
          <div className="h-56 flex items-end gap-3 pt-6 px-2">
            {[45, 60, 52, 78, 65, 90, 85, 110, 95, 120, 115, 140].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div
                  style={{ height: \`\${h * 1.2}px\` }}
                  className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-purple-500 opacity-70 group-hover:opacity-100 transition-all"
                />
                <span className="text-[9px] font-mono text-slate-500">{i + 1}w</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
          <h3 className="font-bold text-sm text-white">Top Performing Partners</h3>
          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5">
              <span>Bella Italia</span>
              <span className="text-emerald-400 font-bold">$34,200</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5">
              <span>Sakura Sushi</span>
              <span className="text-emerald-400 font-bold">$28,950</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5">
              <span>The Burger Lab</span>
              <span className="text-emerald-400 font-bold">$21,400</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
  }

  // 6. Generic / Fallback Screen (Rich interactive record table with modal and search)
  return `import React, { useMemo, useState } from 'react';
import { Search, Plus, Filter, CheckCircle2, MoreVertical, Layout } from 'lucide-react';

export default function ${componentName}Page() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([
    { id: '1', name: 'Standard Transaction #481', status: 'Completed', date: 'Today, 2:40 PM', value: '$42.50' },
    { id: '2', name: 'Priority Dispatch #482', status: 'In Progress', date: 'Today, 1:15 PM', value: '$89.00' },
    { id: '3', name: 'Customer Verification #483', status: 'Verified', date: 'Yesterday', value: '$12.00' },
    { id: '4', name: 'Partner Settlement #484', status: 'Pending', date: '2 days ago', value: '$340.00' },
  ]);
  const [draft, setDraft] = useState('');

  const filtered = useMemo(() => items.filter(i => i.name.toLowerCase().includes(query.toLowerCase())), [items, query]);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-6 space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Layout size={20} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{${screenName}}</h1>
            <p className="text-xs text-slate-400 font-mono">Managed Workflows & Domain Records</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search records..."
              className="pl-9 pr-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all">
            <Plus size={14} />
            <span>New Record</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-white/[0.02] text-slate-400 border-b border-white/5">
            <tr>
              <th className="p-4">Record Name</th>
              <th className="p-4">Status</th>
              <th className="p-4">Timestamp</th>
              <th className="p-4">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map(i => (
              <tr key={i.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4 font-semibold text-white">{i.name}</td>
                <td className="p-4"><span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">{i.status}</span></td>
                <td className="p-4 text-slate-400">{i.date}</td>
                <td className="p-4 font-bold text-indigo-300">{i.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
}

export function generateFrontendApp(bp: Blueprint): string {
  const name = bp.appName || 'BuildX App';
  const desc = bp.description || '';
  const domainLower = (name + ' ' + desc + ' ' + JSON.stringify(bp.screens || []) + ' ' + JSON.stringify(bp.features || {})).toLowerCase();

  const isCrm = domainLower.includes('crm') || domainLower.includes('pipeline') || domainLower.includes('sales') || domainLower.includes('deal') || domainLower.includes('lead') || domainLower.includes('flowcrm');
  const isMedical = domainLower.includes('med') || domainLower.includes('health') || domainLower.includes('patient') || domainLower.includes('doctor') || domainLower.includes('clinic') || domainLower.includes('triage') || domainLower.includes('hospital');
  const isDev = domainLower.includes('code') || domainLower.includes('dev') || domainLower.includes('infra') || domainLower.includes('cloud') || domainLower.includes('server') || domainLower.includes('deploy') || domainLower.includes('api') || domainLower.includes('git');
  const isEcommerce = domainLower.includes('food') || domainLower.includes('fit') || domainLower.includes('order') || domainLower.includes('store') || domainLower.includes('shop') || domainLower.includes('cart') || domainLower.includes('delivery') || domainLower.includes('commerce');

  if (isCrm) {
    return `import React, { useState } from 'react';

export default function App() {
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = [
    { label: 'MRR', value: '$184,200', change: '+14.2%', note: 'vs last month' },
    { label: 'Active Deals', value: '42', change: '+8', note: 'in pipeline' },
    { label: 'Win Rate', value: '84.2%', change: '+3.1%', note: 'target 80%' },
    { label: 'Avg Deal Size', value: '$24,500', change: '+$2.1k', note: 'Q3 average' },
  ];

  const deals = [
    { id: 'DEAL-9041', company: 'Acme Corp', val: '$24,000', stage: 'qualified', priority: 'High', rep: 'Sarah K.', avatar: 'AC', days: '3 days in stage', email: 'sarah.k@acme.corp', phone: '+1 (555) 019-2834', notes: 'Evaluating Enterprise Tier for 250 seats.' },
    { id: 'DEAL-9042', company: 'Vercel Inc', val: '$48,500', stage: 'qualified', priority: 'Critical', rep: 'Alex M.', avatar: 'VC', days: '1 day in stage', email: 'alex.m@vercel.com', phone: '+1 (555) 012-9982', notes: 'Needs SSO SAML integration & custom SLA.' },
    { id: 'DEAL-9043', company: 'Supabase', val: '$15,500', stage: 'qualified', priority: 'Medium', rep: 'David R.', avatar: 'SB', days: '5 days in stage', email: 'david.r@supabase.io', phone: '+1 (555) 014-4431', notes: 'Interested in Postgres database migration assistance.' },
    { id: 'DEAL-9044', company: 'Stripe', val: '$65,000', stage: 'meeting', priority: 'Critical', rep: 'Sarah K.', avatar: 'ST', days: '2 days in stage', email: 'billing@stripe.com', phone: '+1 (555) 018-7721', notes: 'Technical demo completed with VP of Eng.' },
    { id: 'DEAL-9045', company: 'Linear', val: '$32,000', stage: 'meeting', priority: 'High', rep: 'Elena R.', avatar: 'LN', days: '4 days in stage', email: 'elena.r@linear.app', phone: '+1 (555) 011-3329', notes: 'Discussing annual prepay discount.' },
    { id: 'DEAL-9046', company: 'OpenAI', val: '$95,000', stage: 'meeting', priority: 'Critical', rep: 'Alex M.', avatar: 'AI', days: '1 day in stage', email: 'procurement@openai.com', phone: '+1 (555) 017-8812', notes: 'Security audit questionnaire submitted.' },
    { id: 'DEAL-9047', company: 'Datadog', val: '$42,000', stage: 'proposal', priority: 'High', rep: 'David R.', avatar: 'DD', days: '6 days in stage', email: 'ops@datadog.com', phone: '+1 (555) 013-5591', notes: 'Proposal v2 delivered. Legal reviewing redlines.' },
    { id: 'DEAL-9048', company: 'Figma', val: '$54,000', stage: 'proposal', priority: 'High', rep: 'Sarah K.', avatar: 'FG', days: '2 days in stage', email: 'design@figma.com', phone: '+1 (555) 016-1120', notes: 'Contract sent via DocuSign.' },
    { id: 'DEAL-9049', company: 'GitHub', val: '$120,000', stage: 'won', priority: 'Critical', rep: 'Alex M.', avatar: 'GH', days: 'Closed Today', email: 'partners@github.com', phone: '+1 (555) 019-9944', notes: 'Signed 3-year enterprise contract!' },
    { id: 'DEAL-9050', company: 'Notion', val: '$28,000', stage: 'won', priority: 'High', rep: 'Elena R.', avatar: 'NT', days: 'Closed Yesterday', email: 'sales@notion.so', phone: '+1 (555) 015-6677', notes: 'Kickoff call scheduled for Monday.' },
  ];

  const columns = [
    { id: 'qualified', title: 'Qualified', color: 'text-blue-400 border-blue-500/30' },
    { id: 'meeting', title: 'Meeting Scheduled', color: 'text-indigo-400 border-indigo-500/30' },
    { id: 'proposal', title: 'Proposal Sent', color: 'text-purple-400 border-purple-500/30' },
    { id: 'won', title: 'Closed Won', color: 'text-emerald-400 border-emerald-500/30' },
  ];

  const filteredDeals = deals.filter(d => {
    if (searchQuery && !d.company.toLowerCase().includes(searchQuery.toLowerCase()) && !d.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === 'enterprise' && parseInt(d.val.replace(/[^0-9]/g, '')) < 40000) return false;
    if (filter === 'critical' && d.priority !== 'Critical') return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">${name}</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
              LIVE PIPELINE
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">REAL-TIME REVENUE & DEAL STAGE TELEMETRY</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search deals, companies, IDs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono w-64"
          />
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-500/20">
            + Add Deal
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl">
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block">{m.label}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold text-white font-mono">{m.value}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {m.change}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block font-mono">{m.note}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 mb-4 bg-zinc-900/40 p-2 rounded-xl border border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono pl-2">Filter:</span>
          {['all', 'enterprise', 'critical'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={\`px-3 py-1 rounded-lg text-xs font-mono capitalize transition-all \${
                filter === f ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-zinc-400 hover:text-white'
              }\`}
            >
              {f === 'all' ? 'All Reps' : f === 'enterprise' ? 'Enterprise Only ($40k+)' : 'Critical Only'}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500 font-mono pr-2">{filteredDeals.length} deals active</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map(col => {
          const colDeals = filteredDeals.filter(d => d.stage === col.id);
          const colTotal = colDeals.reduce((sum, d) => sum + parseInt(d.val.replace(/[^0-9]/g, '') || '0'), 0);

          return (
            <div key={col.id} className="bg-zinc-900/50 border border-white/10 rounded-2xl p-3 flex flex-col gap-3 min-h-[480px]">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className={\`text-xs font-bold uppercase tracking-wider font-mono \${col.color.split(' ')[0]}\`}>
                  {col.title} ({colDeals.length})
                </span>
                <span className="font-mono text-xs text-zinc-400">\${colTotal.toLocaleString()}</span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colDeals.map(deal => (
                  <div
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="bg-zinc-900/90 hover:bg-zinc-800/90 border border-white/10 hover:border-indigo-500/40 rounded-xl p-3.5 shadow-lg transition-all cursor-pointer space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-[10px] font-mono">
                          {deal.avatar}
                        </div>
                        <span className="font-semibold text-xs text-white group-hover:text-indigo-300 transition-colors">
                          {deal.company}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">{deal.val}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span className="text-zinc-500">{deal.id}</span>
                      <span className={\`px-1.5 py-0.5 rounded border \${
                        deal.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }\`}>
                        {deal.priority}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono text-zinc-500">
                      <span>👤 {deal.rep}</span>
                      <span>⏱ {deal.days}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDeal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end" onClick={() => setSelectedDeal(null)}>
          <div className="w-full max-w-md bg-[#121216] border-l border-white/10 p-6 flex flex-col gap-5 h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm font-mono">
                  {selectedDeal.avatar}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedDeal.company}</h3>
                  <span className="text-xs font-mono text-zinc-400">{selectedDeal.id}</span>
                </div>
              </div>
              <button onClick={() => setSelectedDeal(null)} className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 text-xs">✕</button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="bg-zinc-900/80 p-4 rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between"><span className="text-zinc-500">Deal Value:</span><span className="text-emerald-400 font-bold">{selectedDeal.val}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Priority:</span><span className="text-amber-400">{selectedDeal.priority}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Assigned Rep:</span><span className="text-white">{selectedDeal.rep}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Stage Duration:</span><span className="text-zinc-300">{selectedDeal.days}</span></div>
              </div>

              <div className="bg-zinc-900/80 p-4 rounded-xl border border-white/10 space-y-2">
                <span className="text-zinc-400 font-bold block mb-2">Contact Details</span>
                <div className="flex justify-between"><span className="text-zinc-500">Email:</span><span className="text-indigo-400">{selectedDeal.email}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Phone:</span><span className="text-zinc-300">{selectedDeal.phone}</span></div>
              </div>

              <div className="bg-zinc-900/80 p-4 rounded-xl border border-white/10 space-y-2">
                <span className="text-zinc-400 font-bold block mb-2">Activity History</span>
                <p className="text-zinc-300 font-sans text-xs leading-relaxed">{selectedDeal.notes}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;
  }

  if (isMedical) {
    return `import React, { useState } from 'react';

export default function App() {
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const metrics = [
    { label: 'Active Patients', val: '28', status: '2 In ICU' },
    { label: 'On-Call Physicians', val: '4', status: 'Active Shift' },
    { label: 'System SLA', val: '99.8%', status: 'HIPAA Compliant' },
    { label: 'Triage Queue', val: '12', status: 'Avg 4.2m Wait' },
  ];

  const patients = [
    { mrn: '#MRN-8942', name: 'Eleanor Vance', age: 48, status: 'Triage', bp: '138/88 mmHg', hr: '84 bpm', spo2: '97%', doctor: 'Dr. Vance', room: 'Bay 4', notes: 'Acute chest discomfort, ECG normal.' },
    { mrn: '#MRN-9104', name: 'Marcus Brody', age: 62, status: 'In Consultation', bp: '120/80 mmHg', hr: '72 bpm', spo2: '99%', doctor: 'Dr. Chen', room: 'Exam 2', notes: 'Routine post-op checkup.' },
    { mrn: '#MRN-7731', name: 'Sophia Martinez', age: 34, status: 'Discharged', bp: '118/76 mmHg', hr: '68 bpm', spo2: '98%', doctor: 'Dr. Al-Mansoor', room: 'Outpatient', notes: 'Medication prescribed, follow up in 2 weeks.' },
    { mrn: '#MRN-6420', name: 'Jonathan Reed', age: 55, status: 'Observation', bp: '142/92 mmHg', hr: '90 bpm', spo2: '95%', doctor: 'Dr. Ramirez', room: 'Bed 12', notes: 'Elevated blood pressure, monitoring response.' },
    { mrn: '#MRN-8193', name: 'Clara Oswald', age: 29, status: 'Triage', bp: '110/70 mmHg', hr: '75 bpm', spo2: '99%', doctor: 'Dr. Vance', room: 'Bay 1', notes: 'Mild fever and dehydration.' },
    { mrn: '#MRN-5512', name: 'Arthur Pendelton', age: 71, status: 'In Consultation', bp: '135/85 mmHg', hr: '80 bpm', spo2: '96%', doctor: 'Dr. Chen', room: 'Exam 4', notes: 'Joint mobility assessment.' },
  ];

  const filtered = patients.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.mrn.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== 'all' && p.status.toLowerCase() !== filter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">${name}</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
              HIPAA COMPLIANT
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">PATIENT TRIAGE & CLINICAL TELEMETRY QUEUE</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search patients, records, MRNs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono w-64"
          />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {metrics.map((m, i) => (
          <div key={i} className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl">
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block">{m.label}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold text-white font-mono">{m.val}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {m.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <span className="font-mono text-xs text-zinc-300 font-bold">CLINICAL PATIENT QUEUE</span>
          <div className="flex gap-2">
            {['all', 'triage', 'in consultation', 'discharged'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={\`px-2.5 py-1 rounded-lg text-[11px] font-mono capitalize \${filter === s ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-zinc-400 hover:text-white'}\`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-zinc-950 text-zinc-500 border-b border-white/10 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="p-4">MRN</th>
              <th className="p-4">Patient Name</th>
              <th className="p-4">Status</th>
              <th className="p-4">Vital Signs</th>
              <th className="p-4">Attending Doctor</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {filtered.map(p => (
              <tr key={p.mrn} onClick={() => setSelectedPatient(p)} className="hover:bg-white/5 cursor-pointer transition-colors">
                <td className="p-4 font-bold text-indigo-400">{p.mrn}</td>
                <td className="p-4 font-sans font-semibold text-white">{p.name} <span className="text-xs text-zinc-500">({p.age}y)</span></td>
                <td className="p-4">
                  <span className={\`px-2 py-0.5 rounded-full border text-[10px] \${
                    p.status === 'Triage' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    p.status === 'Discharged' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }\`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-4 text-zinc-300">{p.bp} · {p.hr} · {p.spo2}</td>
                <td className="p-4 text-zinc-400">{p.doctor}</td>
                <td className="p-4 text-right">
                  <button className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-xs">View Chart</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end" onClick={() => setSelectedPatient(null)}>
          <div className="w-full max-w-md bg-[#121216] border-l border-white/10 p-6 flex flex-col gap-4 h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">{selectedPatient.name}</h3>
                <span className="text-xs font-mono text-indigo-400">{selectedPatient.mrn}</span>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-zinc-900 p-4 rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between"><span className="text-zinc-500">Blood Pressure:</span><span className="text-white">{selectedPatient.bp}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Heart Rate:</span><span className="text-white">{selectedPatient.hr}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Oxygen Saturation:</span><span className="text-emerald-400">{selectedPatient.spo2}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Assigned Location:</span><span className="text-zinc-300">{selectedPatient.room}</span></div>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-white/10">
                <span className="text-zinc-400 font-bold block mb-2">Clinical Notes & Diagnosis</span>
                <p className="text-zinc-300 font-sans text-xs leading-relaxed">{selectedPatient.notes}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;
  }

  if (isDev) {
    return `import React, { useState } from 'react';

export default function App() {
  const metrics = [
    { label: 'CPU Usage', val: '24.8%', status: 'Normal' },
    { label: 'Memory Usage', val: '4.2 / 16 GB', status: 'Stable' },
    { label: 'API Latency', val: '24ms avg', status: 'p95 18ms' },
    { label: 'System Uptime', val: '99.99%', status: 'SLA Met' },
  ];

  const endpoints = [
    { path: '/api/v1/auth/verify', latency: '18ms', status: '200 OK', load: '1,420 req/s' },
    { path: '/api/v1/deployments', latency: '34ms', status: '200 OK', load: '840 req/s' },
    { path: '/api/v1/webhooks', latency: '12ms', status: '200 OK', load: '3,100 req/s' },
    { path: '/api/v1/analytics', latency: '42ms', status: '200 OK', load: '520 req/s' },
  ];

  const logs = [
    '10:42:01.104 [sys] Container build succeeded in 3.4s',
    '10:42:02.310 [net] Route /api/v1/deployments bound to port 3001',
    '10:42:03.001 [db] Postgres connection pool initialized (10 connections)',
    '10:42:04.882 [auth] OAuth provider GitHub verified successfully',
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-mono text-xs p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> ● All Systems Operational
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">Environment: Production (us-east-1)</span>
          </div>
          <h1 className="text-xl font-bold text-white font-sans mt-1">${name} Developer Console</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 text-xs">
            Commit: <span className="text-indigo-400">v2.4.1-beta</span>
          </span>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-sans font-semibold text-xs">
            + New Deployment
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {metrics.map((m, i) => (
          <div key={i} className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">{m.label}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold text-white">{m.val}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{m.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl space-y-3">
          <span className="text-zinc-300 font-bold block border-b border-white/10 pb-2">API ENDPOINT LATENCY & HEALTH</span>
          <div className="space-y-2">
            {endpoints.map((ep, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-indigo-300 font-bold">{ep.path}</span>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400">{ep.load}</span>
                  <span className="text-emerald-400 font-bold">{ep.latency}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">{ep.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl space-y-3">
          <span className="text-zinc-300 font-bold block border-b border-white/10 pb-2">DEPLOYMENT LOG STREAM</span>
          <div className="bg-black/60 p-3 rounded-xl border border-white/10 space-y-1.5 text-[11px] text-zinc-400 font-mono">
            {logs.map((l, i) => (
              <div key={i} className="leading-relaxed hover:text-zinc-200">{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`;
  }

  if (isEcommerce) {
    return `import React, { useState } from 'react';

export default function App() {
  const [filter, setFilter] = useState('all');

  const orders = [
    { id: '#ORD-9421', customer: 'Elena Rostova', items: '2x Organic Acai Bowl, 1x Cold Brew', total: '$38.50', status: 'In Transit', driver: 'Marcus V. · ETA 12 mins' },
    { id: '#ORD-9422', customer: 'Michael Chang', items: '1x Salmon Poke Bowl, 1x Green Juice', total: '$27.80', status: 'Preparing', driver: 'Assigning driver...' },
    { id: '#ORD-9423', customer: 'Sarah Jenkins', items: '3x Avocado Toast, 2x Espresso', total: '$44.00', status: 'Delivered', driver: 'Completed' },
    { id: '#ORD-9424', customer: 'David Kim', items: '1x Protein Smoothie Bowl', total: '$14.50', status: 'Pending', driver: 'Awaiting Kitchen' },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">${name} Operations Console</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
              LIVE DISPATCH
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">REAL-TIME FULFILLMENT & DISPATCH MONITOR</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-xl border border-white/10">
            Today's Orders: <span className="text-emerald-400 font-bold">1,240</span> ($34.2k)
          </span>
        </div>
      </header>

      <div className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <span className="font-mono text-xs font-bold text-zinc-300">LIVE ORDER DISPATCH GRID</span>
          <div className="flex gap-2 font-mono text-xs">
            {['all', 'pending', 'preparing', 'in transit', 'delivered'].map(s => (
              <button key={s} onClick={() => setFilter(s)} className={\`px-2.5 py-1 rounded-lg capitalize \${filter === s ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-zinc-400'}\`}>{s}</button>
            ))}
          </div>
        </div>

        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-zinc-950 text-zinc-500 border-b border-white/10 text-[10px] uppercase">
            <tr>
              <th className="p-4">Order ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Itemized Receipt</th>
              <th className="p-4">Total</th>
              <th className="p-4">Status</th>
              <th className="p-4">Driver Assignment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {orders.filter(o => filter === 'all' || o.status.toLowerCase() === filter).map(o => (
              <tr key={o.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-indigo-400">{o.id}</td>
                <td className="p-4 font-sans text-white">{o.customer}</td>
                <td className="p-4 text-zinc-400">{o.items}</td>
                <td className="p-4 font-bold text-emerald-400">{o.total}</td>
                <td className="p-4">
                  <span className={\`px-2 py-0.5 rounded-full border text-[10px] \${
                    o.status === 'In Transit' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                    o.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }\`}>{o.status}</span>
                </td>
                <td className="p-4 text-zinc-400">{o.driver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
  }

  // Default High-Density SaaS Interface
  return `import React, { useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const metrics = [
    { label: 'Monthly Recurring Revenue', value: '$84,200', change: '+18.4%' },
    { label: 'Active Workspace Users', value: '1,420', change: '+12.1%' },
    { label: 'System Availability', value: '99.9%', change: 'SLA OK' },
    { label: 'Open Support Tickets', value: '18', change: '-4' },
  ];

  const items = [
    { id: '#USR-9021', name: 'Acme Corp Admin', status: 'Active', plan: 'Enterprise', usage: '84%', lastSeen: '2m ago' },
    { id: '#USR-9022', name: 'Vercel Workspace', status: 'Active', plan: 'Pro Tier', usage: '62%', lastSeen: '5m ago' },
    { id: '#USR-9023', name: 'Supabase Project', status: 'Pending', plan: 'Starter', usage: '15%', lastSeen: '1h ago' },
    { id: '#USR-9024', name: 'Linear Integration', status: 'Active', plan: 'Enterprise', usage: '91%', lastSeen: 'Just now' },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">${name}</h1>
          <p className="text-xs text-zinc-400 font-mono mt-1">${desc.slice(0, 80)}...</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-xs">
            + Create Item
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {metrics.map((m, i) => (
          <div key={i} className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl">
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block">{m.label}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold text-white font-mono">{m.value}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{m.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/80 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <span className="font-mono text-xs font-bold text-zinc-300">WORKSPACE ACTIVITY MONITOR</span>
        </div>
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-zinc-950 text-zinc-500 border-b border-white/10 text-[10px] uppercase">
            <tr>
              <th className="p-4">ID</th>
              <th className="p-4">Workspace Name</th>
              <th className="p-4">Status</th>
              <th className="p-4">Plan Tier</th>
              <th className="p-4">Quota Usage</th>
              <th className="p-4">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-indigo-400">{item.id}</td>
                <td className="p-4 font-sans text-white">{item.name}</td>
                <td className="p-4">
                  <span className="px-2 py-0.5 rounded-full border text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{item.status}</span>
                </td>
                <td className="p-4 text-zinc-300">{item.plan}</td>
                <td className="p-4 text-zinc-400">{item.usage}</td>
                <td className="p-4 text-zinc-500">{item.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
}


function generateApiClient(bp: Blueprint): string {
  let code = `import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

`;

  // Group endpoints by resource
  const groups = new Map<string, Blueprint['endpoints']>();
  for (const ep of bp.endpoints) {
    const parts = ep.path.split('/').filter(Boolean);
    const resource = parts.length >= 2 ? parts[1] : 'misc';
    if (!groups.has(resource)) groups.set(resource, []);
    groups.get(resource)!.push(ep);
  }

  for (const [resource, endpoints] of groups) {
    code += `// ─── ${toPascalCase(resource)} ─────────────────────────────\n\n`;
    for (const ep of endpoints) {
      const parts = ep.path.split('/').filter(Boolean);
      const funcName = toCamelCase(ep.method.toLowerCase() + '_' + parts.slice(1).join('_'));
      const method = ep.method.toLowerCase();
      const hasBody = ['post', 'put', 'patch'].includes(method);

      code += `/** ${ep.description} */\n`;
      code += `export async function ${funcName}(${hasBody ? 'data: Record<string, unknown>' : ''}) {\n`;
      if (hasBody) {
        code += `  const response = await api.${method}('${ep.path}', data);\n`;
      } else {
        code += `  const response = await api.${method}('${ep.path}');\n`;
      }
      code += '  return response.data;\n';
      code += '}\n\n';
    }
  }

  code += 'export default api;\n';
  return code;
}

function generateDockerCompose(bp: Blueprint): string {
  const name = toKebabCase(bp.appName);
  const isMongo = bp.architecture.database.toLowerCase().includes('mongo');
  
  if (isMongo) {
    return `version: '3.8'

services:
  db:
    image: mongo:6.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin_password
      MONGO_INITDB_DATABASE: ${name}_dev
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: mongodb://admin:admin_password@db:27017/${name}_dev?authSource=admin
      PORT: 3001
      NODE_ENV: development
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3001

volumes:
  mongodata:
`;
  }

  return `version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${name}
      POSTGRES_PASSWORD: ${name}_secret
      POSTGRES_DB: ${name}_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://${name}:${name}_secret@db:5432/${name}_dev
      PORT: 3001
      NODE_ENV: development
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3001

volumes:
  pgdata:
`;
}

function generateReadme(bp: Blueprint): string {
  const isMongo = bp.architecture.database.toLowerCase().includes('mongo');
  const dbPrereq = isMongo ? '- MongoDB (or use Docker)' : '- PostgreSQL 15+ (or use Docker)';
  const dbSetupInstructions = isMongo
    ? `cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL`
    : `cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL
npx prisma db push`;

  const schemaHeader = isMongo ? 'Field' : 'Column';
  const dbSchemaSection = bp.schema.map((t) => `### ${t.table}
| ${schemaHeader} | Type |
|---|---|
${t.columns.map((c) => `| ${c.name} | ${c.type} |`).join('\n')}`).join('\n\n');

  return `# ${bp.appName}

${bp.description}

**Target Users:** ${bp.targetUsers}
**Complexity:** ${bp.complexity}

> Generated by [BuildX](https://github.com) — AI-powered app blueprint generator.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | ${bp.architecture.frontend} |
| Backend | ${bp.architecture.backend} |
| Database | ${bp.architecture.database} |
| Auth | ${bp.architecture.auth} |
| Hosting | ${bp.architecture.hosting} |

## Getting Started

### Prerequisites
- Node.js 18+
${dbPrereq}

### Quick Start with Docker

\`\`\`bash
docker-compose up -d
\`\`\`

### Manual Setup

1. **Install dependencies:**
\`\`\`bash
cd backend && npm install
cd ../frontend && npm install
\`\`\`

2. **Set up the database:**
\`\`\`bash
${dbSetupInstructions}
\`\`\`

3. **Start development servers:**
\`\`\`bash
# From root
npm run dev
\`\`\`

Backend: http://localhost:3001
Frontend: http://localhost:5173

## API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
${bp.endpoints.map((ep) => `| ${ep.method} | \`${ep.path}\` | ${ep.description} | ${ep.auth ? '✅' : '—'} |`).join('\n')}

## Database Schema

${dbSchemaSection}

## Screens

${bp.screens.map((s) => `- **${s.icon} ${s.name}** — ${s.components}`).join('\n')}

## Effort Estimation

- **Timeline:** ${bp.effort.time}
- **Complexity:** ${bp.effort.complexity}
- **Cost:** ${bp.effort.cost}
- **Team:** ${bp.effort.team}

---

*This project was scaffolded by BuildX AI Architect.*
`;
}

function generateEnvExample(bp: Blueprint): string {
  const isMongo = bp.architecture.database.toLowerCase().includes('mongo');
  const defaultUrl = isMongo
    ? 'mongodb://admin:admin_password@localhost:27017/mydb?authSource=admin'
    : 'postgresql://user:password@localhost:5432/mydb';
  
  return `# Database
DATABASE_URL=${defaultUrl}

# Server
PORT=3001
NODE_ENV=development
`;
}

function generateGitignore(): string {
  return `node_modules/
dist/
.env
*.log
.DS_Store
`;
}

// ─── Main export ───────────────────────────────────────────

/** Map SQL column types to Mongoose schema types */
function sqlTypeToMongoose(sqlType: string): string {
  const t = sqlType.toUpperCase();
  if (t.includes('INT') || t.includes('SERIAL') || t.includes('FLOAT') ||
      t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('NUMERIC')) return 'Number';
  if (t.includes('BOOL')) return 'Boolean';
  if (t.includes('TIMESTAMP') || t.includes('DATE')) return 'Date';
  if (t.includes('JSON')) return 'Object';
  return 'String';
}

/**
 * Generate Mongoose model definitions from the blueprint schema.
 * Used for MongoDB projects so `schema.js` is never empty even when the
 * AI refinement left `code.sql` blank or still containing raw SQL.
 */
function generateMongooseSchema(bp: Blueprint): string {
  let out = `// Mongoose models generated by BuildX\nconst mongoose = require('mongoose');\nconst { Schema } = mongoose;\n`;

  for (const table of bp.schema) {
    const modelName = toPascalCase(table.table);
    out += `\nconst ${toCamelCase(table.table)}Schema = new Schema({\n`;
    const fields = table.columns
      .filter((col) => col.name.toLowerCase() !== 'id' && col.name.toLowerCase() !== '_id')
      .map((col) => {
        const fieldName = toCamelCase(col.name);
        const mType = sqlTypeToMongoose(col.type);
        const required = col.type.toUpperCase().includes('NOT NULL');
        const unique = col.type.toUpperCase().includes('UNIQUE');
        const opts: string[] = [`type: ${mType}`];
        if (required) opts.push('required: true');
        if (unique) opts.push('unique: true');
        return `  ${fieldName}: { ${opts.join(', ')} }`;
      });
    out += fields.join(',\n');
    out += `\n}, { timestamps: true });\n`;
    out += `const ${modelName} = mongoose.model('${modelName}', ${toCamelCase(table.table)}Schema);\n`;
  }

  const exportNames = bp.schema.map((t) => toPascalCase(t.table));
  out += `\nmodule.exports = { ${exportNames.join(', ')} };\n`;
  return out;
}

/** Detect whether a string looks like raw SQL (vs Mongoose/JS). */
function looksLikeSql(code: string): boolean {
  return /\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b|\bINSERT\s+INTO\b/i.test(code);
}

export function streamScaffoldZip(bp: Blueprint, res: Response): void {
  const appSlug = toKebabCase(bp.appName);
  const isMongo = bp.architecture.database.toLowerCase().includes('mongo');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${appSlug}-scaffold.zip"`
  );

  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => {
    console.error('[Scaffold] Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate project ZIP' });
    } else {
      res.destroy(); // Destroy socket to signal corrupted/partial download
    }
  });

  archive.pipe(res);

  // ─── Root files ────────────────────────────────────────
  archive.append(generateRootPackageJson(bp), { name: 'package.json' });
  archive.append(generateDockerCompose(bp), { name: 'docker-compose.yml' });
  archive.append(generateReadme(bp), { name: 'README.md' });
  archive.append(generateGitignore(), { name: '.gitignore' });

  // ─── Backend ───────────────────────────────────────────
  archive.append(generateBackendPackageJson(bp), { name: 'backend/package.json' });
  archive.append(generateBackendTsconfig(), { name: 'backend/tsconfig.json' });
  // Env example
  archive.append(generateEnvExample(bp), { name: 'backend/.env.example' });
  if (!isMongo) {
    archive.append(generatePrismaSchema(bp), { name: 'backend/prisma/schema.prisma' });
  }
  archive.append(generateBackendIndex(bp), { name: 'backend/src/index.ts' });
  archive.append(
    isPlausibleSourceCode(bp.code.backend, 'app.ts') ? bp.code.backend : generateBackendApp(bp),
    { name: 'backend/src/app.ts' }
  );

  // Route files — one per resource
  const resources = new Set<string>();
  for (const ep of bp.endpoints) {
    const parts = ep.path.split('/').filter(Boolean);
    if (parts.length >= 2) resources.add(parts[1]);
  }
  for (const resource of resources) {
    archive.append(generateRouteFile(
      resource,
      bp.endpoints,
      bp.architecture.backend.toLowerCase().includes('fastify')
    ), {
      name: `backend/src/routes/${resource}.ts`,
    });
  }

  // ─── Frontend ──────────────────────────────────────────
  const isNext = bp.architecture.frontend.toLowerCase().includes('next');
  archive.append(generateFrontendPackageJson(bp), { name: 'frontend/package.json' });
  archive.append(generateTailwindConfig(isNext), {
    name: isNext ? 'frontend/tailwind.config.cjs' : 'frontend/tailwind.config.js',
  });
  archive.append(generatePostcssConfig(isNext), {
    name: isNext ? 'frontend/postcss.config.cjs' : 'frontend/postcss.config.js',
  });
  if (!isNext) {
    archive.append(generateFrontendViteConfig(), { name: 'frontend/vite.config.ts' });
  }
  if (isNext) {
    archive.append(generateNextPage(bp), { name: 'frontend/src/app/page.tsx' });
    archive.append(generateNextLayout(bp), { name: 'frontend/src/app/layout.tsx' });
    archive.append('@tailwind base;\n@tailwind components;\n@tailwind utilities;\n', {
      name: 'frontend/src/app/globals.css',
    });
  } else {
    archive.append(
      isPlausibleSourceCode(bp.code.frontend, 'App.tsx') ? bp.code.frontend : generateFrontendApp(bp),
      { name: 'frontend/src/App.tsx' }
    );
    archive.append(
      `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
      { name: 'frontend/src/main.tsx' }
    );
    archive.append('@tailwind base;\n@tailwind components;\n@tailwind utilities;\n', {
      name: 'frontend/src/index.css',
    });
  }
  archive.append(generateApiClient(bp), { name: 'frontend/src/lib/api.ts' });

  // Page files — one per screen
  for (const screen of bp.screens) {
    const name = toPascalCase(screen.name.replace(/[^a-zA-Z0-9]/g, ''));
    archive.append(generateFrontendPage(screen), {
      name: `frontend/src/pages/${name}Page.tsx`,
    });
  }

  // Index HTML (Vite only; Next owns the document shell in layout.tsx)
  if (!isNext) {
    archive.append(
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${bp.appName}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`,
      { name: 'frontend/index.html' }
    );
  }

  // DB Schema File
  if (isMongo) {
    // For MongoDB, emit Mongoose models. Use the AI-provided code.sql ONLY if
    // it actually contains JS/Mongoose (not raw SQL and not empty); otherwise
    // generate models from bp.schema so schema.js is never blank.
    const aiCode = (bp.code.sql || '').trim();
    const useAiCode = aiCode.length > 0 && !looksLikeSql(aiCode);
    const mongoSchema = useAiCode ? aiCode : generateMongooseSchema(bp);
    archive.append(mongoSchema, { name: 'backend/schema.js' });
  } else {
    const sql = (bp.code.sql || '').trim();
    archive.append(sql.length > 0 ? sql : '-- No SQL schema generated', {
      name: 'backend/schema.sql',
    });
  }

  archive.finalize();
}

/**
 * Build a flat dictionary of all scaffold files (path → content).
 * This is the same set of files written to the ZIP archive, but returned
 * as a Record so the frontend Code Studio can display them inline.
 */
export function generateMonorepoFiles(bp: Blueprint): Record<string, string> {
  const files: Record<string, string> = {};
  const isMongo = bp.architecture.database.toLowerCase().includes('mongo');

  // ─── Root files ────────────────────────────────────────
  files['package.json'] = generateRootPackageJson(bp);
  files['docker-compose.yml'] = generateDockerCompose(bp);
  files['README.md'] = generateReadme(bp);
  files['.gitignore'] = generateGitignore();

  // ─── Backend ───────────────────────────────────────────
  files['backend/package.json'] = generateBackendPackageJson(bp);
  files['backend/tsconfig.json'] = generateBackendTsconfig();
  files['backend/.env.example'] = generateEnvExample(bp);
  if (!isMongo) {
    files['backend/prisma/schema.prisma'] = generatePrismaSchema(bp);
  }
  files['backend/src/index.ts'] = generateBackendIndex(bp);
  files['backend/src/app.ts'] = isPlausibleSourceCode(bp.code.backend, 'app.ts') ? bp.code.backend : generateBackendApp(bp);

  // Route files — one per resource
  const resources = new Set<string>();
  for (const ep of bp.endpoints) {
    const parts = ep.path.split('/').filter(Boolean);
    if (parts.length >= 2) resources.add(parts[1]);
  }
  for (const resource of resources) {
    files[`backend/src/routes/${resource}.ts`] = generateRouteFile(
      resource,
      bp.endpoints,
      bp.architecture.backend.toLowerCase().includes('fastify')
    );
  }

  // ─── Frontend ──────────────────────────────────────────
  const isNext = bp.architecture.frontend.toLowerCase().includes('next');
  files['frontend/package.json'] = generateFrontendPackageJson(bp);
  files[isNext ? 'frontend/tailwind.config.cjs' : 'frontend/tailwind.config.js'] = generateTailwindConfig(isNext);
  files[isNext ? 'frontend/postcss.config.cjs' : 'frontend/postcss.config.js'] = generatePostcssConfig(isNext);
  if (!isNext) {
    files['frontend/vite.config.ts'] = generateFrontendViteConfig();
  }
  if (isNext) {
    files['frontend/src/app/page.tsx'] = generateNextPage(bp);
    files['frontend/src/app/layout.tsx'] = generateNextLayout(bp);
    files['frontend/src/app/globals.css'] = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
  } else {
    files['frontend/src/App.tsx'] = isPlausibleSourceCode(bp.code.frontend, 'App.tsx') ? bp.code.frontend : generateFrontendApp(bp);
    files['frontend/src/main.tsx'] = `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`;
    files['frontend/src/index.css'] = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
  }
  files['frontend/src/lib/api.ts'] = generateApiClient(bp);

  // Page files — one per screen
  for (const screen of bp.screens) {
    const name = toPascalCase(screen.name.replace(/[^a-zA-Z0-9]/g, ''));
    files[`frontend/src/pages/${name}Page.tsx`] = generateFrontendPage(screen);
  }

  // Index HTML (Vite only; Next owns the document shell in layout.tsx)
  if (!isNext) {
    files['frontend/index.html'] = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${bp.appName}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`;
  }

  // DB Schema File
  if (isMongo) {
    const aiCode = (bp.code.sql || '').trim();
    const useAiCode = aiCode.length > 0 && !looksLikeSql(aiCode);
    files['backend/schema.js'] = useAiCode ? aiCode : generateMongooseSchema(bp);
  } else {
    const sql = (bp.code.sql || '').trim();
    files['backend/schema.sql'] = sql.length > 0 ? sql : '-- No SQL schema generated';
  }

  return files;
}
