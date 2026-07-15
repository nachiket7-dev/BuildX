import type { Blueprint } from '../types';

export const CODEGEN_SYSTEM_PROMPT = `You are BuildX Codegen — an expert principal software engineer.
Your task is to write a single, complete, and production-ready source code file for an application based on its product blueprint spec.

CRITICAL RULES:
1. Output ONLY the raw source code of the requested file.
2. Absolutely NO markdown code block wrappers (no triple backticks \`\`\`), no introductory explanations, no notes.
3. Write clean, modular, and modern code with full typings (TypeScript/ES6).
4. Do not use placeholders or write "// TODO: implement later". Implement full logic, database fields, validations, and UI templates.
5. All code must compile and integrate cleanly with previously generated files.`;

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
- If this is a frontend React component, use Tailwind CSS classes for premium aesthetics. Use Lucide icons where applicable.
- Match imports exactly with previously generated files (e.g. import types from "./types" or relative paths matching the file tree).
- Handle edge cases, errors, and loading states. Use mock state logic for frontend files that simulate API requests.
- Provide clean database setup if this is database schemas or configurations.
- Write actual functional logic, not comments.

Output the content of "${filePath}" now:`;
}
