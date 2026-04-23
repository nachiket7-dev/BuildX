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
        views      INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id           SERIAL PRIMARY KEY,
        blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
        user_id      TEXT NOT NULL REFERENCES users(id),
        role         TEXT NOT NULL,
        content      TEXT NOT NULL,
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  } finally {
    client.release();
  }
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

export async function saveBlueprint(idea: string, blueprint: Blueprint, userId?: string): Promise<string> {
  const id = generateId();
  await pool.query(
    'INSERT INTO blueprints (id, idea, blueprint, user_id) VALUES ($1, $2, $3, $4)',
    [id, idea, JSON.stringify(blueprint), userId || null]
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
    'SELECT id, idea, blueprint, created_at as "createdAt", views FROM blueprints ORDER BY created_at DESC LIMIT $1',
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

// ─── Migration: claim unclaimed blueprints ────────────────

export async function claimUnownedBlueprints(userId: string): Promise<number> {
  const result = await pool.query(
    'UPDATE blueprints SET user_id = $1 WHERE user_id IS NULL',
    [userId]
  );
  return result.rowCount ?? 0;
}
