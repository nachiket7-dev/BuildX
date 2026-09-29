import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID, createHash } from "crypto";
import { Client } from "pg";
import { getAgentPool } from "../db";
import type { AgentState } from "./engine";

const directory = () =>
  process.env.AGENT_RUN_DIRECTORY ||
  path.resolve(__dirname, "../../../data/agent-runs");
export interface AgentRun {
  id: string;
  userId: string;
  blueprintId: string;
  prompt: string;
  status: "running" | "completed" | "failed" | "cancelled";
  cancelRequested?: boolean;
  updatedAt: string;
  state?: AgentState;
  result?: unknown;
  error?: string;
  events: Array<{ sequence: number; event: string; data: unknown }>;
}
export function newRun(
  userId: string,
  blueprintId: string,
  prompt: string,
): AgentRun {
  return {
    id: randomUUID(),
    userId,
    blueprintId,
    prompt,
    status: "running",
    updatedAt: new Date().toISOString(),
    events: [],
  };
}
let tableReady: Promise<void> | undefined;
async function database() {
  const pool = await getAgentPool();
  if (pool) {
    tableReady ||= pool
      .query(
        `CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, blueprint_id TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), payload JSONB NOT NULL,
      cancel_requested BOOLEAN NOT NULL DEFAULT false
    ); CREATE INDEX IF NOT EXISTS agent_runs_owner ON agent_runs(user_id, blueprint_id, updated_at DESC);`,
      )
      .then(() => {})
      .catch((error) => {
        tableReady = undefined;
        throw error;
      });
    await tableReady;
  }
  return pool;
}
export async function saveRun(run: AgentRun): Promise<void> {
  run.updatedAt = new Date().toISOString();
  const pool = await database();
  if (pool) {
    await pool.query(
      `INSERT INTO agent_runs(id,user_id,blueprint_id,payload) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()
      WHERE agent_runs.user_id=EXCLUDED.user_id AND agent_runs.blueprint_id=EXCLUDED.blueprint_id`,
      [run.id, run.userId, run.blueprintId, JSON.stringify(run)],
    );
    return;
  }
  await fs.mkdir(directory(), { recursive: true, mode: 0o700 });
  const file = path.join(directory(), run.id + ".json");
  const temporary = file + "." + randomUUID() + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(run), { mode: 0o600 });
  await fs.rename(temporary, file);
}
export async function readRun(id: string): Promise<AgentRun | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const pool = await database();
  if (pool) {
    const result = await pool.query(
      "SELECT payload,cancel_requested FROM agent_runs WHERE id=$1",
      [id],
    );
    const row = result.rows[0];
    return row
      ? { ...row.payload, cancelRequested: row.cancel_requested }
      : null;
  }
  try {
    const run = JSON.parse(
      await fs.readFile(path.join(directory(), id + ".json"), "utf8"),
    );
    run.cancelRequested = await fs
      .access(path.join(directory(), id + ".cancel"))
      .then(
        () => true,
        () => false,
      );
    return run;
  } catch (error: any) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
export async function requestCancellation(id: string): Promise<void> {
  const pool = await database();
  if (pool) {
    await pool.query(
      "UPDATE agent_runs SET cancel_requested=true WHERE id=$1",
      [id],
    );
    return;
  }
  await fs.writeFile(path.join(directory(), id + ".cancel"), "", {
    mode: 0o600,
  });
}
export async function listRuns(
  userId: string,
  blueprintId: string,
): Promise<AgentRun[]> {
  const pool = await database();
  if (pool)
    return (
      await pool.query(
        "SELECT payload FROM agent_runs WHERE user_id=$1 AND blueprint_id=$2 ORDER BY updated_at DESC LIMIT 20",
        [userId, blueprintId],
      )
    ).rows.map((row) => row.payload);
  const names = await fs.readdir(directory()).catch(() => [] as string[]);
  const runs = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map((name) => readRun(name.slice(0, -5))),
  );
  return runs
    .filter((run): run is AgentRun =>
      Boolean(run && run.userId === userId && run.blueprintId === blueprintId),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20);
}

/** Same-volume process lock. Multi-host deployments must use a shared job service. */
export async function acquireWorkspace(
  blueprintId: string,
  onLost?: () => void,
): Promise<() => Promise<void>> {
  const pool = await database();
  if (pool) {
    // Dedicated lease connection avoids starving the query pool during long runs.
    const client = new Client(pool.options);
    await client.connect();
    try {
      const result = await client.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired",
        [blueprintId],
      );
      if (!result.rows[0].acquired)
        throw Object.assign(new Error("A workspace run is active"), {
          status: 409,
        });
    } catch (error) {
      await client.end();
      throw error;
    }
    const lost = () => onLost?.();
    client.on("error", lost);
    return async () => {
      client.removeListener("error", lost);
      try {
        await client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1,0))",
          [blueprintId],
        );
      } finally {
        await client.end();
      }
    };
  }
  await fs.mkdir(directory(), { recursive: true, mode: 0o700 });
  const lock = path.join(
    directory(),
    createHash("sha256").update(blueprintId).digest("hex") + ".lock",
  );
  const busy = () =>
    Object.assign(
      new Error(
        "A workspace run is active or requires recovery after interruption.",
      ),
      { status: 409 },
    );
  let handle;
  try {
    handle = await fs.open(lock, "wx", 0o600);
  } catch (error: any) {
    if (error.code !== "EEXIST") throw error;
    // Serialize recovery; reclaim only a confirmed dead process on this host.
    let recovery;
    try {
      recovery = await fs.open(lock + ".recovery", "wx", 0o600);
    } catch (error: any) {
      if (error.code === "EEXIST") throw busy();
      throw error;
    }
    try {
      let owner;
      try {
        owner = JSON.parse(await fs.readFile(lock, "utf8"));
      } catch {
        throw busy();
      }
      if (
        owner.hostname !== os.hostname() ||
        !Number.isSafeInteger(owner.pid) ||
        owner.pid <= 0
      )
        throw busy();
      try {
        process.kill(owner.pid, 0);
        throw busy();
      } catch (error: any) {
        if (error.code !== "ESRCH") throw busy();
      }
      await fs.unlink(lock);
      try {
        handle = await fs.open(lock, "wx", 0o600);
      } catch (error: any) {
        if (error.code === "EEXIST") throw busy();
        throw error;
      }
    } finally {
      await recovery.close();
      await fs.unlink(lock + ".recovery");
    }
  }
  await handle.writeFile(
    JSON.stringify({
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: new Date().toISOString(),
    }),
  );
  return async () => {
    await handle.close();
    await fs.unlink(lock);
  };
}
