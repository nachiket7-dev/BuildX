import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../lib/auth';
import { getBlueprintOwnedByUser, getBlueprintFiles, saveChatMessage, getChatMessages } from '../lib/db';
import { runEngineeringAgent } from '../lib/agent/engine';
import { newRun, saveRun, readRun, acquireWorkspace, listRuns, requestCancellation } from '../lib/agent/store';
import { revision } from '../lib/agent/validation';
import { resolveModelKey } from '../lib/llm/router';

const router = Router();
router.use((req, res, next) => {
  if (process.env.AGENT_QUEUE_ENABLED === 'true' && req.method === 'POST' && /^\/[^/]+\/(chat|auto-heal)$/.test(req.path)) {
    res.status(409).json({ error: 'Durable execution is enabled. Reload the updated application to submit a queued job.' });
    return;
  }
  next();
});
const controllers = new Map<string, AbortController>();
router.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));
function write(res: Response, event: string, data: unknown, sequence?: number) {
  if (res.destroyed || res.writableEnded) return;
  res.write(`${sequence ? `id: ${sequence}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const chatHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { prompt, model, resumeRunId, requestId } = req.body;
  const controller = new AbortController();
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 16000) { res.status(400).json({ error: 'A prompt of 1–16000 characters is required' }); return; }
  let release: (() => Promise<void>) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    if (model && model !== 'pipeline') resolveModelKey(model);
    const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
    if (!blueprint) { res.status(404).json({ error: 'Workspace not found' }); return; }
    const previous = resumeRunId ? await readRun(resumeRunId) : null;
    if (resumeRunId && (!previous || previous.userId !== req.user!.userId || previous.blueprintId !== id || !previous.state || previous.status === 'completed')) {
      res.status(409).json({ error: 'No resumable checkpoint for this workspace' }); return;
    }
    if (requestId && !/^[a-f0-9-]{36}$/.test(requestId)) { res.status(400).json({ error: 'Invalid request ID' }); return; }
    if (requestId) {
      const existing = await readRun(requestId);
      if (existing) { res.status(409).json({ error: 'Request already started. Retrieve its saved run.', runId: existing.userId === req.user!.userId ? existing.id : undefined }); return; }
    }
    release = await acquireWorkspace(id, () => controller.abort(new Error('Workspace lock lost')));
    const files = await getBlueprintFiles(id);
    if (!files.length) { res.status(409).json({ error: 'Initialize the workspace before starting the agent' }); return; }
    const run = newRun(req.user!.userId, id, previous?.prompt || prompt);
    if (requestId) run.id = requestId;
    await saveRun(run);
    controllers.set(run.id, controller);
    const deadline = setTimeout(() => controller.abort(new Error('Run deadline exceeded')), 8 * 60_000);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.setTimeout(0);
    write(res, 'run_started', { runId: run.id });
    let polling = false;
    heartbeat = setInterval(async () => {
      if (polling || run.status !== 'running') return;
      polling = true;
      try {
        if ((await readRun(run.id))?.cancelRequested) controller.abort();
        await saveRun(run);
        write(res, 'pipeline_heartbeat', { runId: run.id, status: run.status });
      } catch { controller.abort(new Error('Run persistence unavailable')); }
      finally { polling = false; }
    }, 1000);
    // A browser disconnect detaches the transport. Explicit cancel stops the run.
    // Transport detachment does not stop durable heartbeat/cancellation polling.
    const emit = (event: string, data: unknown) => {
      const sequence = run.events.length + 1;
      run.events.push({ sequence, event, data });
      write(res, event, data, sequence);
    };
    try {
      await saveChatMessage(id, req.user!.userId, 'user', run.prompt);
      const history = await getChatMessages(id, req.user!.userId);
      const result = await runEngineeringAgent(run.prompt, files, {
        model, signal: controller.signal, history: history.slice(-6), schema: blueprint.parsedBlueprint,
        previewErrors: req.body.previewErrors, activeFilePath: req.body.activeFilePath,
        resume: previous?.state,
        checkpoint: async state => { run.state = state; await saveRun(run); },
      }, emit);
      controller.signal.throwIfAborted();
      const current = Object.fromEntries((await getBlueprintFiles(id)).map(f => [f.path, f.content]));
      if (revision(current) !== result.revision) throw new Error('Workspace changed during generation. Changes were not applied; start a fresh run.');
      run.result = result;
      run.status = 'completed';
      await saveRun(run);
      await saveChatMessage(id, req.user!.userId, 'assistant', result.message);
      for (const [path, diff] of Object.entries(result.stagedDiffs)) emit('staged_diff', { path, ...diff });
      emit('agent_complete', { ...result, success: true, modifiedFiles: result.modifiedFiles.map(f => f.path) });
      emit('done', { ...result, success: true });
    } catch (error: any) {
      run.status = controller.signal.aborted ? 'cancelled' : 'failed';
      run.error = controller.signal.aborted ? 'Run cancelled or timed out. Saved workspace was not modified.' : error.message;
      emit('error', { error: run.error, runId: run.id });
    } finally {
      clearTimeout(deadline);
      controllers.delete(run.id);
      await saveRun(run);
      if (!res.destroyed && !res.writableEnded) res.end();
    }
  } catch (error: any) {
    if (!res.headersSent) res.status(error.status || 400).json({ error: error.message });
    else { write(res, 'error', { error: error.message }); res.end(); }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await release?.();
  }
};

