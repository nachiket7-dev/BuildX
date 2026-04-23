import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import type { Blueprint } from './types';

// ─── Database path ─────────────────────────────────────────

const DATA_DIR = path.resolve(
  process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'buildx.db');

// ─── Init ──────────────────────────────────────────────────

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blueprints (
    id         TEXT PRIMARY KEY,
    idea       TEXT NOT NULL,
    blueprint  TEXT NOT NULL,
    user_id    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    views      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    blueprint_id TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    role         TEXT NOT NULL,
    content      TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (blueprint_id) REFERENCES blueprints(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Add user_id column if it doesn't exist (migration for existing DBs)
try {
  db.exec('ALTER TABLE blueprints ADD COLUMN user_id TEXT');
} catch {
  // Column already exists — fine
}

// ─── Helpers ───────────────────────────────────────────────

/** Generate a short, URL-safe ID (8 characters) */
function generateId(): string {
  return crypto.randomBytes(6).toString('base64url'); // 8 chars
}

// ─── Prepared statements ───────────────────────────────────

const insertStmt = db.prepare(`
  INSERT INTO blueprints (id, idea, blueprint, user_id) VALUES (?, ?, ?, ?)
`);

const selectStmt = db.prepare(`
  SELECT id, idea, blueprint, created_at as createdAt, views
  FROM blueprints WHERE id = ?
`);

const selectMetaStmt = db.prepare(`
  SELECT id, idea, created_at as createdAt, views
  FROM blueprints WHERE id = ?
`);

const incrementViewsStmt = db.prepare(`
  UPDATE blueprints SET views = views + 1 WHERE id = ?
`);

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

/**
 * Save a blueprint and return its generated ID.
 */
export function saveBlueprint(idea: string, blueprint: Blueprint, userId?: string): string {
  const id = generateId();
  insertStmt.run(id, idea, JSON.stringify(blueprint), userId || null);
  return id;
}

/**
 * Retrieve a saved blueprint by ID. Returns null if not found.
 * Automatically increments the view counter.
 */
export function getBlueprint(
  id: string
): (SavedBlueprintRow & { parsedBlueprint: Blueprint }) | null {
  const row = selectStmt.get(id) as SavedBlueprintRow | undefined;
  if (!row) return null;

  incrementViewsStmt.run(id);

  return {
    ...row,
    parsedBlueprint: JSON.parse(row.blueprint) as Blueprint,
  };
}

/**
 * Get just the metadata (no full blueprint JSON) for link previews.
 */
export function getBlueprintMeta(id: string): SavedBlueprintMeta | null {
  const row = selectMetaStmt.get(id) as SavedBlueprintMeta | undefined;
  return row ?? null;
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

const listStmt = db.prepare(`
  SELECT id, idea, blueprint, created_at as createdAt, views
  FROM blueprints
  ORDER BY created_at DESC
  LIMIT ?
`);

/**
 * List recent blueprints (for the gallery page).
 */
export function listBlueprints(limit: number = 20): BlueprintListItem[] {
  const rows = listStmt.all(limit) as SavedBlueprintRow[];
  return rows.map((row) => {
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
      createdAt: row.createdAt,
      views: row.views,
    };
  });
}

/** Gracefully close the database connection (for clean shutdown) */
export function closeDb(): void {
  db.close();
}

// ─── User management ──────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)
`);

const selectUserByEmailStmt = db.prepare(`
  SELECT id, name, email, password, created_at as createdAt FROM users WHERE email = ?
`);

const selectUserByIdStmt = db.prepare(`
  SELECT id, name, email, created_at as createdAt FROM users WHERE id = ?
`);

export function createUser(name: string, email: string, hashedPassword: string): string {
  const id = generateId();
  insertUserStmt.run(id, name, email, hashedPassword);
  return id;
}

export function getUserByEmail(email: string): UserRow | null {
  const row = selectUserByEmailStmt.get(email) as UserRow | undefined;
  return row ?? null;
}

export function getUserById(id: string): Omit<UserRow, 'password'> | null {
  const row = selectUserByIdStmt.get(id) as Omit<UserRow, 'password'> | undefined;
  return row ?? null;
}

// ─── User blueprints ──────────────────────────────────────

const listUserBlueprintsStmt = db.prepare(`
  SELECT id, idea, blueprint, created_at as createdAt, views
  FROM blueprints
  WHERE user_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

export function listUserBlueprints(userId: string, limit: number = 30): BlueprintListItem[] {
  const rows = listUserBlueprintsStmt.all(userId, limit) as SavedBlueprintRow[];
  return rows.map((row) => {
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
    return { id: row.id, idea: row.idea, appName, description, complexity, createdAt: row.createdAt, views: row.views };
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

const insertChatStmt = db.prepare(`
  INSERT INTO chat_messages (blueprint_id, user_id, role, content) VALUES (?, ?, ?, ?)
`);

const selectChatsStmt = db.prepare(`
  SELECT id, blueprint_id as blueprintId, user_id as userId, role, content, created_at as createdAt
  FROM chat_messages
  WHERE blueprint_id = ? AND user_id = ?
  ORDER BY created_at ASC
`);

export function saveChatMessage(blueprintId: string, userId: string, role: string, content: string): void {
  insertChatStmt.run(blueprintId, userId, role, content);
}

export function getChatMessages(blueprintId: string, userId: string): ChatMessageRow[] {
  return selectChatsStmt.all(blueprintId, userId) as ChatMessageRow[];
}

// ─── Blueprint management ─────────────────────────────────

const renameBlueprintStmt = db.prepare(`
  UPDATE blueprints SET idea = ? WHERE id = ? AND user_id = ?
`);

const deleteBlueprintStmt = db.prepare(`
  DELETE FROM blueprints WHERE id = ? AND user_id = ?
`);

const deleteChatsByBlueprintStmt = db.prepare(`
  DELETE FROM chat_messages WHERE blueprint_id = ?
`);

export function renameBlueprint(id: string, userId: string, newTitle: string): boolean {
  const result = renameBlueprintStmt.run(newTitle, id, userId);
  return result.changes > 0;
}

export function deleteBlueprint(id: string, userId: string): boolean {
  deleteChatsByBlueprintStmt.run(id);
  const result = deleteBlueprintStmt.run(id, userId);
  return result.changes > 0;
}

// ─── Migration: claim unclaimed blueprints ────────────────

const claimStmt = db.prepare(`
  UPDATE blueprints SET user_id = ? WHERE user_id IS NULL
`);

/**
 * Assign all blueprints with no owner to the given user.
 * Called on login/signup so pre-auth blueprints appear in the sidebar.
 */
export function claimUnownedBlueprints(userId: string): number {
  const result = claimStmt.run(userId);
  return result.changes;
}
