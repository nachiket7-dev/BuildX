import { Response } from 'express';
import { getLLMProvider, getAgentMaxTokensForModel } from '../llm/router';
import { saveBlueprintFile } from '../db';
import { sendSSE } from '../stream';
import type { Blueprint } from '../types';
import { CODEGEN_SYSTEM_PROMPT, buildCodegenFilePrompt } from './prompts';

function cleanModelOutput(output: string): string {
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

function isRetriableError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const name = (err?.name || '');
  const status = err?.status ?? err?.statusCode ?? 0;
  // Non-retriable: Gemini returns 400 when safety filters produce empty output
  if (msg.includes('model output must contain') || msg.includes('output text or tool calls')) return false;
  return (
    // Rate limit / capacity errors (413 = Groq TPM exceeded, 429 = RPM exceeded, 503 = capacity)
    status === 413 || status === 429 || status === 503 ||
    msg.includes('rate limit') ||
    msg.includes('resourceexhausted') ||
    msg.includes('request limit') ||
    msg.includes('too many requests') ||
    msg.includes('request too large') ||
    (err?.code === 'rate_limit_exceeded') ||
    // Timeout errors — SDK throws APIConnectionTimeoutError with no status
    name === 'APIConnectionTimeoutError' ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused')
  );
}

/** Extract retry-after seconds from an API error's response headers OR message string */
function getRetryAfterMs(err: any, defaultMs: number): number {
  // 1. Try HTTP header
  const headerVal = err?.headers?.['retry-after'];
  if (headerVal) {
    const parsed = parseFloat(headerVal);
    if (!isNaN(parsed)) return Math.ceil(parsed + 2) * 1000; // +2s buffer
  }
  // 2. Try parsing "try again in 19.455s" from the error message
  const msg = err?.message || '';
  const match = msg.match(/try again in (\d+(?:\.\d+))s/i);
  if (match) {
    const parsed = parseFloat(match[1]);
    if (!isNaN(parsed)) return Math.ceil(parsed + 2) * 1000; // +2s buffer
  }
  return defaultMs;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function completeWithRetry(
  provider: any,
  messages: any[],
  options: any,
  res: Response,
  filePath: string,
  maxRetries = 5
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await provider.complete(messages, options);
    } catch (err: any) {
      if (isRetriableError(err) && attempt < maxRetries) {
        const isTimeout = (err?.name === 'APIConnectionTimeoutError' || (err?.message || '').toLowerCase().includes('timed out'));
        const isRateLimit = (err?.status === 413 || err?.status === 429 ||
          (err?.message || '').toLowerCase().includes('rate limit') ||
          (err?.message || '').toLowerCase().includes('request too large') ||
          (err?.code === 'rate_limit_exceeded'));
        // For any rate limit: use retry-after from header/message; otherwise exponential backoff
        const defaultMs = isTimeout
          ? Math.pow(2, attempt) * 5000   // 10s, 20s for timeouts
          : Math.pow(2, attempt) * 3000;  // 6s, 12s, 24s, 48s for other errors
        const waitMs = isRateLimit ? getRetryAfterMs(err, defaultMs) : defaultMs;
        const waitSec = Math.round(waitMs / 1000);
        const reason = isRateLimit ? 'Rate limit' : isTimeout ? 'Timeout' : 'Error';
        console.warn(`[Codegen Agent] ${reason} on ${filePath} (attempt ${attempt}/${maxRetries}). Retrying in ${waitSec}s...`);
        sendSSE(res, 'codegen_retry', {
          path: filePath,
          attempt,
          maxRetries,
          waitSeconds: waitSec,
          message: `${reason} — retrying in ${waitSec}s (attempt ${attempt}/${maxRetries})...`
        });
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

export async function generateApplicationCode(
  blueprintId: string,
  blueprint: Blueprint,
  res: Response,
  model?: string
): Promise<void> {
  // ─── Model override: Always use Groq gpt-oss-120b for scaffold generation ────
  // Groq gpt-oss-120b: fast (~2-3s/file), high TPM headroom on free tier.
  // Gemini API key invalid. Nemotron too slow (3-5min/file) and rate-limited.
  // Nemotron remains the chat agent model in routes/agent.ts.
  const SCAFFOLD_MODEL = 'gpt-oss-120b';
  // Keep output tokens low: 3500 tokens covers any realistic source file, AND
  // keeps total request (input ~1000 + output 3500 = 4500) under Groq's 6k TPM limit.
  const SCAFFOLD_MAX_TOKENS = 3500;
  const provider = getLLMProvider(SCAFFOLD_MODEL);
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

  // ─── Generate each file sequentially ─────────────────────
  for (let i = 0; i < filesToGenerate.length; i++) {
    const filePath = filesToGenerate[i];
    const index = i + 1;

    console.log(`[Codegen Agent] [${index}/${filesToGenerate.length}] Generating: ${filePath}`);
    sendSSE(res, 'codegen_file_start', { path: filePath, index });

    const prompt = buildCodegenFilePrompt(blueprint, filePath, generatedFiles);
    
    let fileContent = '';
    try {
      const rawText = await completeWithRetry(
        provider,
        [
          { role: 'system', content: CODEGEN_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.2, maxTokens: SCAFFOLD_MAX_TOKENS },
        res,
        filePath
      );

      fileContent = cleanModelOutput(rawText);

      // Guard: if model returned only <think> blocks or empty string, retry
      if (!fileContent || fileContent.length < 10) {
        const emptyErr: any = new Error(`Empty model output for ${filePath} — retrying`);
        emptyErr.name = 'APIConnectionTimeoutError'; // treated as retriable
        throw emptyErr;
      }
      
      // Cache file context for subsequent generations
      generatedFiles[filePath] = fileContent;

      // Extract language type from extension
      const extension = filePath.split('.').pop() || 'txt';
      const languageMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        sql: 'sql',
        md: 'markdown',
        json: 'json'
      };
      const language = languageMap[extension] || 'text';

      // Save to database
      await saveBlueprintFile(blueprintId, filePath, fileContent, language);

      // Stream to frontend
      sendSSE(res, 'codegen_file_done', { path: filePath, content: fileContent });
      console.log(`[Codegen Agent] [${index}/${filesToGenerate.length}] Completed: ${filePath} (${fileContent.length} chars)`);

      // Pace requests to stay within Groq's TPM limit window (6k tokens/min on free tier)
      if (index < filesToGenerate.length) await sleep(1500);

    } catch (err: any) {
      console.error(`[Codegen Agent] Failed generating file ${filePath}:`, err);
      sendSSE(res, 'error', { message: `Failed generating file ${filePath}: ${err.message}` });
      throw err;
    }
  }

  sendSSE(res, 'codegen_done', { filesGenerated: filesToGenerate.length });
  console.log(`[Codegen Agent] Complete code generation finished successfully.`);
}
