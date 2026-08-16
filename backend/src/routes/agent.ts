import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../lib/auth';
import { getBlueprintForUser, getBlueprintMeta, getBlueprintFiles, saveBlueprintFile, saveChatMessage, getChatMessages } from '../lib/db';
import { completeWithPipelineFallback, getPipelineMaxTokens } from '../lib/llm/router';
import { extractJSON, extractFieldsFromBrokenJson } from '../lib/jsonExtract';
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

CRITICAL JSON ENCODING RULES — MUST FOLLOW EXACTLY:
1. Return ONLY the JSON object. No markdown fences (\`\`\`json), no preamble, no trailing text.
2. ALL string values in the JSON MUST be properly escaped:
   - Every double quote \" inside a string value MUST be escaped as \\\"
   - Every backslash \\ inside a string value MUST be escaped as \\\\
   - Every newline inside a string value MUST be escaped as \\n (not a real newline character)
   - Every tab inside a string value MUST be escaped as \\t
3. "files" MUST contain every file you create or modify. Never omit files.
4. Every "content" field MUST be the COMPLETE source code for new files OR Search/Replace diff blocks for edits.
5. Frontend files: React 18, Tailwind CSS, Lucide React icons.
6. Backend files: Express + TypeScript.
7. Write functional logic that integrates with existing VFS files.
8. MINIMIZE RESPONSE SIZE: Only include files in "files" that strictly need modifications. Keep the "plan" and "message" text extremely brief (1-2 sentences).`;

// Helper: emit a single SSE event
function sseEvent(res: Response, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/:id/chat', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
    const {
      prompt,
      model,
      mode,
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

    const think = (step: string, stage?: PipelineStage) => {
      console.log(`[Agent:think${stage ? `:${stage}` : ''}] ${step}`);
      sseEvent(res, 'thinking', { step, stage });
    };

    const notifyPipelineStage = (stage: PipelineStage, state: 'start' | 'completed' | 'fallback', detail?: string) => {
      sseEvent(res, 'pipeline_stage', { stage, state, detail });
    };

    try {
      // ─── STAGE 1: INGESTION ──────────────────────────────────────────────────
      notifyPipelineStage('INGESTION', 'start', 'Parsing workspace VFS and runtime context');
      think('🔍 Verifying workspace access and loading blueprint metadata…', 'INGESTION');
      const meta = await getBlueprintMeta(id, req.user!.userId);
      if (!meta) {
        console.error(`[Agent] Workspace ${id} not found for user ${req.user!.userId}`);
        sseEvent(res, 'error', { error: 'Workspace not found or access denied' });
        res.end();
        return;
      }

      think('📋 Loading application blueprint & database schema specifications…', 'INGESTION');
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

      notifyPipelineStage('INGESTION', 'completed', `VFS ingested (${cleanFiles.length} files) with runtime telemetry`);

      // ─── STAGE 2: AUTO_FIX & INTENT ANALYSIS ────────────────────────────────
      notifyPipelineStage('AUTO_FIX', 'start', 'Dispatching Cortex LLM router for reasoning & diff planning');
      think(`🧠 Analyzing user instruction against ${cleanFiles.length} VFS file(s)…`, 'AUTO_FIX');

      // Construct comprehensive context payload including active file, schema, and preview errors
      const bp = blueprint.parsedBlueprint;
      const schemaContext = {
        schema: bp.schema || [],
        endpoints: bp.endpoints || [],
        screens: bp.screens || [],
      };

      const errorSection = previewErrors
        ? `\nACTIVE PREVIEW RUNTIME ERRORS / STACK TRACE:\n${typeof previewErrors === 'string' ? previewErrors : JSON.stringify(previewErrors, null, 2)}\n`
        : '';

      const consoleSection = consoleLogs
        ? `\nBROWSER CONSOLE LOGS:\n${typeof consoleLogs === 'string' ? consoleLogs : JSON.stringify(consoleLogs, null, 2)}\n`
        : '';

      const activeFileSection = activeFilePath
        ? `\nCURRENTLY ACTIVE EDITOR FILE: "${activeFilePath}"\n` +
          (activeFileContent
            ? `ACTIVE FILE CODE:\n\`\`\`\n${activeFileContent.slice(0, 4000)}\n\`\`\`\n`
            : '')
        : '';

      const agentPrompt = `APPLICATION DETAILS:
Name: ${bp.appName || (bp as any).title || 'BuildX App'}
Description: ${bp.description || 'Full-Stack Application'}
Layout Paradigm: ${bp.layoutParadigm || 'LEFT_SIDEBAR_DASHBOARD'}

DATABASE BLUEPRINT SCHEMA & SPECIFICATIONS:
${JSON.stringify(schemaContext, null, 2)}
${activeFileSection}${errorSection}${consoleSection}
CURRENT WORKSPACE FILES (VFS):
${JSON.stringify(cleanFiles, null, 2)}

RECENT CHAT HISTORY:
${JSON.stringify(history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })), null, 2)}

USER INSTRUCTION:
${prompt}

DIFF GENERATION INSTRUCTION:
- For modifying existing files, use Search/Replace diff blocks inside "content" to minimize latency:
<<<<<<< SEARCH
<exact lines from original file>
=======
<replacement lines>
>>>>>>> REPLACE
- For creating new files, write the full content.
- Respond with ONLY the JSON object matching the required schema.`;

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
        console.warn('[Agent] Primary JSON parse failed:', parseError.message, '— attempting field extraction fallback...');

        // ── Fallback 1: Field-level extraction from broken JSON ───────────────
        const fields = extractFieldsFromBrokenJson(rawResponse);
        if (fields) {
          console.info('[Agent] Field extraction fallback succeeded. Recovering plan/message/files.');
          parsed = {
            plan: fields['plan'] || '',
            message: fields['message'] || 'Workspace files have been updated.',
            files: [],
          };

          if (fields['files_raw']) {
            try {
              parsed.files = JSON.parse(fields['files_raw']);
            } catch {
              console.warn('[Agent] Could not parse files_raw — will treat response as diff-only.');
            }
          }

          if (!parsed.files || parsed.files.length === 0) {
            const diffBlocks = parseDiffBlocks(rawResponse);
            if (Array.isArray(diffBlocks) && diffBlocks.length > 0) {
              const existingPaths = files.map((f: any) => f.path);
              const targetPath =
                activeFilePath ||
                existingPaths.find((p: string) => rawResponse.includes(p.split('/').pop()!)) ||
                'frontend/src/App.tsx';
              parsed.files = [{ path: targetPath, content: rawResponse, action: 'modify' }];
              parsed.message = parsed.message || 'Applied diff patch from agent response.';
            }
          }

          if (!parsed.files) parsed.files = [];
        } else {
          console.error('[Agent] All JSON repair strategies failed:', parseError.message);
          const recoveryMsg = 'I ran into a formatting issue with my response. Please try rephrasing your request.';
          await saveChatMessage(id, req.user!.userId, 'assistant', recoveryMsg);
          sseEvent(res, 'done', {
            success: false,
            message: recoveryMsg,
            plan: '',
            modifiedFiles: [],
            pipelineUsed: { ingestion: 'gemini-3.5-flash', autoFix: autoFixResult.model, diffGen: 'none' },
          });
          res.end();
          return;
        }
      }

      const plan = parsed.plan || '';
      const message = parsed.message || 'Workspace files have been updated.';
      const outputFiles: Array<{ path: string; content: string; action?: string }> = parsed.files || [];

      // ─── STAGE 3: DIFF_GENERATION & SURGICAL PATCHING ────────────────────────
      notifyPipelineStage('DIFF_GENERATION', 'start', 'Applying surgical diff patches to workspace VFS');
      think(`⚡ Applying surgical patches to ${outputFiles.length} file(s)…`, 'DIFF_GENERATION');

      const vfsMap = new Map<string, string>(files.map(f => [f.path, f.content]));
      const savedList: string[] = [];
      const stagedDiffs: Record<string, { original: string; modified: string }> = {};

      const EXT_LANG: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        css: 'css', html: 'html', json: 'json', md: 'markdown', sql: 'sql',
        py: 'python', sh: 'bash', env: 'text', txt: 'text',
      };

      for (const file of outputFiles) {
        if (!file.path || !file.content) continue;

        let finalContent = file.content;
        const existingContent = vfsMap.get(file.path) || (file.path === activeFilePath ? activeFileContent : '');

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

        if (existingContent && existingContent !== finalContent) {
          stagedDiffs[file.path] = {
            original: existingContent,
            modified: finalContent,
          };
          sseEvent(res, 'staged_diff', {
            path: file.path,
            original: existingContent,
            modified: finalContent,
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
        stagedDiffs,
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
