import { Response } from 'express';
import { runEngineeringAgent } from '../agent/engine';
import { acquireWorkspace } from '../agent/store';
import { generateMonorepoFiles } from '../scaffold';
import { getLanguageFromPath } from '../../services/vfsService';
import { getBlueprintFiles, saveBlueprintFilesAtomically } from '../db';
import { sendSSE } from '../stream';
import type { Blueprint } from '../types';

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

/** Full-code generation shares the same inspect/patch/check/review runtime as chat. */
export async function generateApplicationCode(blueprintId: string, blueprint: Blueprint, res: Response, model?: string): Promise<void> {
  const controller = new AbortController();
  const close = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', close);
  const timer = setTimeout(() => controller.abort(), 8 * 60_000);
  let release: (() => Promise<void>) | undefined;
  try {
    release = await acquireWorkspace(blueprintId, () => controller.abort());
    const existing = await getBlueprintFiles(blueprintId);
    const initial = existing.length ? existing : Object.entries(generateMonorepoFiles(blueprint)).map(([path, content]) => ({ path, content }));
    sendSSE(res, 'codegen_start', { totalFiles: initial.length, appName: blueprint.appName });
    const result = await runEngineeringAgent(`Implement this application from its blueprint. Inspect the existing workspace and selected stack. Complete missing behavior without replacing working files. Connect frontend actions to API contracts, enforce real authentication and persist data. Do not claim mock data is working functionality. Run relevant checks. Blueprint: ${JSON.stringify(blueprint)}`, initial, { taskKind: 'codegen', model, signal: controller.signal }, (event, data) => sendSSE(res, event, data));
    controller.signal.throwIfAborted();
    const candidate = Object.fromEntries(initial.map(file => [file.path, file.content]));
    for (const file of result.modifiedFiles) candidate[file.path] = file.content;
    const expected = Object.fromEntries(existing.map(file => [file.path, file.content]));
    for (const path of Object.keys(candidate)) if (!(path in expected)) expected[path] = '';
    await saveBlueprintFilesAtomically(blueprintId, Object.entries(candidate).map(([path, content]) => ({ path, content, language: getLanguageFromPath(path) })), { expected });
    for (const [path, content] of Object.entries(candidate)) sendSSE(res, 'codegen_file_done', { path, content });
    sendSSE(res, 'codegen_done', { filesGenerated: Object.keys(candidate).length, checks: result.checks, checksPassed: result.checksPassed, review: result.review });
  } finally {
    clearTimeout(timer); res.removeListener('close', close); await release?.();
  }
}
