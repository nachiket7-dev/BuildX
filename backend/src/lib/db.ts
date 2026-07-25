import { Pool } from 'pg';
import crypto from 'crypto';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import type { Blueprint } from './types';
import { coerceBlueprintInput } from './normalizeBlueprint';

// Force Node to prefer IPv4 over IPv6. This MUST run before new Pool()
dns.setDefaultResultOrder('ipv4first');

// ─── Local Database Fallback Config ────────────────────────
// Opt-in only: set ALLOW_DB_FALLBACK=true in .env (dev emergency use).
const LOCAL_DB_PATH = path.join(__dirname, '../../data/local_db.json');
const EMPTY_LOCAL_DB: LocalDbSchema = {
  users: [],
  blueprints: [],
  chat_messages: [],
  model_usage: [],
  blueprint_files: [],
};

function isFallbackAllowed(): boolean {
  return process.env.ALLOW_DB_FALLBACK === 'true';
}

/** Remote Postgres (Supabase, Railway, etc.) needs SSL even when NODE_ENV=development */
function poolSsl(connectionString?: string): false | { rejectUnauthorized: boolean } {
  if (!connectionString) return false;
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return false;
  return { rejectUnauthorized: false };
}

interface LocalDbSchema {
  users: any[];
  blueprints: any[];
  chat_messages: any[];
  model_usage: any[];
  blueprint_files: any[];
}

function readLocalDb(): LocalDbSchema {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      return { ...EMPTY_LOCAL_DB };
    }
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local fallback database:', err);
    return { ...EMPTY_LOCAL_DB };
  }
}

let localDbWriteQueue: Promise<void> = Promise.resolve();

function writeLocalDb(data: LocalDbSchema) {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local fallback database:', err);
  }
}

function withLocalDbLock<T>(fn: () => T): Promise<T> {
  const run = localDbWriteQueue.then(() => fn());
  localDbWriteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// ─── Init ──────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: poolSsl(process.env.DATABASE_URL),
  max: 10,
});

export type DatabaseMode = 'postgresql' | 'fallback' | 'unconfigured';

let dbMode: DatabaseMode = 'unconfigured';
let initError: string | null = null;
let initPromise: Promise<void> | null = null;

export function getDatabaseStatus(): {
  mode: DatabaseMode;
  error: string | null;
  fallbackAllowed: boolean;
  fallbackPath: string;
} {
  return {
    mode: dbMode,
    error: initError,
    fallbackAllowed: isFallbackAllowed(),
    fallbackPath: LOCAL_DB_PATH,
  };
}

async function ensureDb() {
  if (initPromise) return initPromise;
  initPromise = initDatabase();
  return initPromise;
}

