import { Response } from 'express';
import { completeWithPipelineFallback, getAgentMaxTokensForModel } from '../llm/router';
import { saveBlueprintFilesAtomically } from '../db';
import { sendSSE } from '../stream';
import type { Blueprint } from '../types';
import { CODEGEN_SYSTEM_PROMPT, buildCodegenFilePrompt } from './prompts';

export function cleanModelOutput(output: string): string {
  let cleaned = output.trim();
  // Strip <think>...</think> reasoning blocks emitted by Qwen/Groq models
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    const nextNewline = cleaned.indexOf('\n');
    if (nextNewline > -1) cleaned = cleaned.substring(nextNewline + 1);
  }
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  return cleaned.trim();
}

/**
 * Trims raw stderr / stack-trace strings before injecting them into prompt payloads.
 *
 * Long stack traces (sometimes 500+ lines from Node/webpack/Babel) bloat the prompt,
 * push the token count past model limits, and are the primary cause of AUTO_FIX
 * "Request timed out" failures. This helper:
 *   - Keeps only the last 100 lines (most relevant errors are at the bottom)
 *   - Hard-caps output at 4,000 characters
 *   - Prepends a truncation notice when content was cut
 */
export function sanitizeTerminalError(stderr: string): string {
  if (!stderr || typeof stderr !== 'string') return '';
  const lines = stderr.split('\n');
  const MAX_LINES = 100;
  const MAX_CHARS = 4000;
  const truncatedLines = lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines;
  let result = truncatedLines.join('\n').trim();
  if (result.length > MAX_CHARS) {
    result = result.slice(-MAX_CHARS);
    return `[...truncated — showing last ${MAX_CHARS} chars]\n${result}`;
  }
  if (lines.length > MAX_LINES) {
    return `[...truncated — showing last ${MAX_LINES} of ${lines.length} lines]\n${result}`;
  }
  return result;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateApplicationCode(
  blueprintId: string,
  blueprint: Blueprint,
  res: Response,
  model?: string
): Promise<void> {
  // Honor the requested model. The frontend may send "pipeline" for legacy
  // callers; treat that sentinel as the router's configured default model.
  const requestedModel = model && model !== 'pipeline' ? model : undefined;
  const scaffoldMaxTokens = Math.min(getAgentMaxTokensForModel(requestedModel), 6000);
  const isMongo = (blueprint.architecture?.database || '').toLowerCase().includes('mongo');

  // ─── Compile target files tree ───────────────────────────
  const filesToGenerate: string[] = [];

  // 1. Shared / Config Files
  filesToGenerate.push('README.md');
  filesToGenerate.push('package.json');

  // 2. Database schemas/models
  if (isMongo) {
    filesToGenerate.push('backend/src/models/schemas.ts');
  } else {
    filesToGenerate.push('backend/src/db/schema.sql');
  }

  // 3. Backend application structure
  filesToGenerate.push('backend/src/types.ts');
  filesToGenerate.push('backend/src/routes/auth.ts');
  
  // Create router routes for up to 3 core schema tables
  const coreTables = (blueprint.schema || []).map(t => t.table).filter(name => name !== 'users');
  for (const table of coreTables.slice(0, 3)) {
    filesToGenerate.push(`backend/src/routes/${table}.ts`);
  }
  filesToGenerate.push('backend/src/app.ts');

  // 4. Frontend application structure
  filesToGenerate.push('frontend/src/types.ts');
  filesToGenerate.push('frontend/src/api/client.ts');
  filesToGenerate.push('frontend/src/index.css');

  // Create page components for user screens
  const screens = blueprint.screens || [];
  for (const screen of screens) {
    const kebabName = screen.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screen';
    filesToGenerate.push(`frontend/src/pages/${kebabName}.tsx`);
  }
  filesToGenerate.push('frontend/src/App.tsx');

  console.log(`[Codegen Agent] Starting generation for ${filesToGenerate.length} files.`);
  sendSSE(res, 'codegen_start', { totalFiles: filesToGenerate.length, appName: blueprint.appName });

  const generatedFiles: Record<string, string> = {};
  let lastModelUsed = requestedModel || 'pipeline';

  // ─── Generate each file sequentially ─────────────────────
  for (let i = 0; i < filesToGenerate.length; i++) {
    const filePath = filesToGenerate[i];
    const index = i + 1;

    console.log(`[Codegen Agent] [${index}/${filesToGenerate.length}] Generating: ${filePath}`);
    sendSSE(res, 'codegen_file_start', { path: filePath, index });

    const prompt = buildCodegenFilePrompt(blueprint, filePath, generatedFiles);
    
    let fileContent = '';
    try {
      const response = await completeWithPipelineFallback(
        'CODE_GENERATION',
        [
          { role: 'system', content: CODEGEN_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.2, maxTokens: scaffoldMaxTokens },
        requestedModel
      );
      const rawText = response.text;
      lastModelUsed = response.model;

      fileContent = cleanModelOutput(rawText);

      // Guard: if model returned only <think> blocks or empty string, retry
      if (!fileContent || fileContent.length < 10) {
        const emptyErr: any = new Error(`Empty model output for ${filePath} — retrying`);
        emptyErr.name = 'APIConnectionTimeoutError'; // treated as retriable
        throw emptyErr;
      }
      
      // Cache file context for subsequent generations
      generatedFiles[filePath] = fileContent;

      // Keep output in memory until every file is generated successfully.
      // The client receives progress, but no file is committed yet.
      sendSSE(res, 'codegen_file_ready', { path: filePath, index });
      console.log(`[Codegen Agent] [${index}/${filesToGenerate.length}] Completed: ${filePath} (${fileContent.length} chars)`);

      // Pace requests to stay within Groq's TPM limit window (6k tokens/min on free tier)
      if (index < filesToGenerate.length) await sleep(1500);

    } catch (err: any) {
      const rawErrMsg = err?.message || String(err);
      const safeErrMsg = sanitizeTerminalError(rawErrMsg);
      console.error(`[Codegen Agent] Failed generating file ${filePath}:`, safeErrMsg);
      sendSSE(res, 'pipeline_error', {
        stage: 'CODE_GENERATION',
        model: lastModelUsed,
        partial: false,
        retryable: true,
        failedPath: filePath,
        message: `Generation stopped before commit for ${filePath}. No newly generated files were saved.`,
      });
      sendSSE(res, 'error', { message: `Failed generating file ${filePath}: ${safeErrMsg}` });
      throw err;
    }
  }

  const filesToPersist = Object.entries(generatedFiles).map(([path, content]) => ({
    path,
    content,
    language: path.endsWith('.tsx') || path.endsWith('.ts')
      ? 'typescript'
      : path.endsWith('.sql')
        ? 'sql'
        : path.endsWith('.md')
          ? 'markdown'
          : path.endsWith('.json')
            ? 'json'
            : 'text',
  }));

  try {
    await saveBlueprintFilesAtomically(blueprintId, filesToPersist);
  } catch (err: any) {
    const safeErrMsg = sanitizeTerminalError(err?.message || String(err));
    sendSSE(res, 'pipeline_error', {
      stage: 'CODE_GENERATION',
      model: lastModelUsed,
      partial: false,
      retryable: true,
      message: 'Generation completed, but the workspace commit failed. No partial file set was saved.',
    });
    sendSSE(res, 'error', { message: `Code generation commit failed: ${safeErrMsg}` });
    throw err;
  }

  // Commit point: only now expose file contents to the client.
  for (const file of filesToPersist) {
    sendSSE(res, 'codegen_file_done', { path: file.path, content: file.content });
  }

  sendSSE(res, 'codegen_done', { filesGenerated: filesToGenerate.length });
  console.log(`[Codegen Agent] Complete code generation finished successfully.`);
}
