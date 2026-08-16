import { Blueprint, BlueprintSchema } from './types';
import { generateMonorepoFiles } from './scaffold';

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type ValidMethod = (typeof VALID_METHODS)[number];

const META_KEYS = new Set(['id', 'idea', 'views', 'createdAt', 'isPublic']);

function safeMethod(m: unknown): ValidMethod {
  if (typeof m === 'string') {
    const upper = m.toUpperCase();
    if (VALID_METHODS.includes(upper as ValidMethod)) return upper as ValidMethod;
  }
  return 'GET';
}

function safeComplexity(c: unknown): 'Low' | 'Medium' | 'High' {
  if (c === 'Low' || c === 'Medium' || c === 'High') return c;
  if (typeof c === 'string') {
    const match = c.match(/\b(Low|Medium|High)\b/i);
    if (match) {
      const v = match[1];
      return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() as 'Low' | 'Medium' | 'High';
    }
  }
  return 'Medium';
}

const VALID_ARCHETYPES = [
  'B2C_STOREFRONT',
  'B2C_MOBILE_FEED',
  'B2B_SAAS_WORKSPACE',
  'DEVTOOL_CONSOLE',
  'TWO_SIDED_MARKETPLACE',
  'CREATOR_PORTAL',
] as const;

function safeArchetype(a: unknown): Blueprint['productArchetype'] {
  if (typeof a === 'string' && VALID_ARCHETYPES.includes(a as any)) {
    return a as Blueprint['productArchetype'];
  }
  return undefined;
}

const VALID_PARADIGMS = [
  'TOP_NAV_STOREFRONT',
  'LEFT_SIDEBAR_DASHBOARD',
  'MOBILE_EMULATOR_SHELL',
  'FULLSCREEN_CANVAS',
  'SPLIT_CONSOLE',
] as const;

function safeParadigm(p: unknown): Blueprint['layoutParadigm'] {
  if (typeof p === 'string' && VALID_PARADIGMS.includes(p as any)) {
    return p as Blueprint['layoutParadigm'];
  }
  return undefined;
}

export function deriveLayoutParadigm(partial: Record<string, unknown>): Blueprint['layoutParadigm'] {
  const explicit = safeParadigm(partial.layoutParadigm);
  if (explicit) return explicit;

  const text = `${partial.appName ?? ''} ${partial.name ?? ''} ${partial.title ?? ''} ${partial.description ?? ''} ${partial.idea ?? ''} ${partial.targetUsers ?? ''}`.toLowerCase();

  if (/(food|swift|delivery|store|shop|ecom|social|fit|restaurant|market|grocery|cart|menu|dish|order|biteswift|foodhub)/i.test(text)) {
    return 'TOP_NAV_STOREFRONT';
  }
  if (/(mobile|app|ios|android|fitness|fitpal|workout|feed|chat|photo|pal|media|story|reel)/i.test(text)) {
    return 'MOBILE_EMULATOR_SHELL';
  }
  if (/(dev|console|api|infra|terminal|cluster|codepro|devconnect|telemetry|monitor)/i.test(text)) {
    return 'SPLIT_CONSOLE';
  }
  return 'LEFT_SIDEBAR_DASHBOARD';
}

export function deriveProductArchetype(
  partial: Record<string, unknown>,
  layoutParadigm?: Blueprint['layoutParadigm']
): Blueprint['productArchetype'] {
  const explicit = safeArchetype(partial.productArchetype);
  if (explicit) return explicit;

  const paradigm = layoutParadigm || deriveLayoutParadigm(partial);
  if (paradigm === 'TOP_NAV_STOREFRONT') return 'B2C_STOREFRONT';
  if (paradigm === 'MOBILE_EMULATOR_SHELL') return 'B2C_MOBILE_FEED';
  if (paradigm === 'SPLIT_CONSOLE') return 'DEVTOOL_CONSOLE';
  return 'B2B_SAAS_WORKSPACE';
}

export function deriveLandingScreenId(
  partial: Record<string, unknown>,
  screens: Blueprint['screens']
): string | undefined {
  if (typeof partial.primaryLandingScreenId === 'string' && partial.primaryLandingScreenId.trim()) {
    return partial.primaryLandingScreenId.trim();
  }

  const allScreens = (screens && screens.length > 0)
    ? screens
    : Array.isArray(partial.uiScreens)
    ? (partial.uiScreens as any[]).map(s => ({
        name: String(s.name || s.title || s.label || 'Screen'),
        icon: String(s.icon || 'layout'),
        components: String(s.components || ''),
      }))
    : [];

  const landingKeywords = ['discovery', 'home', 'explore', 'feed', 'catalog', 'dashboard', 'pipeline', 'deals', 'overview', 'console', 'storefront'];
  const authKeywords = ['login', 'signup', 'sign-up', 'register', 'auth', 'onboarding', 'forgotpassword'];

  for (const kw of landingKeywords) {
    const found = allScreens.find(
      s => s.name.toLowerCase().includes(kw) && !authKeywords.some(a => s.name.toLowerCase().includes(a))
    );
    if (found) return found.name;
  }
  const firstNonAuth = allScreens.find(s => !authKeywords.some(a => s.name.toLowerCase().includes(a)));
  return firstNonAuth?.name || allScreens[0]?.name;
}