async function initDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    if (isFallbackAllowed()) {
      dbMode = 'fallback';
      initError = 'DATABASE_URL is not set';
      console.warn(
        '⚠️ No DATABASE_URL — using local JSON fallback (ALLOW_DB_FALLBACK=true).',
        LOCAL_DB_PATH
      );
      return;
    }
    initError = 'DATABASE_URL is not set';
    throw new Error(
      'DATABASE_URL is required. Set it in backend/.env or set ALLOW_DB_FALLBACK=true for local JSON only.'
    );
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            email      TEXT NOT NULL UNIQUE,
            password   TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS blueprints (
            id         TEXT PRIMARY KEY,
            idea       TEXT NOT NULL,
            blueprint  TEXT NOT NULL,
            user_id    TEXT REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            views      INTEGER NOT NULL DEFAULT 0,
            is_public  BOOLEAN NOT NULL DEFAULT false
          );

          CREATE TABLE IF NOT EXISTS chat_messages (
            id           SERIAL PRIMARY KEY,
            blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
            user_id      TEXT NOT NULL REFERENCES users(id),
            role         TEXT NOT NULL,
            content      TEXT NOT NULL,
            created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS model_usage (
            user_id TEXT NOT NULL REFERENCES users(id),
            model TEXT NOT NULL,
            date DATE NOT NULL DEFAULT CURRENT_DATE,
            count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, model, date)
          );

          CREATE TABLE IF NOT EXISTS blueprint_files (
            id           TEXT PRIMARY KEY,
            blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
            file_path    TEXT NOT NULL,
            content      TEXT NOT NULL,
            language     TEXT NOT NULL,
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (blueprint_id, file_path)
          );
        `);

        // Migration: add is_public column if it doesn't exist (for existing databases)
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'blueprints' AND column_name = 'is_public'
            ) THEN
              ALTER TABLE blueprints ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;
            END IF;
          END $$;
        `);

        // Migration: add github_id and github_token columns if they don't exist
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'users' AND column_name = 'github_id'
            ) THEN
              ALTER TABLE users ADD COLUMN github_id TEXT UNIQUE;
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'users' AND column_name = 'github_token'
            ) THEN
              ALTER TABLE users ADD COLUMN github_token TEXT;
            END IF;
          END $$;
        `);

        // Enable RLS and setup policies for the users table
        await client.query(`
          DO $$
          BEGIN
            -- Enable RLS on users table
            ALTER TABLE users ENABLE ROW LEVEL SECURITY;

            -- If supabase roles and auth schema exist, set grants and policies
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
              EXECUTE 'REVOKE ALL ON users FROM anon';
            END IF;

            IF EXISTS (
              SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
            ) AND EXISTS (
              SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'auth' AND pg_proc.proname = 'uid'
            ) THEN
              EXECUTE 'REVOKE ALL ON users FROM authenticated';
              EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated';
              
              -- Setup policies
              DROP POLICY IF EXISTS "Users can view their own profile" ON users;
              CREATE POLICY "Users can view their own profile" ON users FOR SELECT TO authenticated USING (auth.uid()::text = id);

              DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
              CREATE POLICY "Users can insert their own profile" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = id);

              DROP POLICY IF EXISTS "Users can update their own profile" ON users;
              CREATE POLICY "Users can update their own profile" ON users FOR UPDATE TO authenticated USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);
            END IF;

            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
              EXECUTE 'GRANT ALL ON users TO service_role';
            END IF;
          END $$;
        `);
      dbMode = 'postgresql';
      initError = null;
      console.log('✅ PostgreSQL database initialized successfully.');
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    initError = message;
    console.error('❌ Failed to connect to PostgreSQL database:', message);

    if (isFallbackAllowed()) {
      dbMode = 'fallback';
      console.warn(
        '⚠️ Using local JSON fallback (ALLOW_DB_FALLBACK=true).',
        LOCAL_DB_PATH
      );
      return;
    }

    throw new Error(
      `PostgreSQL connection failed: ${message}. Fix DATABASE_URL or set ALLOW_DB_FALLBACK=true for dev JSON only.`
    );
  }
}

// Call init on startup (errors surface in logs; routes fail on first DB use if misconfigured)
ensureDb().catch((err) => {
  console.error('[DB] Startup initialization failed:', err.message);
});

// ─── Helpers ───────────────────────────────────────────────

/** Generate a short, URL-safe ID (8 characters) */
function generateId(): string {
  return crypto.randomBytes(6).toString('base64url'); // 8 chars
}

// ─── Exports ───────────────────────────────────────────────

export interface SavedBlueprintRow {
  id: string;
  idea: string;
  blueprint: string; // JSON string
  createdAt: string;
  views: number;
  isPublic: boolean;
}

export interface SavedBlueprintMeta {
  id: string;
  idea: string;
  createdAt: string;
  views: number;
}

/** UTC calendar date — matches explicit date passed to Postgres usage rows */
function usageDateUTC(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getUsageCount(userId: string, model: string): Promise<number> {
  await ensureDb();
  const date = usageDateUTC();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const usage = db.model_usage.find(
      (u) => u.user_id === userId && u.model === model && u.date === date
    );
    return usage?.count ?? 0;
  }

  const result = await pool.query(
    'SELECT count FROM model_usage WHERE user_id = $1 AND model = $2 AND date = $3',
    [userId, model, date]
  );
  return result.rows[0]?.count ?? 0;
}

export function assertWithinUsageLimit(count: number, model: string, limit: number): void {
  if (count >= limit) {
    throw new Error(
      `Daily limit of ${limit} requests reached for model ${model}. Please try again tomorrow or use another model.`
    );
  }
}

export async function incrementUsage(userId: string, model: string): Promise<void> {
  await ensureDb();
  const date = usageDateUTC();

  if (dbMode === 'fallback') {
    await withLocalDbLock(() => {
      const db = readLocalDb();
      let usage = db.model_usage.find(
        (u) => u.user_id === userId && u.model === model && u.date === date
      );
      if (!usage) {
        db.model_usage.push({ user_id: userId, model, date, count: 1 });
      } else {
        usage.count += 1;
      }
      writeLocalDb(db);
    });
    return;
  }

  await pool.query(
    `INSERT INTO model_usage (user_id, model, date, count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, model, date)
     DO UPDATE SET count = model_usage.count + 1`,
    [userId, model, date]
  );
}

/** @deprecated Prefer assertWithinUsageLimit + incrementUsage */
export async function checkAndIncrementUsage(userId: string, model: string, limit: number): Promise<void> {
  const count = await getUsageCount(userId, model);
  assertWithinUsageLimit(count, model, limit);
  await incrementUsage(userId, model);
}

export async function saveBlueprint(
  idea: string,
  blueprint: Blueprint,
  userId: string,
  isPublic: boolean = false
): Promise<string> {
  await ensureDb();
  const id = generateId();

  if (dbMode === 'fallback') {
    await withLocalDbLock(() => {
      const db = readLocalDb();
      db.blueprints.push({
        id,
        idea,
        blueprint: JSON.stringify(blueprint),
        user_id: userId,
        is_public: isPublic,
        created_at: new Date().toISOString(),
        views: 0,
      });
      writeLocalDb(db);
    });
    return id;
  }

  await pool.query(
    'INSERT INTO blueprints (id, idea, blueprint, user_id, is_public) VALUES ($1, $2, $3, $4, $5)',
    [id, idea, JSON.stringify(blueprint), userId, isPublic]
  );
  return id;
}

interface BlueprintRecord {
  id: string;
  idea: string;
  blueprint: string;
  userId: string | null;
  createdAt: string;
  views: number;
  isPublic: boolean;
}

function parseBlueprintJson(raw: string, id: string): Blueprint {
  try {
    const parsed = JSON.parse(raw);
    // Saved blueprints are already complete — normalize without regenerating scaffolds
    return coerceBlueprintInput(parsed, { skipScaffoldRegen: true });
  } catch {
    throw new Error(`Blueprint ${id} contains invalid JSON`);
  }
}

async function fetchBlueprintRecord(id: string): Promise<BlueprintRecord | null> {
  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const row = db.blueprints.find((bp) => bp.id === id);
    if (!row) return null;
    return {
      id: row.id,
      idea: row.idea,
      blueprint: row.blueprint,
      userId: row.user_id ?? null,
      createdAt: new Date(row.created_at).toISOString(),
      views: row.views,
      isPublic: Boolean(row.is_public),
    };
  }

  const result = await pool.query(
    `SELECT id, idea, blueprint, user_id as "userId", created_at as "createdAt", views, is_public as "isPublic"
     FROM blueprints WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    idea: row.idea,
    blueprint: row.blueprint,
    userId: row.userId ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    views: row.views,
    isPublic: Boolean(row.isPublic),
  };
}

