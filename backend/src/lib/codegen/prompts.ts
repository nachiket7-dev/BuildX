import type { Blueprint } from '../types';
import { UI_GENERATOR_SYSTEM_PROMPT } from '../../prompts/uiGenerator';

// ─── Mode Constants ──────────────────────────────────────────────────────────

/**
 * FULL_FILE_MODE: Used by Blueprint Scaffolding (INGESTION → DIFF_GENERATION pipeline).
 * The model outputs the entire file content — no diff blocks, no fences.
 * Used in agent.ts → generateApplicationCode().
 */
export const FULL_FILE_MODE = 'FULL_FILE_MODE' as const;

/**
 * DIFF_PATCH_MODE: Used by Iterative Code Refinement / Auto-Fix (refine.ts / sandboxRunner).
 * The model outputs ONLY strict Search/Replace blocks:
 *   <<<<<<< SEARCH
 *   <exact original lines>
 *   =======
 *   <replacement lines>
 *   >>>>>>> REPLACE
 * Used in refine.ts → applyCodePatch() and Phase 4 AUTO_FIX loop.
 */
export const DIFF_PATCH_MODE = 'DIFF_PATCH_MODE' as const;

export type CodegenMode = typeof FULL_FILE_MODE | typeof DIFF_PATCH_MODE;

// ─── FULL_FILE_MODE Prompts (Blueprint Scaffolding) ──────────────────────────

/**
 * System prompt for FULL_FILE_MODE.
 * The model writes the entire content of a single file from scratch.
 * Consumed by: generateApplicationCode() in codegen/agent.ts
 */
export const CODEGEN_SYSTEM_PROMPT = `You are BuildX Codegen — an expert principal software engineer and UI/UX Designer.
Your task is to write a single, complete, and production-ready source code file for an application based on its product blueprint spec.

CRITICAL RULES:
1. Output ONLY the raw source code of the requested file.
2. Absolutely NO markdown code block wrappers (no triple backticks \`\`\`), no introductory explanations, no notes.
3. Write clean, modular, and modern code with full typings (TypeScript/ES6).
4. Do not use placeholders or write "// TODO: implement later". Implement full logic, database fields, validations, and UI templates.
5. All code must compile and integrate cleanly with previously generated files.

${UI_GENERATOR_SYSTEM_PROMPT}`;

/**
 * Build a user prompt for FULL_FILE_MODE — generates the complete content of one file.
 * Consumed by: generateApplicationCode() in codegen/agent.ts
 */
export function buildCodegenFilePrompt(
  blueprint: Blueprint,
  filePath: string,
  previouslyGeneratedFiles: Record<string, string>
): string {
  const blueprintSummary = {
    appName: blueprint.appName,
    description: blueprint.description,
    architecture: blueprint.architecture,
    schema: blueprint.schema,
    endpoints: blueprint.endpoints,
    screens: blueprint.screens,
    features: blueprint.features
  };

  // Only send file paths (not full contents) — full contents caused 10k+ input tokens
  // which blew past Groq's 6k TPM free-tier limit on every request.
  const prevFilesSummary = Object.keys(previouslyGeneratedFiles).length > 0
    ? `Files already generated (paths only — use these for correct relative imports):\n` +
      Object.keys(previouslyGeneratedFiles).map(p => `  - ${p}`).join('\n')
    : 'No files have been generated yet.';

  return `APPLICATION BLUEPRINT SPEC:
${JSON.stringify(blueprintSummary, null, 2)}

GENERATED CONTEXT:
${prevFilesSummary}

TASK:
Write the complete file content for the file path: "${filePath}"

Instructions specific to "${filePath}":
- If this is a frontend React component, strictly apply the dark glassmorphic design system (#09090b backgrounds, bg-zinc-900/80 border border-white/10 cards, gradient accents, Lucide icons).
- Match imports exactly with previously generated files (e.g. import types from "./types" or relative paths matching the file tree).
- Handle edge cases, errors, and loading states. Use mock state logic with domain realism for frontend files that simulate API requests.
- Provide clean database setup if this is database schemas or configurations.
- Write actual functional logic, not comments.

${UI_GENERATOR_SYSTEM_PROMPT}

Output the content of "${filePath}" now:`;
}

