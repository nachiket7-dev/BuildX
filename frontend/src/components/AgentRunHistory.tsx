import { useCallback, useEffect, useRef, useState } from "react";
import { useVFS } from "../context/VFSContext";
import { useAuth } from "../hooks/useAuth";
import { jobClient, queuedJobsEnabled } from "../lib/jobClient";
import { getAuthHeaders } from "../lib/api";

interface Run {
  id: string;
  requestKey?: string;
  prompt: string;
  status: string;
  updatedAt: string;
  nextAttemptAt?: string | null;
  resumable: boolean;
  error?: string;
}
const base = import.meta.env.VITE_API_URL ?? "";
export function AgentRunHistory({
  blueprintId,
  onResume,
}: {
  blueprintId: string;
  onResume: (runId: string, prompt: string) => void;
}) {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const pending = useRef(new Set<string>());
  const restored = useRef(new Set<string>());
  const { stageDiff, isAgentExecuting, stagedDiffs, files } = useVFS();
  const latest = useRef({ blueprintId, isAgentExecuting, stagedDiffs, files });
  latest.current = { blueprintId, isAgentExecuting, stagedDiffs, files };
  const restore = useCallback(
    async (runId: string) => {
      try {
        const [runResponse, filesResponse] = await Promise.all([
          fetch(`${base}/api/agent/${blueprintId}/${runId.startsWith('job:') ? 'jobs/' + runId.slice(4) : 'runs/' + runId}`, {
            headers: getAuthHeaders(),
          }),
          fetch(`${base}/api/blueprints/${blueprintId}/vfs`, {
            headers: getAuthHeaders(),
          }),
        ]);
        if (!runResponse.ok || !filesResponse.ok)
          throw new Error("Unable to retrieve saved changes");
        const run = await runResponse.json();
        // Reload may interrupt the submission before its response stores jobId.
        // The owned server result can acknowledge the original request key.
        if (runId.startsWith('job:') && user && run.status === 'completed')
          jobClient(user.id).acknowledge(`workspace:${blueprintId}`,runId.slice(4),run.requestKey);
        const current = (await filesResponse.json()).data.fileTree;
        const diffs = Object.entries(run.result?.stagedDiffs || {}) as Array<
          [string, { original: string; modified: string }]
        >;
        const state = latest.current;
        if (state.blueprintId !== blueprintId) return;
        if (state.isAgentExecuting || Object.keys(state.stagedDiffs).length)
          throw new Error("Review or discard the current changes before restoring another run.");
        if (diffs.some(([path, diff]) => (state.files[path] ?? "") !== diff.original))
          throw new Error("Local edits differ from this run. Save or discard them before recovery.");
        if (
          diffs.some(([path, diff]) => (current[path] ?? "") !== diff.original)
        )
          throw new Error(
            "Workspace changed since this run. Start a fresh request instead of restoring stale changes.",
          );
        for (const [path, diff] of diffs)
          stageDiff(path, {
            filePath: path,
            incomingCode: diff.modified,
            originalCode: diff.original,
          });
        restored.current.add(runId);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Recovery failed");
      }
    },
    [blueprintId, stageDiff, user],
  );
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`${base}/api/agent/${blueprintId}/runs`, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Run history is unavailable");
        const data = await response.json();
        if (!Array.isArray(data.runs)) throw new Error("Run history returned an invalid response");
        if (queuedJobsEnabled) {
          const queued = await fetch(`${base}/api/agent/${blueprintId}/jobs`, {headers:getAuthHeaders(),signal:controller.signal});
          if (!queued.ok) throw new Error('Queued run history is unavailable');
          const queuedData = await queued.json();
          if (!Array.isArray(queuedData.runs)) throw new Error('Queued run history returned an invalid response');
          data.runs = [...queuedData.runs.map((run: Run) => ({...run,id:`job:${run.id}`,resumable:run.status==='queued'||run.status==='running'})), ...data.runs];
        }
        if (controller.signal.aborted) return;
        setRuns(data.runs);
        for (const run of data.runs as Run[]) {
          if (user && run.id.startsWith('job:') && (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired')) {
            jobClient(user.id).acknowledge(`workspace:${blueprintId}`,run.id.slice(4),run.requestKey);
          }
          if (run.status === "running" || run.status === "queued") pending.current.add(run.id);
          if (
            !isAgentExecuting &&
            run.status === "completed" &&
            pending.current.has(run.id) &&
            !restored.current.has(run.id)
          ) {
            restored.current.add(run.id);
            await restore(run.id);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Unable to load runs");
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [blueprintId, isAgentExecuting, restore, user]);
  if (!runs.length && !error) return null;
  return (
    <details className="agent-run-details">
      <summary>Run history · {runs.length}</summary>
      {error && <p role="alert">{error}</p>}
      {runs.map((run) => (
        <article
          className="agent-message agent-message--assistant"
          key={run.id}
        >
          <div className="agent-message-author">
            {run.status === 'queued' && run.nextAttemptAt ? 'Waiting for AI capacity' : run.status} · {new Date(run.updatedAt).toLocaleString()}
          </div>
          {run.status === 'queued' && run.nextAttemptAt && <p>Retry scheduled for {new Date(run.nextAttemptAt).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}. You can leave this page and reconnect later.</p>}
          <p className="agent-message-content">{run.prompt.slice(0, 160)}</p>
          {run.error && !(run.status === 'queued' && run.nextAttemptAt) && <p>{run.error}</p>}
          {run.id.startsWith('job:') && (run.status === 'queued' || run.status === 'running') && (
            <button type="button" onClick={() => {
              void fetch(`${base}/api/agent/${blueprintId}/jobs/${run.id.slice(4)}/cancel`, {method:'POST',headers:getAuthHeaders(),body:'{}'})
                .then(async response => {
                  if (!response.ok) throw new Error('Could not stop the job. Try again.');
                  const data = await response.json();
                  if (!data.cancelled) throw new Error('Job already finished. Refresh history to retrieve its result.');
                  if (user) {
                    jobClient(user.id).acknowledge(`workspace:${blueprintId}`,run.id.slice(4),run.requestKey);
                  }
                  setRuns(previous=>previous.map(item=>item.id===run.id?{...item,status:'cancelled',resumable:false}:item));
                  setError('');
                }).catch(err=>setError(err.message));
            }}>Stop job</button>
          )}
          {run.status === "completed" && (
            <button
              type="button"
              disabled={isAgentExecuting || Object.keys(stagedDiffs).length > 0}
              onClick={() => void restore(run.id)}
            >
              Review saved changes
            </button>
          )}
          {run.resumable && (run.id.startsWith("job:") || run.status !== "running") && (
            <button
              type="button"
              disabled={isAgentExecuting || Object.keys(stagedDiffs).length > 0}
              onClick={() => onResume(run.id, run.prompt)}
            >
              {run.id.startsWith("job:") ? "Reconnect to job" : "Resume checkpoint"}
            </button>
          )}
        </article>
      ))}
    </details>
  );
}