function canAccessBlueprint(record: BlueprintRecord, requestUserId: string): boolean {
  return record.userId === requestUserId || record.isPublic;
}

async function incrementBlueprintViews(id: string): Promise<void> {
  if (dbMode === 'fallback') {
    await withLocalDbLock(() => {
      const db = readLocalDb();
      const row = db.blueprints.find((bp) => bp.id === id);
      if (row) {
        row.views += 1;
        writeLocalDb(db);
      }
    });
    return;
  }
  await pool.query('UPDATE blueprints SET views = views + 1 WHERE id = $1', [id]);
}

/** Load blueprint without ownership restrictions (used for sandbox preview rendering). Returns null if missing. */
export async function getBlueprintAny(
  id: string
): Promise<(SavedBlueprintRow & { parsedBlueprint: Blueprint }) | null> {
  await ensureDb();
  const record = await fetchBlueprintRecord(id);
  if (!record) return null;

  return {
    id: record.id,
    idea: record.idea,
    blueprint: record.blueprint,
    createdAt: record.createdAt,
    views: record.views,
    isPublic: record.isPublic,
    parsedBlueprint: parseBlueprintJson(record.blueprint, id),
  };
}

/** Load blueprint if the user owns it or it is marked public. Returns null if missing or forbidden. */
export async function getBlueprintForUser(
  id: string,
  requestUserId: string,
  options: { incrementViews?: boolean } = {}
): Promise<(SavedBlueprintRow & { parsedBlueprint: Blueprint; userId: string | null }) | null> {
  await ensureDb();
  const { incrementViews = true } = options;

  const record = await fetchBlueprintRecord(id);
  if (!record || !canAccessBlueprint(record, requestUserId)) {
    return null;
  }

  if (incrementViews) {
    await incrementBlueprintViews(id);
    record.views += 1;
  }

  return {
    id: record.id,
    idea: record.idea,
    blueprint: record.blueprint,
    createdAt: record.createdAt,
    views: record.views,
    isPublic: record.isPublic,
    userId: record.userId,
    parsedBlueprint: parseBlueprintJson(record.blueprint, id),
  };
}

