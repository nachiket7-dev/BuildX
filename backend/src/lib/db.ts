import { Pool } from 'pg';
import crypto from 'crypto';
import dns from 'dns';
import type { Blueprint } from './types';

// Force Node to prefer IPv4 over IPv6. This MUST run before new Pool()
dns.setDefaultResultOrder('ipv4first');

// ─── Init ──────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

// Create tables if they don't exist
async function initDb() {
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
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
    client.release();
    throw err; // Crash early — don't run with a broken DB
  }
  client.release();
}

// Call init on startup
initDb();

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
}

export interface SavedBlueprintMeta {
  id: string;
  idea: string;
  createdAt: string;
  views: number;
}

export async function checkAndIncrementUsage(userId: string, model: string, limit: number): Promise<void> {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Atomic upsert + check using RETURNING
  const result = await pool.query(`
    INSERT INTO model_usage (user_id, model, date, count)
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (user_id, model, date)
    DO UPDATE SET count = model_usage.count + 1
    RETURNING count
  `, [userId, model, date]);

  const count = result.rows[0]?.count || 0;
  if (count > limit) {
    throw new Error(`Daily limit of ${limit} requests reached for model ${model}. Please try again tomorrow or use another model.`);
  }
}

export async function saveBlueprint(idea: string, blueprint: Blueprint, userId?: string, isPublic: boolean = false): Promise<string> {
  const id = generateId();
  await pool.query(
    'INSERT INTO blueprints (id, idea, blueprint, user_id, is_public) VALUES ($1, $2, $3, $4, $5)',
    [id, idea, JSON.stringify(blueprint), userId || null, isPublic]
  );
  return id;
}

export async function getBlueprint(
  id: string
): Promise<(SavedBlueprintRow & { parsedBlueprint: Blueprint }) | null> {
  const result = await pool.query(
    'SELECT id, idea, blueprint, created_at as "createdAt", views FROM blueprints WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) return null;
  const row = result.rows[0];

  await pool.query('UPDATE blueprints SET views = views + 1 WHERE id = $1', [id]);

  return {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    parsedBlueprint: JSON.parse(row.blueprint) as Blueprint,
  };
}

export async function getBlueprintMeta(id: string): Promise<SavedBlueprintMeta | null> {
  const result = await pool.query(
    'SELECT id, idea, created_at as "createdAt", views FROM blueprints WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
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
  const result = await pool.query(
    'UPDATE blueprints SET is_public = $1 WHERE id = $2 AND user_id = $3',
    [isPublic, blueprintId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

// ─── User management ──────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

export async function createUser(name: string, email: string, hashedPassword: string): Promise<string> {
  const id = generateId();
  await pool.query(
    'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
    [id, name, email, hashedPassword]
  );
  return id;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query(
    'SELECT id, name, email, password, created_at as "createdAt" FROM users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { ...row, createdAt: new Date(row.createdAt).toISOString() };
}

export async function getUserById(id: string): Promise<Omit<UserRow, 'password'> | null> {
  const result = await pool.query(
    'SELECT id, name, email, created_at as "createdAt" FROM users WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { ...row, createdAt: new Date(row.createdAt).toISOString() };
}

// ─── User blueprints ──────────────────────────────────────

export async function listUserBlueprints(userId: string, limit: number = 30): Promise<BlueprintListItem[]> {
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
  await pool.query(
    'INSERT INTO chat_messages (blueprint_id, user_id, role, content) VALUES ($1, $2, $3, $4)',
    [blueprintId, userId, role, content]
  );
}

export async function getChatMessages(blueprintId: string, userId: string): Promise<ChatMessageRow[]> {
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
  const result = await pool.query(
    'UPDATE blueprints SET idea = $1 WHERE id = $2 AND user_id = $3',
    [newTitle, id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteBlueprint(id: string, userId: string): Promise<boolean> {
  // Chat messages will be deleted automatically due to ON DELETE CASCADE
  const result = await pool.query(
    'DELETE FROM blueprints WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