// ─── DIFF_PATCH_MODE Prompts (Iterative Code Refinement / Auto-Fix) ──────────

/**
 * System prompt for DIFF_PATCH_MODE.
 * Forces the model to output ONLY strict Search/Replace diff blocks.
 * Zero prose, zero fences around the diff markers themselves.
 *
 * Consumed by:
 *   - applyCodePatch() in refine.ts  (DIFF_GENERATION stage)
 *   - Phase 4 AUTO_FIX loop          (AUTO_FIX stage)
 */
export const DIFF_PATCH_SYSTEM_PROMPT = `You are BuildX Patch Engine — a surgical code editor.
Your ONLY job is to emit Search/Replace diff blocks that precisely describe the minimal change needed.

OUTPUT FORMAT — strict, no exceptions:
<<<<<<< SEARCH
<exact lines from the original file, including all whitespace and indentation>
=======
<replacement lines — the corrected or updated version>
>>>>>>> REPLACE

RULES:
1. Output ONLY diff blocks. No prose, no explanations, no markdown fences.
2. You may emit multiple diff blocks in one response — one per logical change location.
3. The SEARCH section MUST be an exact verbatim copy of lines from the original file (whitespace-sensitive).
4. Keep SEARCH sections as short as possible — include only the lines that must change plus 1–2 lines of context for uniqueness.
5. The REPLACE section contains the corrected replacement (may be empty to delete lines).
6. Never rewrite the entire file. Make only the minimal change that fixes the problem.
7. If no change is needed, output exactly: NO_CHANGE`;

/**
 * Build a user prompt for DIFF_PATCH_MODE.
 *
 * @param filePath     - The file being patched (for context display)
 * @param originalCode - The current full content of the file
 * @param instruction  - Natural language description of what to change / what error to fix
 * @param errorContext - Optional: compiler / runtime error output to guide the fix
 */
export function buildDiffPatchPrompt(
  filePath: string,
  originalCode: string,
  instruction: string,
  errorContext?: string
): string {
  const errorSection = errorContext
    ? `\nERROR / STACK TRACE TO FIX:\n\`\`\`\n${errorContext.slice(0, 2000)}\n\`\`\`\n`
    : '';

  return `FILE: ${filePath}

ORIGINAL CODE:
\`\`\`
${originalCode}
\`\`\`
${errorSection}
INSTRUCTION:
${instruction}

Emit the minimal Search/Replace diff blocks to apply this change. Follow the output format exactly.`;
}

import { sanitizeTerminalError } from './agent';

/**
 * Build a user prompt for DIFF_PATCH_MODE targeting an AUTO_FIX scenario
 * where a sandbox runner captured stderr/stdout from a failing execution.
 *
 * @param filePath     - The file that produced the error
 * @param originalCode - Current file content
 * @param stderr       - Raw stderr from the sandbox execution (will be sanitized)
 * @param stdout       - Optional stdout for additional context
 */
export function buildAutoFixPrompt(
  filePath: string,
  originalCode: string,
  stderr: string,
  stdout?: string
): string {
  const stdoutSection = stdout?.trim()
    ? `\nSTDOUT (context):\n\`\`\`\n${stdout.slice(0, 500)}\n\`\`\`\n`
    : '';

  // Sanitize stderr: keep last 100 lines / max 4000 chars to prevent token bloat
  const sanitizedStderr = sanitizeTerminalError(stderr);

  return `FILE: ${filePath}

ORIGINAL CODE:
\`\`\`
${originalCode}
\`\`\`

STDERR (runtime error to fix):
\`\`\`
${sanitizedStderr}
\`\`\`
${stdoutSection}
INSTRUCTION:
Automatically fix the runtime error shown in STDERR. Apply the minimal surgical patch.
Emit Search/Replace diff blocks only. If the error is in a dependency or environment (not the file above), output: NO_CHANGE`;
}