export async function updateBlueprintJson(
  id: string,
  userId: string,
  blueprint: Blueprint
): Promise<boolean> {
  await ensureDb();
  const payload = JSON.stringify(blueprint);

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      const row = db.blueprints.find((b) => b.id === id && b.user_id === userId);
      if (!row) return false;
      row.blueprint = payload;
      writeLocalDb(db);
      return true;
    });
  }

  const result = await pool.query(
    'UPDATE blueprints SET blueprint = $1 WHERE id = $2 AND user_id = $3',
    [payload, id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/** @deprecated Use getBlueprintForUser — kept for internal export checks */
export async function getBlueprint(
  id: string,
  requestUserId: string
): Promise<(SavedBlueprintRow & { parsedBlueprint: Blueprint }) | null> {
  const row = await getBlueprintForUser(id, requestUserId);
  if (!row) return null;
  const { userId: _u, ...rest } = row;
  return rest;
}

export async function getBlueprintMeta(
  id: string,
  requestUserId: string
): Promise<SavedBlueprintMeta | null> {
  await ensureDb();
  const record = await fetchBlueprintRecord(id);
  if (!record || !canAccessBlueprint(record, requestUserId)) {
    return null;
  }
  return {
    id: record.id,
    idea: record.idea,
    createdAt: record.createdAt,
    views: record.views,
  };
}

// ─── List blueprints ───────────────────────────────────────

export interface BlueprintListItem {
  id: string;
  idea: string;
  appName: string;
  description: string;
  complexity: string;
  createdAt: string;
  views: number;
}

export async function listBlueprints(limit: number = 20): Promise<BlueprintListItem[]> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const publicBps = db.blueprints
      .filter(bp => bp.is_public === true)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return publicBps.map((row) => {
      let appName = 'Untitled';
      let description = '';
      let complexity = 'Medium';
      try {
        const bp = JSON.parse(row.blueprint);
        appName = bp.appName || appName;
        description = bp.description || description;
        complexity = bp.complexity || complexity;
      } catch {
        // ignore parse errors
      }
      return {
        id: row.id,
        idea: row.idea,
        appName,
        description,
        complexity,
        createdAt: new Date(row.created_at).toISOString(),
        views: row.views,
      };
    });
  }

  const result = await pool.query(
    'SELECT id, idea, blueprint, created_at as "createdAt", views FROM blueprints WHERE is_public = true ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  
  return result.rows.map((row) => {
    let appName = 'Untitled';
    let description = '';
    let complexity = 'Medium';
    try {
      const bp = JSON.parse(row.blueprint);
      appName = bp.appName || appName;
      description = bp.description || description;
      complexity = bp.complexity || complexity;
    } catch {
      // ignore parse errors
    }
    return {
      id: row.id,
      idea: row.idea,
      appName,
      description,
      complexity,
      createdAt: new Date(row.createdAt).toISOString(),
      views: row.views,
    };
  });
}

export async function updateBlueprintVisibility(blueprintId: string, userId: string, isPublic: boolean): Promise<boolean> {
  await ensureDb();

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      const bp = db.blueprints.find(b => b.id === blueprintId && b.user_id === userId);
      if (!bp) return false;
      bp.is_public = isPublic;
      writeLocalDb(db);
      return true;
    });
  }

  const result = await pool.query(
    'UPDATE blueprints SET is_public = $1 WHERE id = $2 AND user_id = $3',
    [isPublic, blueprintId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function closeDb(): Promise<void> {
  if (dbMode === 'fallback') return;
  await pool.end();
}

// ─── User management ──────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
  githubId?: string;
  githubToken?: string;
}

export async function createUser(name: string, email: string, hashedPassword: string): Promise<string> {
  await ensureDb();
  const id = generateId();

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      if (db.users.some((u) => u.email === email)) {
        const err = new Error('duplicate_email') as Error & { code: string };
        err.code = '23505';
        throw err;
      }
      db.users.push({
        id,
        name,
        email,
        password: hashedPassword,
        created_at: new Date().toISOString(),
      });
      writeLocalDb(db);
      return id;
    });
  }

  await pool.query(
    'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
    [id, name, email, hashedPassword]
  );
  return id;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const row = db.users.find(u => u.email === email);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      createdAt: new Date(row.created_at).toISOString(),
      githubId: row.github_id,
      githubToken: row.github_token
    };
  }

  const result = await pool.query(
    'SELECT id, name, email, password, created_at as "createdAt", github_id as "githubId", github_token as "githubToken" FROM users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    createdAt: new Date(row.createdAt).toISOString(),
    githubId: row.githubId,
    githubToken: row.githubToken
  };
}

