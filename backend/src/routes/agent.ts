import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../lib/auth';
import { getBlueprintForUser, getBlueprintMeta, getBlueprintFiles, saveBlueprintFile, saveChatMessage, getChatMessages } from '../lib/db';
import { getLLMProvider, getAgentMaxTokensForModel } from '../lib/llm/router';
import { extractJSON } from '../lib/jsonExtract';

const router = Router();

// NOTE: "thinking" is intentionally NOT in this schema.
// Asking the model to output a verbose thinking monologue inside the JSON wastes
// hundreds of tokens before files[] is reached, causing truncation on token-limited models.
// Real-time thinking feedback is handled by the server-side think() SSE events instead.
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
      "content": "<complete source code>",
      "action": "create"
    }
  ]
}

CRITICAL RULES:
1. Return ONLY the JSON object. No markdown fences, no preamble, no trailing text.
2. "files" MUST contain every file you create or modify. Never omit files.
3. Every "content" field MUST be the COMPLETE source code. Never truncate. Never use placeholders like "// ... rest of code".
4. Frontend files: React 18, Tailwind CSS, Lucide React icons.
5. Backend files: Express + TypeScript.
6. Write functional logic that integrates with existing VFS files.
7. MINIMIZE RESPONSE SIZE: Only include files in "files" that strictly need modifications. Keep the "plan" and "message" text extremely brief (1-2 sentences) to save the output token budget for code content. This is critical to prevent output truncation.`;

// Helper: emit a single SSE event
function sseEvent(res: Response, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/:id/chat', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { prompt, model } = req.body;

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

  const think = (step: string) => {
    console.log(`[Agent:think] ${step}`);
    sseEvent(res, 'thinking', { step });
  };

  const selectedModel = model || 'nemotron-3-550b';
  const modelLabel = selectedModel === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash'
    : selectedModel === 'gemini-3.1-pro' ? 'Gemini 3.1 Pro'
    : 'Nemotron 550B';

  try {
    think('🔍 Verifying workspace access and loading blueprint metadata…');
    const meta = await getBlueprintMeta(id, req.user!.userId);
    if (!meta) {
      console.error(`[Agent] Workspace ${id} not found for user ${req.user!.userId}`);
      sseEvent(res, 'error', { error: 'Workspace not found or access denied' });
      res.end();
      return;
    }

    think('📋 Loading application blueprint specifications…');
    const blueprint = await getBlueprintForUser(id, req.user!.userId);
    if (!blueprint) {
      console.error(`[Agent] Blueprint ${id} specifications not found`);
      sseEvent(res, 'error', { error: 'Blueprint specifications not found' });
      res.end();
      return;
    }

    think('📁 Reading current Virtual File System (VFS)…');
    const files = await getBlueprintFiles(id);
    console.log(`[Agent] VFS contains ${files.length} file(s)`);

    think('💬 Loading conversation history for context…');
    const history = await getChatMessages(id, req.user!.userId);

    await saveChatMessage(id, req.user!.userId, 'user', prompt);

    // Build compact file context — cap individual files at 4000 chars to save tokens
    const cleanFiles = files
      .filter(f => f.path !== 'preview.html')
      .map(f => ({
        path: f.path,
        content: f.content.length > 4000
          ? f.content.slice(0, 4000) + '\n... [truncated for context window]'
          : f.content,
      }));

    think(`🧠 Analyzing ${cleanFiles.length} workspace file(s) — understanding the architecture…`);

    const agentPrompt = `APPLICATION DETAILS:
Name: ${blueprint.parsedBlueprint.appName}
Description: ${blueprint.parsedBlueprint.description}

CURRENT WORKSPACE FILES (VFS):
${JSON.stringify(cleanFiles, null, 2)}

RECENT CHAT HISTORY:
${JSON.stringify(history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })), null, 2)}

USER INSTRUCTION:
${prompt}

