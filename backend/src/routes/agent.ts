import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../lib/auth';
import { getBlueprintForUser, getBlueprintMeta, getBlueprintFiles, saveBlueprintFile, saveChatMessage, getChatMessages } from '../lib/db';
import { completeWithPipelineFallback, getPipelineMaxTokens } from '../lib/llm/router';
import { extractJSON } from '../lib/jsonExtract';
import { parseDiffBlocks, applySearchReplace } from '../lib/codegen/diffParser';
import { DIFF_PATCH_SYSTEM_PROMPT, buildDiffPatchPrompt, buildAutoFixPrompt } from '../lib/codegen/prompts';
import type { PipelineStage } from '../lib/llm/types';

const router = Router();

// Standard full-file generation fallback prompt schema
const AGENT_SYSTEM_PROMPT = `You are BuildX Code Agent — an elite autonomous coding agent.
Your workspace contains a Virtual File System (VFS) of a full-stack React and Express application.
Your goal is to follow user commands, modify codebase files dynamically, and explain your changes.

You MUST respond with a single valid JSON object of EXACTLY this schema — nothing else:
{
  "plan": "- [x] Step 1\\n- [ ] Step 2",
  "message": "Markdown explanation of what was changed and why.",
  "files": [
    {
      "path": "frontend/src/pages/Dashboard.tsx",
      "content": "<complete source code or diff blocks>",
      "action": "create"
    }
  ]
}

CRITICAL RULES:
1. Return ONLY the JSON object. No markdown fences, no preamble, no trailing text.
2. "files" MUST contain every file you create or modify. Never omit files.
3. Every "content" field MUST be the COMPLETE source code for new files OR Search/Replace diff blocks for edits.
4. Frontend files: React 18, Tailwind CSS, Lucide React icons.
5. Backend files: Express + TypeScript.
6. Write functional logic that integrates with existing VFS files.
7. MINIMIZE RESPONSE SIZE: Only include files in "files" that strictly need modifications. Keep the "plan" and "message" text extremely brief (1-2 sentences).`;