export async function getUserById(id: string): Promise<Omit<UserRow, 'password'> | null> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const row = db.users.find(u => u.id === id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: new Date(row.created_at).toISOString(),
      githubId: row.github_id,
      githubToken: row.github_token
    };
  }

  const result = await pool.query(
    'SELECT id, name, email, created_at as "createdAt", github_id as "githubId", github_token as "githubToken" FROM users WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: new Date(row.createdAt).toISOString(),
    githubId: row.githubId,
    githubToken: row.githubToken
  };
}

export async function getUserByGithubId(githubId: string): Promise<UserRow | null> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const row = db.users.find(u => u.github_id === githubId);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      createdAt: new Date(row.created_at).toISOString(),
      githubId: row.github_id,
      githubToken: row.github_token
    };
  }

  const result = await pool.query(
    'SELECT id, name, email, password, created_at as "createdAt", github_id as "githubId", github_token as "githubToken" FROM users WHERE github_id = $1',
    [githubId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    createdAt: new Date(row.createdAt).toISOString(),
    githubId: row.githubId,
    githubToken: row.githubToken
  };
}

export async function createGithubUser(name: string, email: string, githubId: string, githubToken: string): Promise<string> {
  await ensureDb();
  const id = generateId();
  const placeholderPassword = crypto.randomBytes(16).toString('hex');

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      if (db.users.some((u) => u.email === email)) {
        const err = new Error('duplicate_email') as Error & { code: string };
        err.code = '23505';
        throw err;
      }
      db.users.push({
        id,
        name,
        email,
        password: placeholderPassword,
        github_id: githubId,
        github_token: githubToken,
        created_at: new Date().toISOString(),
      });
      writeLocalDb(db);
      return id;
    });
  }

  await pool.query(
    'INSERT INTO users (id, name, email, password, github_id, github_token) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, name, email, placeholderPassword, githubId, githubToken]
  );
  return id;
}