Respond with ONLY the JSON object. Include ALL created/modified files with their complete source code.`;

    const maxTokens = getAgentMaxTokensForModel(selectedModel);
    think(`⚡ Sending to ${modelLabel} (max ${maxTokens} tokens) — generating plan and code…`);
    console.log(`[Agent] Calling ${selectedModel} with maxTokens=${maxTokens}, prompt length=${agentPrompt.length} chars`);

    const provider = getLLMProvider(selectedModel);
    const rawResponse = await provider.complete([
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: agentPrompt },
    ], { temperature: 0.15, maxTokens });

    console.log(`[Agent] Raw response received — length: ${rawResponse.length} chars`);
    console.log(`[Agent] Raw response preview (first 500 chars): ${rawResponse.slice(0, 500)}`);
    console.log(`[Agent] Raw response tail (last 200 chars): ${rawResponse.slice(-200)}`);

    think('✅ Model responded — parsing and validating JSON…');

    let parsed: any;
    try {
      const cleanJson = extractJSON(rawResponse);
      console.log(`[Agent] Extracted JSON length: ${cleanJson.length} chars`);
      parsed = JSON.parse(cleanJson);
      console.log(`[Agent] JSON parsed successfully. Files in response: ${parsed.files?.length ?? 0}`);
    } catch (parseError: any) {
      console.error('[Agent] JSON parsing FAILED:', parseError.message);
      console.error('[Agent] Full raw response:\n', rawResponse);
      const errMsg = `Agent returned malformed JSON: ${parseError.message}. The model may have hit its token limit. Try a shorter request or switch to Gemini 3.5 Flash.`;
      await saveChatMessage(id, req.user!.userId, 'assistant', `⚠️ ${errMsg}`);
      sseEvent(res, 'error', {
        error: errMsg,
      });
      res.end();
      return;
    }

    const plan = parsed.plan || '';
    const message = parsed.message || 'Workspace files have been updated.';
    const outputFiles: Array<{ path: string; content: string; action?: string }> = parsed.files || [];

    // Validate files array before writing
    const validFiles = outputFiles.filter(f => {
      if (!f.path) { console.warn('[Agent] Skipping file with no path'); return false; }
      if (!f.content) { console.warn(`[Agent] Skipping file with no content: ${f.path}`); return false; }
      if (f.content.length < 5) { console.warn(`[Agent] Skipping suspiciously short file: ${f.path} (${f.content.length} chars)`); return false; }
      return true;
    });

    console.log(`[Agent] ${validFiles.length} valid file(s) to write (${outputFiles.length - validFiles.length} skipped)`);

    if (validFiles.length === 0 && outputFiles.length > 0) {
      console.error('[Agent] All files were invalid — possibly token truncation in files[].content');
      const errMsg = 'Agent generated a plan but file contents were empty or invalid. The model may have hit its token limit. Please try again with a more specific request.';
      await saveChatMessage(id, req.user!.userId, 'assistant', `⚠️ ${errMsg}`);
      sseEvent(res, 'error', {
        error: errMsg,
      });
      res.end();
      return;
    }

    think(`💾 Writing ${validFiles.length} file(s) to the Virtual File System…`);

    const savedList: string[] = [];
    const EXT_LANG: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      css: 'css', html: 'html', json: 'json', md: 'markdown', sql: 'sql',
      py: 'python', sh: 'bash', env: 'text', txt: 'text',
    };

    for (const file of validFiles) {
      const ext = file.path.split('.').pop()?.toLowerCase() || 'txt';
      const language = EXT_LANG[ext] || 'text';
      try {
        await saveBlueprintFile(id, file.path, file.content, language);
        savedList.push(file.path);
        console.log(`[Agent] ✔ Saved: ${file.path} (${file.content.length} chars, lang=${language})`);
        think(`   ✔ Saved: ${file.path}`);
      } catch (writeError: any) {
        console.error(`[Agent] ✗ Failed to save ${file.path}:`, writeError.message);
        think(`   ✗ Failed to save ${file.path}: ${writeError.message}`);
      }
    }

    await saveChatMessage(id, req.user!.userId, 'assistant', message);
    console.log(`[Agent] Done. Saved ${savedList.length} files: ${savedList.join(', ')}`);

    sseEvent(res, 'done', {
      success: true,
      message,
      plan,
      modifiedFiles: savedList,
    });

    res.end();
  } catch (err: any) {
    console.error('[Agent] Unexpected error:', err.message, err.stack);
    const errMsg = err.message || 'Agent process failed unexpectedly';
    await saveChatMessage(id, req.user!.userId, 'assistant', `⚠️ Error: ${errMsg}`);
    sseEvent(res, 'error', { error: errMsg });
    res.end();
  }
});

export default router;