function unescapeString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

export function formatSQL(sql: string): string {
  if (!sql) return '';
  
  let cleanSql = sql.trim();
  const statements: string[] = [];
  let currentStatement = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;
  
  for (let i = 0; i < cleanSql.length; i++) {
    const char = cleanSql[i];
    const nextChar = cleanSql[i + 1] || '';
    
    // Handle comments
    if (!inDoubleQuote && !inSingleQuote) {
      if (char === '-' && nextChar === '-') {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        let comment = '';
        while (i < cleanSql.length && cleanSql[i] !== '\n') {
          comment += cleanSql[i];
          i++;
        }
        statements.push(comment.trim());
        continue;
      }
    }
    
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    }
    
    currentStatement += char;
    
    if (char === ';' && !inDoubleQuote && !inSingleQuote) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }
  
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  const formatted: string[] = [];
  for (let stmt of statements) {
    if (stmt.startsWith('--')) {
      formatted.push(stmt);
      continue;
    }
    
    const createTableMatch = stmt.match(/^(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)([a-zA-Z0-9_`"]+)\s*\(([\s\S]*)\);?$/i);
    if (createTableMatch) {
      const prefix = createTableMatch[1];
      const tableName = createTableMatch[2];
      const colsString = createTableMatch[3].trim();
      
      const columns: string[] = [];
      let current = '';
      let depth = 0;
      for (let j = 0; j < colsString.length; j++) {
        const c = colsString[j];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        
        if (c === ',' && depth === 0) {
          columns.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      if (current.trim()) {
        columns.push(current.trim());
      }
      
      const formattedCols = columns
        .map(col => `  ${col}`)
        .join(',\n');
        
      formatted.push(`${prefix.trim()} ${tableName} (\n${formattedCols}\n);`);
    } else {
      let formattedStmt = stmt;
      if (!formattedStmt.endsWith(';') && !formattedStmt.startsWith('--')) {
        formattedStmt += ';';
      }
      formatted.push(formattedStmt);
    }
  }
  
  return formatted.join('\n\n');
}

function stripMetaFields(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!META_KEYS.has(key)) out[key] = value;
  }
  return out;
}

export function applyBlueprintFallbacks(
  partial: Record<string, unknown>,
  options?: { skipScaffoldRegen?: boolean }
): Blueprint {
  const f = (partial.features as Record<string, unknown>) ?? {};
  const a = (partial.architecture as Record<string, unknown>) ?? {};
  const code = (partial.code as Record<string, unknown>) ?? {};
  const effort = (partial.effort as Record<string, unknown>) ?? {};
  const endpoints = Array.isArray(partial.endpoints) ? partial.endpoints : [];
  const rawSchema = Array.isArray(partial.schema) ? partial.schema : [];

  const dbName = String(a.database ?? 'PostgreSQL').toLowerCase();
  const isMongo = dbName.includes('mongo');

  // Normalize schema: MongoDB LLMs often return { collection, fields } instead of { table, columns }
  const schema = rawSchema.map((table: Record<string, unknown>) => {
    // Prefer 'table' but fall back to 'collection' (MongoDB style)
    const tableName = String(table.table ?? table.collection ?? 'table');
    // Prefer 'columns' but fall back to 'fields' (MongoDB style)
    const rawCols = Array.isArray(table.columns)
      ? table.columns
      : Array.isArray(table.fields)
      ? table.fields
      : [];

    return {
      table: tableName,
      columns: rawCols.map((col: Record<string, unknown>) => ({
        name: String(col.name ?? 'column'),
        type: String(col.type ?? 'TEXT'),
        ...(col.note != null && col.note !== '' ? { note: String(col.note) } : {}),
      })),
    };
  });

  // Build SQL / Mongoose code with fallback generation for MongoDB
  let sqlCode = unescapeString(String(code.sql ?? ''));
  const sqlTrimmed = sqlCode.trim();
  const sqlIsEmpty = !sqlTrimmed || sqlTrimmed === '-- No SQL generated';

  // If MongoDB and code.sql is empty, generate Mongoose schemas from the normalized schema
  if (isMongo && sqlIsEmpty && schema.length > 0) {
    sqlCode = generateMongooseSchemas(schema);
  } else if (!sqlCode) {
    sqlCode = '-- No SQL generated';
  }

  const rawScreens = Array.isArray(partial.screens)
    ? partial.screens
    : Array.isArray(partial.uiScreens)
    ? partial.uiScreens
    : [];

  const normalizedScreens: Blueprint['screens'] = rawScreens.map((screen: any) => ({
    name: String(screen.name ?? screen.title ?? screen.label ?? 'Screen'),
    icon: String(screen.icon ?? 'layout'),
    components: String(screen.components ?? ''),
  }));

  const layoutParadigm = deriveLayoutParadigm(partial);
  const productArchetype = deriveProductArchetype(partial, layoutParadigm);
  const primaryLandingScreenId = deriveLandingScreenId(partial, normalizedScreens);

  const blueprint: Blueprint = {
    appName: unescapeString(String(partial.appName ?? partial.name ?? partial.title ?? 'Untitled App').trim() || 'Untitled App'),
    description: unescapeString(String(partial.description ?? 'No description provided.').trim() || 'No description provided.'),
    targetUsers: unescapeString(String(partial.targetUsers ?? 'General users').trim() || 'General users'),
    complexity: safeComplexity(partial.complexity),
    features: {
      authentication: Array.isArray(f.authentication) ? f.authentication.map(String) : [],
      core: Array.isArray(f.core) ? f.core.map(String) : [],
      admin: Array.isArray(f.admin) ? f.admin.map(String) : [],
      optional: Array.isArray(f.optional) ? f.optional.map(String) : [],
    },
    schema,
    endpoints: endpoints.map((ep: Record<string, unknown>) => ({
      method: safeMethod(ep.method),
      path: String(ep.path ?? '/'),
      description: String(ep.description ?? ''),
      ...(ep.auth != null ? { auth: Boolean(ep.auth) } : {}),
    })),
    screens: normalizedScreens,
    productArchetype,
    layoutParadigm,
    primaryLandingScreenId,
    architecture: {
      frontend: String(a.frontend ?? 'React + TypeScript'),
      backend: String(a.backend ?? 'Node.js + Express'),
      database: String(a.database ?? 'PostgreSQL'),
      auth: String(a.auth ?? 'JWT'),
      hosting: String(a.hosting ?? 'Vercel + Railway'),
      flow: String(a.flow ?? 'Frontend → API → Database'),
    },
    code: {
      frontend: unescapeString(String(code.frontend ?? '// No frontend code generated')),
      backend: unescapeString(String(code.backend ?? '// No backend code generated')),
      sql: isMongo ? sqlCode : formatSQL(sqlCode),
      // Carry forward any existing files map (populated below if missing)
      files: (typeof code.files === 'object' && code.files !== null && !Array.isArray(code.files))
        ? code.files as Record<string, string>
        : undefined,
    },
    effort: {
      time: String(effort.time ?? 'Estimate unavailable'),
      complexity: String(effort.complexity ?? 'Medium'),
      cost: String(effort.cost ?? 'Contact for estimate'),
      team: String(effort.team ?? '2-3 developers'),
    },
    // Carry forward any agent-generated diagrams
    ...(partial.diagrams && typeof partial.diagrams === 'object'
      ? { diagrams: partial.diagrams as Blueprint['diagrams'] }
      : {}),
    ...(typeof partial.githubUrl === 'string' && partial.githubUrl.trim() && partial.githubUrl.includes('github.com')
      ? { githubUrl: partial.githubUrl.trim() }
      : {}),
    ...(typeof partial.modelUsed === 'string' && partial.modelUsed.trim()
      ? { modelUsed: partial.modelUsed.trim() }
      : {}),
  };

  // Auto-populate code.files for AI output — skip when loading an already-saved blueprint
  const hasDbMismatch = blueprint.code.files && (
    isMongo
      ? (!blueprint.code.files['backend/schema.js'] || blueprint.code.files['backend/prisma/schema.prisma'])
      : (!blueprint.code.files['backend/schema.sql'] || blueprint.code.files['backend/schema.js'])
  );

  if (
    !options?.skipScaffoldRegen &&
    (!blueprint.code.files || Object.keys(blueprint.code.files).length === 0 || hasDbMismatch)
  ) {
    try {
      blueprint.code.files = generateMonorepoFiles(blueprint);
    } catch {
      // Non-critical: if scaffold generation fails, code.files stays undefined
      // and the frontend CodeStudio will fall back to the legacy tab view.
    }
  }

  // Ensure that files in the folder tree stay in sync with the top-level custom code properties
  if (blueprint.code.files) {
    if (blueprint.code.frontend && blueprint.code.frontend.trim()) {
      blueprint.code.files['frontend/src/App.tsx'] = blueprint.code.frontend;
    }
    if (blueprint.code.backend && blueprint.code.backend.trim()) {
      blueprint.code.files['backend/src/app.ts'] = blueprint.code.backend;
    }
    if (blueprint.code.sql && blueprint.code.sql.trim()) {
      if (isMongo) {
        blueprint.code.files['backend/schema.js'] = blueprint.code.sql;
        // Remove stale SQL/Prisma files for MongoDB projects
        delete blueprint.code.files['backend/schema.sql'];
        delete blueprint.code.files['backend/prisma/schema.prisma'];
      } else {
        blueprint.code.files['backend/schema.sql'] = blueprint.code.sql;
        // Remove stale Mongoose files for SQL projects
        delete blueprint.code.files['backend/schema.js'];
      }
    }
  }

  return blueprint;
}

/** Generate Mongoose schema code from normalized schema tables (for MongoDB blueprints). */
function generateMongooseSchemas(
  schema: Array<{ table: string; columns: Array<{ name: string; type: string; note?: string }> }>
): string {
  const lines: string[] = [
    "const mongoose = require('mongoose');",
    '',
  ];

  for (const table of schema) {
    const modelName = table.table.charAt(0).toUpperCase() + table.table.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const schemaName = `${modelName}Schema`;

    lines.push(`// ── ${modelName} ─────────────────────────`);
    lines.push(`const ${schemaName} = new mongoose.Schema({`);

    for (const col of table.columns) {
      if (col.name === '_id' || col.name === 'id') continue; // Mongoose auto-generates _id
      const mongoType = mapToMongooseType(col.type);
      const extras: string[] = [];
      if (col.note) {
        const noteLower = col.note.toLowerCase();
        if (noteLower.includes('unique')) extras.push('unique: true');
        if (noteLower.includes('required') || noteLower.includes('not null')) extras.push('required: true');
        if (noteLower.includes('ref:') || noteLower.includes('fk')) {
          const refMatch = col.note.match(/ref:\s*(\w+)/i);
          if (refMatch) {
            const refModel = refMatch[1].charAt(0).toUpperCase() + refMatch[1].slice(1);
            lines.push(`  ${col.name}: { type: mongoose.Schema.Types.ObjectId, ref: '${refModel}' },`);
            continue;
          }
        }
      }
      if (extras.length > 0) {
        lines.push(`  ${col.name}: { type: ${mongoType}, ${extras.join(', ')} },`);
      } else {
        lines.push(`  ${col.name}: ${mongoType},`);
      }
    }

    lines.push('}, { timestamps: true });');
    lines.push('');
    lines.push(`const ${modelName} = mongoose.model('${modelName}', ${schemaName});`);
    lines.push('');
  }

  lines.push(`module.exports = { ${schema.map(t => {
    const n = t.table.charAt(0).toUpperCase() + t.table.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return n;
  }).join(', ')} };`);

  return lines.join('\n');
}

function mapToMongooseType(sqlType: string): string {
  const t = sqlType.toUpperCase();
  if (t.includes('OBJECTID')) return 'mongoose.Schema.Types.ObjectId';
  if (t.includes('INT') || t.includes('SERIAL') || t.includes('FLOAT') || t.includes('DECIMAL') || t.includes('NUMERIC') || t === 'NUMBER') return 'Number';
  if (t.includes('BOOL')) return 'Boolean';
  if (t.includes('DATE') || t.includes('TIMESTAMP')) return 'Date';
  if (t.includes('JSON') || t.includes('OBJECT') || t.includes('MIXED')) return 'mongoose.Schema.Types.Mixed';
  if (t.includes('ARRAY') || t === '[]') return '[mongoose.Schema.Types.Mixed]';
  return 'String';
}

/** Coerce client-sent blueprint payloads (including saved metadata) into a valid Blueprint. */
export function coerceBlueprintInput(
  input: unknown,
  options?: { skipScaffoldRegen?: boolean }
): Blueprint {
  const partial =
    typeof input === 'object' && input !== null
      ? stripMetaFields(input as Record<string, unknown>)
      : {};

  const withFallbacks = applyBlueprintFallbacks(partial, options);
  const result = BlueprintSchema.safeParse(withFallbacks);
  return result.success ? result.data : withFallbacks;
}