export async function linkUserGithub(userId: string, githubId: string, githubToken: string): Promise<boolean> {
  await ensureDb();

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      const row = db.users.find((u) => u.id === userId);
      if (!row) return false;
      row.github_id = githubId;
      row.github_token = githubToken;
      writeLocalDb(db);
      return true;
    });
  }

  const result = await pool.query(
    'UPDATE users SET github_id = $1, github_token = $2 WHERE id = $3',
    [githubId, githubToken, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── User blueprints ──────────────────────────────────────

export async function listUserBlueprints(userId: string, limit: number = 30): Promise<BlueprintListItem[]> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const userBps = db.blueprints
      .filter(bp => bp.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return userBps.map((row) => {
      let appName = 'Untitled';
      let description = '';
      let complexity = 'Medium';
      try {
        const bp = JSON.parse(row.blueprint);
        appName = bp.appName || appName;
        description = bp.description || description;
        complexity = bp.complexity || complexity;
      } catch {
        // ignore
      }
      return { 
        id: row.id, 
        idea: row.idea, 
        appName, 
        description, 
        complexity, 
        createdAt: new Date(row.created_at).toISOString(), 
        views: row.views 
      };
    });
  }

  const result = await pool.query(
    'SELECT id, idea, blueprint, created_at as "createdAt", views FROM blueprints WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  
  return result.rows.map((row) => {
    let appName = 'Untitled';
    let description = '';
    let complexity = 'Medium';
    try {
      const bp = JSON.parse(row.blueprint);
      appName = bp.appName || appName;
      description = bp.description || description;
      complexity = bp.complexity || complexity;
    } catch {
      // ignore
    }
    return { 
      id: row.id, 
      idea: row.idea, 
      appName, 
      description, 
      complexity, 
      createdAt: new Date(row.createdAt).toISOString(), 
      views: row.views 
    };
  });
}

// ─── Chat messages ────────────────────────────────────────

export interface ChatMessageRow {
  id: number;
  blueprintId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
}

export async function saveChatMessage(blueprintId: string, userId: string, role: string, content: string): Promise<void> {
  await ensureDb();

  if (dbMode === 'fallback') {
    await withLocalDbLock(() => {
      const db = readLocalDb();
      const id = db.chat_messages.length + 1;
      db.chat_messages.push({
        id,
        blueprint_id: blueprintId,
        user_id: userId,
        role,
        content,
        created_at: new Date().toISOString()
      });
      writeLocalDb(db);
    });
    return;
  }

  await pool.query(
    'INSERT INTO chat_messages (blueprint_id, user_id, role, content) VALUES ($1, $2, $3, $4)',
    [blueprintId, userId, role, content]
  );
}

export async function getChatMessages(blueprintId: string, userId: string): Promise<ChatMessageRow[]> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    const msgs = db.chat_messages
      .filter(m => m.blueprint_id === blueprintId && m.user_id === userId)
      .sort((a, b) => a.id - b.id);
    
    return msgs.map(m => ({
      id: m.id,
      blueprintId: m.blueprint_id,
      userId: m.user_id,
      role: m.role,
      content: m.content,
      createdAt: new Date(m.created_at).toISOString()
    }));
  }

  const result = await pool.query(
    'SELECT id, blueprint_id as "blueprintId", user_id as "userId", role, content, created_at as "createdAt" FROM chat_messages WHERE blueprint_id = $1 AND user_id = $2 ORDER BY created_at ASC',
    [blueprintId, userId]
  );
  return result.rows.map(row => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString()
  }));
}

// ─── Blueprint management ─────────────────────────────────