// Helper: emit a single SSE event
function sseEvent(res: Response, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/:id/chat', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { prompt, model, mode } = req.body;

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

  const think = (step: string, stage?: PipelineStage) => {
    console.log(`[Agent:think${stage ? `:${stage}` : ''}] ${step}`);
    sseEvent(res, 'thinking', { step, stage });
  };

  const notifyPipelineStage = (stage: PipelineStage, state: 'start' | 'completed' | 'fallback', detail?: string) => {
    sseEvent(res, 'pipeline_stage', { stage, state, detail });
  };

  try {
    // ─── STAGE 1: INGESTION ──────────────────────────────────────────────────
    notifyPipelineStage('INGESTION', 'start', 'Parsing workspace VFS context');
    think('🔍 Verifying workspace access and loading blueprint metadata…', 'INGESTION');
    const meta = await getBlueprintMeta(id, req.user!.userId);
    if (!meta) {
      console.error(`[Agent] Workspace ${id} not found for user ${req.user!.userId}`);
      sseEvent(res, 'error', { error: 'Workspace not found or access denied' });
      res.end();
      return;
    }

    think('📋 Loading application blueprint specifications…', 'INGESTION');
    const blueprint = await getBlueprintForUser(id, req.user!.userId);
    if (!blueprint) {
      console.error(`[Agent] Blueprint ${id} specifications not found`);
      sseEvent(res, 'error', { error: 'Blueprint specifications not found' });
      res.end();
      return;
    }

    think('📁 Reading current Virtual File System (VFS)…', 'INGESTION');
    const files = await getBlueprintFiles(id);
    console.log(`[Agent] VFS contains ${files.length} file(s)`);

    think('💬 Loading conversation history for context…', 'INGESTION');
    const history = await getChatMessages(id, req.user!.userId);

    await saveChatMessage(id, req.user!.userId, 'user', prompt);

    // Build compact file context — cap individual files at 4000 chars
    const cleanFiles = files
      .filter(f => f.path !== 'preview.html')
      .map(f => ({
        path: f.path,
        content: f.content.length > 4000
          ? f.content.slice(0, 4000) + '\n... [truncated for context window]'
          : f.content,
      }));

    notifyPipelineStage('INGESTION', 'completed', `VFS ingested (${cleanFiles.length} files)`);

    // ─── STAGE 2: AUTO_FIX & INTENT ANALYSIS ────────────────────────────────
    notifyPipelineStage('AUTO_FIX', 'start', 'Dispatching Nemotron 3 Ultra primary for reasoning & auto-fix plan');
    think(`🧠 Analyzing user instruction against ${cleanFiles.length} VFS file(s)…`, 'AUTO_FIX');

    const agentPrompt = `APPLICATION DETAILS:
Name: ${blueprint.parsedBlueprint.appName}
Description: ${blueprint.parsedBlueprint.description}

CURRENT WORKSPACE FILES (VFS):
${JSON.stringify(cleanFiles, null, 2)}

RECENT CHAT HISTORY:
${JSON.stringify(history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })), null, 2)}

USER INSTRUCTION:
${prompt}

Respond with ONLY the JSON object matching the required schema.`;

    const autoFixResult = await completeWithPipelineFallback(
      'AUTO_FIX',
      [
        { role: 'system', content: AGENT_SYSTEM_PROMPT },
        { role: 'user', content: agentPrompt },
      ],
      { temperature: 0.15, maxTokens: getPipelineMaxTokens('AUTO_FIX') }
    );

    if (autoFixResult.usedFallback) {
      notifyPipelineStage('AUTO_FIX', 'fallback', `Primary failed. Dispatched GLM-5.2 fallback model`);
    } else {
      notifyPipelineStage('AUTO_FIX', 'completed', `Reasoning completed via ${autoFixResult.model}`);
    }

    const rawResponse = autoFixResult.text;
    console.log(`[Agent] Raw response received — length: ${rawResponse.length} chars (usedModel=${autoFixResult.model})`);

    think('✅ Response received — parsing JSON plan and target modifications…', 'DIFF_GENERATION');

    let parsed: any;
    try {
      const cleanJson = extractJSON(rawResponse);
      parsed = JSON.parse(cleanJson);
    } catch (parseError: any) {
      console.error('[Agent] JSON parsing FAILED:', parseError.message);
      const errMsg = `Agent returned malformed JSON: ${parseError.message}. Retrying via DIFF_GENERATION pipeline...`;
      await saveChatMessage(id, req.user!.userId, 'assistant', `⚠️ ${errMsg}`);
      sseEvent(res, 'error', { error: errMsg });
      res.end();
      return;
    }

    const plan = parsed.plan || '';
    const message = parsed.message || 'Workspace files have been updated.';
    const outputFiles: Array<{ path: string; content: string; action?: string }> = parsed.files || [];

    // ─── STAGE 3: DIFF_GENERATION & SURGICAL PATCHING ────────────────────────
    notifyPipelineStage('DIFF_GENERATION', 'start', 'Applying search/replace patches via GLM-5.2');
    think(`⚡ Applying surgical patches to ${outputFiles.length} file(s)…`, 'DIFF_GENERATION');

    const vfsMap = new Map<string, string>(files.map(f => [f.path, f.content]));
    const savedList: string[] = [];

    const EXT_LANG: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      css: 'css', html: 'html', json: 'json', md: 'markdown', sql: 'sql',
      py: 'python', sh: 'bash', env: 'text', txt: 'text',
    };

    for (const file of outputFiles) {
      if (!file.path || !file.content) continue;

      let finalContent = file.content;
      const existingContent = vfsMap.get(file.path);

      // Check if file.content contains Search/Replace diff blocks
      const diffBlocks = parseDiffBlocks(file.content);
      if (Array.isArray(diffBlocks) && diffBlocks.length > 0 && existingContent) {
        think(`   🩹 Applying ${diffBlocks.length} Search/Replace patch block(s) to ${file.path}…`, 'DIFF_GENERATION');
        const patchResult = applySearchReplace(existingContent, file.content);
        finalContent = patchResult.code;
        console.log(`[Agent] Patch applied to ${file.path}: ${patchResult.applied} block(s) applied, ${patchResult.failed.length} failed`);
        sseEvent(res, 'patch_apply', {
          path: file.path,
          applied: patchResult.applied,
          failedCount: patchResult.failed.length,
        });
      }

      const ext = file.path.split('.').pop()?.toLowerCase() || 'txt';
      const language = EXT_LANG[ext] || 'text';

      try {
        await saveBlueprintFile(id, file.path, finalContent, language);
        savedList.push(file.path);
        console.log(`[Agent] ✔ Saved: ${file.path} (${finalContent.length} chars, lang=${language})`);
        think(`   ✔ Saved: ${file.path}`, 'DIFF_GENERATION');
      } catch (writeError: any) {
        console.error(`[Agent] ✗ Failed to save ${file.path}:`, writeError.message);
        think(`   ✗ Failed to save ${file.path}: ${writeError.message}`, 'DIFF_GENERATION');
      }
    }

    notifyPipelineStage('DIFF_GENERATION', 'completed', `Successfully updated ${savedList.length} workspace file(s)`);

    await saveChatMessage(id, req.user!.userId, 'assistant', message);
    console.log(`[Agent] Pipeline complete. Saved ${savedList.length} files: ${savedList.join(', ')}`);

    sseEvent(res, 'done', {
      success: true,
      message,
      plan,
      modifiedFiles: savedList,
      pipelineUsed: {
        ingestion: 'gemini-3.5-flash',
        autoFix: autoFixResult.model,
        diffGen: 'z-ai/glm-5.2',
      },
    });

    res.end();
  } catch (err: any) {
    console.error('[Agent] Pipeline error:', err.message, err.stack);
    const errMsg = err.message || 'Agent pipeline process failed unexpectedly';
    await saveChatMessage(id, req.user!.userId, 'assistant', `⚠️ Error: ${errMsg}`);
    sseEvent(res, 'error', { error: errMsg });
    res.end();
  }
});

export default router;
