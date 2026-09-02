import { Pool } from 'pg';

export interface CooldownStore {
  getExpiry(modelKey: string): Promise<number | undefined>;
  setExpiry(modelKey: string, expiryMs: number): Promise<void>;
  clear(): Promise<void>;
}

/** Fast single-process store used in local development and unit tests. */
export class InMemoryCooldownStore implements CooldownStore {
  private readonly entries = new Map<string, number>();

  async getExpiry(modelKey: string): Promise<number | undefined> {
    const expiry = this.entries.get(modelKey);
    if (expiry === undefined) return undefined;
    if (Date.now() >= expiry) {
      this.entries.delete(modelKey);
      return undefined;
    }
    return expiry;
  }

  async setExpiry(modelKey: string, expiryMs: number): Promise<void> {
    this.entries.set(modelKey, expiryMs);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}

/**
 * Shared cooldown store for horizontally scaled deployments.
 * It uses the application's existing PostgreSQL dependency and creates only
 * one small table. The router opts into it with LLM_SHARED_COOLDOWNS=true.
 */
export class PostgresCooldownStore implements CooldownStore {
  private readonly pool: Pool;
  private schemaPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 2,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? false
        : { rejectUnauthorized: false },
    });
    this.pool.on('error', (err) => {
      console.warn('[LLM Circuit Breaker] Shared cooldown database error:', err.message);
    });
  }

  private ensureSchema(): Promise<void> {
    if (!this.schemaPromise) {
      this.schemaPromise = this.pool.query(`
        CREATE TABLE IF NOT EXISTS llm_model_cooldowns (
          model_key TEXT PRIMARY KEY,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `).then(() => undefined);
    }
    return this.schemaPromise;
  }

  async getExpiry(modelKey: string): Promise<number | undefined> {
    await this.ensureSchema();
    const result = await this.pool.query(
      'SELECT expires_at FROM llm_model_cooldowns WHERE model_key = $1',
      [modelKey]
    );
    const expiry = result.rows[0]?.expires_at;
    if (!expiry) return undefined;

    const expiryMs = new Date(expiry).getTime();
    if (!Number.isFinite(expiryMs) || Date.now() >= expiryMs) {
      await this.pool.query('DELETE FROM llm_model_cooldowns WHERE model_key = $1', [modelKey]);
      return undefined;
    }
    return expiryMs;
  }

  async setExpiry(modelKey: string, expiryMs: number): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO llm_model_cooldowns (model_key, expires_at)
       VALUES ($1, to_timestamp($2 / 1000.0))
       ON CONFLICT (model_key) DO UPDATE
       SET expires_at = GREATEST(llm_model_cooldowns.expires_at, EXCLUDED.expires_at)`,
      [modelKey, expiryMs]
    );
  }

  async clear(): Promise<void> {
    await this.ensureSchema();
    await this.pool.query('DELETE FROM llm_model_cooldowns');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** Keeps failover functional if the optional shared store is temporarily down. */
export class ResilientCooldownStore implements CooldownStore {
  private readonly fallback = new InMemoryCooldownStore();
  private warned = false;

  constructor(private readonly primary: CooldownStore) {}

  private reportFailure(err: unknown): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      '[LLM Circuit Breaker] Shared cooldown storage unavailable; using process-local cooldowns.',
      err instanceof Error ? err.message : String(err)
    );
  }

  async getExpiry(modelKey: string): Promise<number | undefined> {
    try {
      return await this.primary.getExpiry(modelKey);
    } catch (err) {
      this.reportFailure(err);
      return this.fallback.getExpiry(modelKey);
    }
  }

  async setExpiry(modelKey: string, expiryMs: number): Promise<void> {
    await this.fallback.setExpiry(modelKey, expiryMs);
    try {
      await this.primary.setExpiry(modelKey, expiryMs);
    } catch (err) {
      this.reportFailure(err);
    }
  }

  async clear(): Promise<void> {
    await this.fallback.clear();
    try {
      await this.primary.clear();
    } catch (err) {
      this.reportFailure(err);
    }
  }
}

export function createDefaultCooldownStore(): CooldownStore {
  const connectionString = process.env.DATABASE_URL;
  if (process.env.LLM_SHARED_COOLDOWNS === 'true' && connectionString) {
    console.log('[LLM Circuit Breaker] Using shared PostgreSQL cooldown storage.');
    return new ResilientCooldownStore(new PostgresCooldownStore(connectionString));
  }

  return new InMemoryCooldownStore();
}