export async function renameBlueprint(id: string, userId: string, newTitle: string): Promise<boolean> {
  await ensureDb();

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      const bp = db.blueprints.find(b => b.id === id && b.user_id === userId);
      if (!bp) return false;
      try {
        const parsed = JSON.parse(bp.blueprint);
        parsed.appName = newTitle;
        bp.blueprint = JSON.stringify(parsed);
      } catch (err) {
        console.error('Error updating fallback local blueprint JSON for rename:', err);
      }
      writeLocalDb(db);
      return true;
    });
  }

  // Fetch the blueprint first to update the appName in the JSON string
  const selectRes = await pool.query(
    'SELECT blueprint FROM blueprints WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (selectRes.rows.length === 0) {
    return false;
  }

  let updatedBlueprint = selectRes.rows[0].blueprint;
  try {
    const parsed = JSON.parse(updatedBlueprint);
    parsed.appName = newTitle;
    updatedBlueprint = JSON.stringify(parsed);
  } catch (err) {
    console.error('Error parsing blueprint JSON for rename:', err);
  }

  const result = await pool.query(
    'UPDATE blueprints SET blueprint = $1 WHERE id = $2 AND user_id = $3',
    [updatedBlueprint, id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteBlueprint(id: string, userId: string): Promise<boolean> {
  await ensureDb();

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      const index = db.blueprints.findIndex(b => b.id === id && b.user_id === userId);
      if (index === -1) return false;
      db.blueprints.splice(index, 1);
      db.chat_messages = db.chat_messages.filter(m => m.blueprint_id !== id);
      if (db.blueprint_files) {
        db.blueprint_files = db.blueprint_files.filter(f => f.blueprint_id !== id);
      }
      writeLocalDb(db);
      return true;
    });
  }

  // Chat messages and blueprint files will be deleted automatically due to ON DELETE CASCADE
  const result = await pool.query(
    'DELETE FROM blueprints WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export interface SavedBlueprintFile {
  path: string;
  content: string;
  language: string;
}

/** Remove all generated virtual files for a blueprint (e.g. after refine/regenerate). */
export async function clearBlueprintFiles(blueprintId: string): Promise<void> {
  await ensureDb();

  if (dbMode === 'fallback') {
    return withLocalDbLock(() => {
      const db = readLocalDb();
      if (db.blueprint_files) {
        db.blueprint_files = db.blueprint_files.filter((f) => f.blueprint_id !== blueprintId);
      }
      writeLocalDb(db);
    });
  }

  await pool.query('DELETE FROM blueprint_files WHERE blueprint_id = $1', [blueprintId]);
}

export async function saveBlueprintFile(
  blueprintId: string,
  filePath: string,
  content: string,
  language: string
): Promise<void> {
  await ensureDb();
  const fileId = `${blueprintId}:${filePath}`;

  if (dbMode === 'fallback') {
    await withLocalDbLock(() => {
      const db = readLocalDb();
      if (!db.blueprint_files) db.blueprint_files = [];
      const index = db.blueprint_files.findIndex(f => f.blueprint_id === blueprintId && f.file_path === filePath);
      
      const fileRecord = {
        id: fileId,
        blueprint_id: blueprintId,
        file_path: filePath,
        content,
        language,
        generated_at: new Date().toISOString()
      };

      if (index > -1) {
        db.blueprint_files[index] = fileRecord;
      } else {
        db.blueprint_files.push(fileRecord);
      }
      writeLocalDb(db);
    });
    return;
  }

  // UPSERT using Postgres ON CONFLICT clause
  await pool.query(
    `INSERT INTO blueprint_files (id, blueprint_id, file_path, content, language)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (blueprint_id, file_path)
     DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language`,
    [fileId, blueprintId, filePath, content, language]
  );
}

export async function getBlueprintFiles(blueprintId: string): Promise<SavedBlueprintFile[]> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    if (!db.blueprint_files) return [];
    return db.blueprint_files
      .filter(f => f.blueprint_id === blueprintId)
      .map(f => ({
        path: f.file_path,
        content: f.content,
        language: f.language
      }));
  }

  const result = await pool.query(
    'SELECT file_path as "path", content, language FROM blueprint_files WHERE blueprint_id = $1 ORDER BY file_path ASC',
    [blueprintId]
  );
  return result.rows;
}

export async function getBlueprintFile(blueprintId: string, filePath: string): Promise<SavedBlueprintFile | null> {
  await ensureDb();

  if (dbMode === 'fallback') {
    const db = readLocalDb();
    if (!db.blueprint_files) return null;
    const file = db.blueprint_files.find(f => f.blueprint_id === blueprintId && f.file_path === filePath);
    if (!file) return null;
    return {
      path: file.file_path,
      content: file.content,
      language: file.language
    };
  }

  const result = await pool.query(
    'SELECT file_path as "path", content, language FROM blueprint_files WHERE blueprint_id = $1 AND file_path = $2',
    [blueprintId, filePath]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}


