import { Router, Request, Response } from 'express';
import { requireAuth } from '../lib/auth';
import { getBlueprintOwnedByUser, getBlueprintFiles, saveChatMessage, getChatMessages } from '../lib/db';
import { runSubagentRefinementPipeline } from '../lib/orchestrator';
import type { PipelineStage } from '../lib/llm/types';
import type { PatchFile, PlannerOutput } from '../lib/types';

const router = Router();

// Set of workspace IDs currently running an active subagent pipeline
const activePipelines = new Set<string>();

// Helper: emit a single SSE event safely
function sseEvent(res: Response, event: string, data: object, isAborted?: boolean) {
  if (isAborted || res.writableEnded) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (err: any) {
    console.warn(`[Agent SSE] Write failed (${event}):`, err.message);
  }
}

const chatHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    prompt,
    model,
    activeFilePath,
    activeFileContent,
    previewErrors,
    consoleLogs,
  } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // Set SSE headers — must happen before any async work
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Disable socket-level idle timeouts for this long-lived SSE connection.
  // Without this, Node.js may close the socket during long LLM calls (60s+),
  // which fires req 'close' and falsely aborts the pipeline.
  if (req.socket) {
    req.socket.setTimeout(0);
    req.socket.setKeepAlive(true, 30000);
  }
  if (res.setTimeout) {
    res.setTimeout(0);
  }

  // Guard against concurrent executions for the same workspace ID
  if (activePipelines.has(id)) {
    console.warn(`[Agent] Pipeline execution already in progress for workspace ${id}. Rejecting concurrent request.`);
    sseEvent(res, 'error', { error: 'A pipeline execution is already in progress for this workspace. Please wait for it to finish.' });
    if (!res.writableEnded) res.end();
    return;
  }

  activePipelines.add(id);
  let isAborted = false;
  const pipelineStartTime = Date.now();
  let currentStage: PipelineStage = 'INGESTION';
  let currentModelName = 'GLM 5.2';

  // ── Continuous 2-second SSE keepalive & progress heartbeat ────────────────
  const heartbeatInterval = setInterval(() => {
    if (isAborted || res.writableEnded) {
      clearInterval(heartbeatInterval);
      return;
    }
    try {
      res.write(': keepalive-ping\n\n');
      sseEvent(res, 'pipeline_heartbeat', {
        elapsedMs: Date.now() - pipelineStartTime,
        activeStage: currentStage,
        activeModel: currentModelName,
      }, isAborted);
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 2000);

  // DIAGNOSTIC: Track socket-level events to find the true abort source
  let closeReason = 'unknown';
  if (req.socket) {
    req.socket.on('timeout', () => {
      closeReason = 'socket-timeout';
      console.warn(`[Agent:DIAG] Socket TIMEOUT fired for workspace ${id} after ${((Date.now() - pipelineStartTime) / 1000).toFixed(1)}s`);
    });
    req.socket.on('error', (err: any) => {
      closeReason = `socket-error: ${err.code || err.message}`;
      console.warn(`[Agent:DIAG] Socket ERROR for workspace ${id}: ${err.code || err.message}`);
    });
  }

  req.on('close', () => {
    clearInterval(heartbeatInterval);

    const elapsed = ((Date.now() - pipelineStartTime) / 1000).toFixed(1);
    const diagnostics = {
      elapsed: `${elapsed}s`,
      resWritableFinished: res.writableFinished,
      resWritableEnded: res.writableEnded,
      reqDestroyed: req.destroyed,
      reqComplete: req.complete,
      socketDestroyed: req.socket?.destroyed,
      socketReadableEnded: req.socket?.readableEnded,
      closeReason,
      currentStage,
    };

    if (res.writableFinished) {
      // Normal completion — we called res.end() ourselves. NOT a client abort.
      activePipelines.delete(id);
      console.log(`[Agent] Normal close for workspace ${id} after ${elapsed}s`);
      return;
    }

    // Something closed the connection while pipeline was still running
    isAborted = true;
    activePipelines.delete(id);
    console.warn(`[Agent] Connection closed mid-pipeline for workspace ${id}`, JSON.stringify(diagnostics, null, 2));
  });

  const think = (step: string, stage?: PipelineStage) => {
    if (isAborted) return;
    if (stage) currentStage = stage;
    console.log(`[Agent:think${stage ? `:${stage}` : ''}] ${step}`);
    sseEvent(res, 'thinking', { step, stage }, isAborted);
  };

  const notifyPipelineStage = (stage: PipelineStage, state: 'start' | 'completed' | 'fallback', detail?: string) => {
    if (isAborted) return;
    currentStage = stage;
    sseEvent(res, 'pipeline_stage', { stage, state, detail }, isAborted);
  };

  try {
    // Initial connection comment
    res.write(': connection-active\n\n');
    // ─── STAGE 1: INGESTION ──────────────────────────────────────────────────
    notifyPipelineStage('INGESTION', 'start', 'Parsing workspace VFS and runtime context');
    think('🔍 Verifying workspace access and loading blueprint metadata…', 'INGESTION');
    const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
    if (!blueprint) {
      console.error(`[Agent] Workspace ${id} not found for user ${req.user!.userId}`);
      sseEvent(res, 'error', { error: 'Workspace not found or access denied' });
      res.end();
      return;
    }

    think('📋 Loading application blueprint & database schema specifications…', 'INGESTION');
    think('📁 Reading current Virtual File System (VFS)…', 'INGESTION');
    const files = await getBlueprintFiles(id);
    console.log(`[Agent] VFS contains ${files.length} file(s)`);

    think('💬 Loading conversation history for context…', 'INGESTION');
    const history = await getChatMessages(id, req.user!.userId);

    await saveChatMessage(id, req.user!.userId, 'user', prompt);

    // Build clean file context
    const cleanFiles = files
      .filter(f => f.path !== 'preview.html')
      .map(f => ({
        path: f.path,
        content: f.content,
      }));

    notifyPipelineStage('INGESTION', 'completed', `VFS ingested (${cleanFiles.length} files) with runtime telemetry`);

    // ─── STAGES 2, 3, 4: SUBAGENT REFINEMENT PIPELINE (Planner -> Patch Gen -> Verifier) ─
    const bp = blueprint.parsedBlueprint;
    const schemaContext = {
      schema: bp.schema || [],
      endpoints: bp.endpoints || [],
      screens: bp.screens || [],
    };

    const pipelineResult = await runSubagentRefinementPipeline(
      prompt,
      cleanFiles,
      {
        appName: bp.appName || (bp as any).title || 'BuildX App',
        schema: schemaContext,
        activeFilePath,
        activeFileContent,
        previewErrors,
        consoleLogs,
        requestedModel: typeof model === 'string' ? model : undefined,
        history: history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })),
      },
      {
        think,
        pipelineStage: notifyPipelineStage,
        agentPlan: (planData: PlannerOutput & { modelUsed?: string; executionTimeMs?: number; wasFallback?: boolean }) => {
          sseEvent(res, 'agent_plan', planData, isAborted);
        },
        filePatch: (patch: PatchFile & { modelUsed?: string; executionTimeMs?: number; wasFallback?: boolean }) => {
          sseEvent(res, 'file_patch', patch, isAborted);
        },
        agentPatch: (patch: PatchFile & { modelUsed?: string; executionTimeMs?: number; wasFallback?: boolean }) => {
          sseEvent(res, 'agent_patch', patch, isAborted);
        },
        stagedDiff: (diff: { path: string; original: string; modified: string }) => {
          sseEvent(res, 'staged_diff', diff, isAborted);
        },
        agentTelemetry: (telemetry: { stage: string; modelName?: string; modelUsed: string; executionTimeMs: number; wasFallback: boolean }) => {
          sseEvent(res, 'agent_telemetry', telemetry, isAborted);
        },
      }
    );

    // Keep generated files staged until the user explicitly accepts them in the UI.
    const modifiedPaths = pipelineResult.modifiedFiles.map((file) => file.path);

    const planSummary = pipelineResult.plan.length > 0
      ? pipelineResult.plan.map((p) => `- [x] ${p}`).join('\n')
      : '- [x] Completed requested modifications';

    await saveChatMessage(id, req.user!.userId, 'assistant', pipelineResult.message);
    console.log(`[Agent] Subagent pipeline complete. Staged ${modifiedPaths.length} files: ${modifiedPaths.join(', ')}`);

    // Emit agent_complete event with telemetry
    sseEvent(res, 'agent_complete', {
      success: true,
      modifiedFiles: modifiedPaths,
      message: pipelineResult.message,
      plan: planSummary,
      stagedDiffs: pipelineResult.stagedDiffs,
      telemetry: pipelineResult.telemetry,
    }, isAborted);

    // Emit done event for backwards-compatible listeners
    sseEvent(res, 'done', {
      success: true,
      message: pipelineResult.message,
      plan: planSummary,
      modifiedFiles: modifiedPaths,
      stagedDiffs: pipelineResult.stagedDiffs,
      telemetry: pipelineResult.telemetry,
    }, isAborted);

    if (!isAborted && !res.writableEnded) {
      res.end();
    }
  } catch (err: any) {
    console.error('[Agent] Pipeline error:', err.message, err.stack);
    try {
      await saveChatMessage(id, req.user!.userId, 'assistant', '⚠️ Agent pipeline failed unexpectedly.');
    } catch {}
    sseEvent(res, 'error', { error: 'Agent pipeline failed unexpectedly. Please try again.' }, isAborted);
    if (!isAborted && !res.writableEnded) {
      res.end();
    }
  } finally {
    clearInterval(heartbeatInterval);
    activePipelines.delete(id);
  }
};

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
    model: model || 'gemini-3.5-flash',
    mode: 'auto-heal',
    activeFilePath: errorPath,
    activeFileContent,
    previewErrors: [{ message: errorMessage, path: errorPath, line: errorLine, column: errorColumn }],
  };

  await chatHandler(req, res);
});

export default router;
