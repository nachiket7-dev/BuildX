import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { isWorkspacePath, revision } from "./validation";

export type CheckKind = "typecheck" | "build" | "test";
export interface CheckResult {
  project?: string;
  kind: CheckKind;
  status: "passed" | "failed" | "unavailable";
  output: string;
  revision: string;
}

export async function runSandboxCheck(
  files: Record<string, string>,
  kind: CheckKind,
  project: string,
  signal: AbortSignal,
): Promise<CheckResult> {
  const hash = revision(files);
  const image = process.env.AGENT_SANDBOX_IMAGE;
  if (!image)
    return {
      kind,
      revision: hash,
      status: "unavailable",
      output:
        "AGENT_SANDBOX_IMAGE is not configured. No build/runtime verification was performed.",
    };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./:@-]+$/.test(image))
    throw new Error("Invalid sandbox image configuration");
  if (project !== "." && !isWorkspacePath(project))
    throw new Error("Invalid project directory");
  signal.throwIfAborted();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "buildx-run-"));
  const container = `buildx-${randomUUID()}`;
  try {
    for (const [name, content] of Object.entries(files)) {
      if (
        !isWorkspacePath(name) ||
        name.split("/").some((p) => p === "node_modules" || p === ".git") ||
        (/(^|\/)\.env($|\.)/.test(name) && !name.endsWith(".example"))
      )
        continue;
      const target = path.join(directory, name);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o777 });
      await fs.writeFile(target, content, { mode: 0o666 });
      await fs.chmod(target, 0o666);
      for (
        let parent = path.dirname(target);
        parent.startsWith(directory);
        parent = path.dirname(parent)
      ) {
        await fs.chmod(parent, 0o777);
        if (parent === directory) break;
      }
    }
    await fs.chmod(directory, 0o777);
    await fs.symlink("/opt/node_modules", path.join(directory, "node_modules"));
    const command =
      kind === "typecheck" ? ["tsc", "--noEmit"] : ["npm", "run", kind];
    const args = [
      "run",
      "--rm",
      "--pull=never",
      "--name",
      container,
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=128",
      "--memory=768m",
      "--cpus=1",
      "--user=1000:1000",
      "--tmpfs=/tmp:rw,nosuid,nodev,size=128m",
      "--tmpfs=/opt/node_modules/.vite-temp:rw,nosuid,nodev,size=32m,mode=1777",
      "--env=PATH=/opt/node_modules/.bin:/usr/local/bin:/usr/bin:/bin",
      "--env=NODE_PATH=/opt/node_modules",
      "--env=HOME=/tmp",
      "--env=CI=1",
      "--env=NEXT_TELEMETRY_DISABLED=1",
      "--env=UV_THREADPOOL_SIZE=2",
      "--mount",
      `type=bind,source=${directory},target=/workspace`,
      "--workdir",
      `/workspace${project === "." ? "" : "/" + project}`,
      image,
      ...command,
    ];
    return await new Promise<CheckResult>((resolve) => {
      let output = "";
      let stopped = false;
      const child = spawn("docker", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stop = () => {
        stopped = true;
        child.kill("SIGKILL");
        spawn("docker", ["rm", "-f", container], { stdio: "ignore" }).on(
          "error",
          () => {},
        );
      };
      const timer = setTimeout(stop, 90_000);
      signal.addEventListener("abort", stop, { once: true });
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", stop);
      };
      const capture = (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-24000);
      };
      child.stdout.on("data", capture);
      child.stderr.on("data", capture);
      child.on("error", (error) => {
        cleanup();
        resolve({
          kind,
          revision: hash,
          status: "unavailable",
          output: error.message,
        });
      });
      child.on("close", (code) => {
        cleanup();
        resolve({
          kind,
          revision: hash,
          status:
            code === 125 && !stopped
              ? "unavailable"
              : stopped || code !== 0
                ? "failed"
                : "passed",
          output: stopped
            ? "Execution cancelled or timed out.\n" + output
            : output,
        });
      });
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