router.get('/:id/runs', requireAuth, async (req, res, next) => {
  try {
    if (!await getBlueprintOwnedByUser(req.params.id, req.user!.userId)) { res.status(404).json({ error: 'Workspace not found' }); return; }
    const runs = await listRuns(req.user!.userId, req.params.id);
    res.json({ runs: runs.map(run => ({ id: run.id, prompt: run.prompt, updatedAt: run.updatedAt,
      status: run.status === 'running' && Date.now() - Date.parse(run.updatedAt) > 30000 ? 'interrupted' : run.status,
      resumable: Boolean(run.state && run.status !== 'completed'), error: run.error })) });
  } catch (error) { next(error); }
});

router.get('/:id/runs/:runId', requireAuth, async (req, res, next) => {
  try {
    const run = await readRun(req.params.runId);
    if (!run || run.userId !== req.user!.userId || run.blueprintId !== req.params.id) { res.status(404).json({ error: 'Run not found' }); return; }
    const after = Number(req.query.after || 0);
    res.json({ id: run.id, status: run.status === 'running' && Date.now() - Date.parse(run.updatedAt) > 30000 ? 'interrupted' : run.status, result: run.result, error: run.error, events: run.events.filter(e => e.sequence > after), updatedAt: run.updatedAt });
  } catch (error) { next(error); }
});
router.post('/:id/runs/:runId/cancel', requireAuth, async (req, res, next) => {
  try {
    const run = await readRun(req.params.runId);
    if (!run || run.userId !== req.user!.userId || run.blueprintId !== req.params.id) { res.status(404).json({ error: 'Run not found' }); return; }
    const controller = controllers.get(run.id);
    if (run.status !== 'running') { res.status(409).json({ error: 'Run is not active' }); return; }
    await requestCancellation(run.id);
    controller?.abort(); res.json({ success: true });
  } catch (error) { next(error); }
});

router.post('/:id/chat', requireAuth, chatHandler);

/**
 * POST /:id/auto-heal — Autonomous Self-Healing Endpoint
 *
 * Accepts runtime error context from the Sandpack preview and dispatches
 * a targeted subagent fix using the same SSE pipeline as normal chat.
 */
router.post('/:id/auto-heal', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const {
    errorMessage,
    errorPath,
    errorLine,
    errorColumn,
    activeFileContent,
    model,
  } = req.body;

  if (!errorMessage || typeof errorMessage !== 'string') {
    res.status(400).json({ error: 'errorMessage is required' });
    return;
  }

  // Build a focused auto-heal prompt
  const targetFile = errorPath || 'the active component';
  const lineInfo = errorLine ? ` at line ${errorLine}` : '';
  const columnInfo = errorColumn ? `:${errorColumn}` : '';
  const healPrompt = `CRITICAL FIX NEEDED: Fix the runtime preview error in file "${targetFile}"${lineInfo}${columnInfo}.\n\nError message: ${errorMessage}\n\nInstructions:\n1. Identify the exact cause of this runtime error\n2. Fix ONLY the broken code — do not refactor or change unrelated logic\n3. Ensure the fix compiles and runs without errors\n4. Preserve all existing functionality`;

  // Delegate to the existing chat handler by rewriting the body and forwarding
  req.body = {
    prompt: healPrompt,
    model: model || 'pipeline',
    mode: 'auto-heal',
    activeFilePath: errorPath,
    activeFileContent,
    previewErrors: [{ message: errorMessage, path: errorPath, line: errorLine, column: errorColumn }],
  };

  await chatHandler(req, res);
});

export default router;
