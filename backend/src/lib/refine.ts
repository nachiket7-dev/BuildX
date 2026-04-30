import { getGroqClient, resolveModel } from './groq';
import type { Blueprint } from './types';
import { BlueprintSchema } from './types';

/**
 * Strip reasoning model <think>...</think> blocks and extract the JSON object.
 */
function extractJSON(raw: string): string {
  // Remove <think>...</think> blocks (reasoning models like GPT-OSS 120B, Qwen 3)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');

  cleaned = cleaned
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No valid JSON found in AI refinement response.');
  }
  return cleaned.slice(start, end + 1);
}

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type ValidMethod = (typeof VALID_METHODS)[number];

function safeMethod(m: unknown): ValidMethod {
  if (typeof m === 'string' && VALID_METHODS.includes(m as ValidMethod)) return m as ValidMethod;
  return 'GET';
}

function safeComplexity(c: unknown): 'Low' | 'Medium' | 'High' {
  if (c === 'Low' || c === 'Medium' || c === 'High') return c;
  return 'Medium';
}

function applyFallbacks(partial: Record<string, unknown>): Blueprint {
  const f = (partial.features as Record<string, unknown>) ?? {};
  const a = (partial.architecture as Record<string, unknown>) ?? {};
  const code = (partial.code as Record<string, unknown>) ?? {};
  const effort = (partial.effort as Record<string, unknown>) ?? {};
  const endpoints = Array.isArray(partial.endpoints) ? partial.endpoints : [];

  return {
    appName: String(partial.appName ?? 'Untitled App'),
    description: String(partial.description ?? 'No description.'),
    targetUsers: String(partial.targetUsers ?? 'General users'),
    complexity: safeComplexity(partial.complexity),
    features: {
      authentication: Array.isArray(f.authentication) ? f.authentication.map(String) : [],
      core: Array.isArray(f.core) ? f.core.map(String) : [],
      admin: Array.isArray(f.admin) ? f.admin.map(String) : [],
      optional: Array.isArray(f.optional) ? f.optional.map(String) : [],
    },
    schema: Array.isArray(partial.schema) ? (partial.schema as Blueprint['schema']) : [],
    endpoints: endpoints.map((ep: Record<string, unknown>) => ({
      method: safeMethod(ep.method),
      path: String(ep.path ?? '/'),
      description: String(ep.description ?? ''),
      auth: Boolean(ep.auth),
    })),
    screens: Array.isArray(partial.screens) ? (partial.screens as Blueprint['screens']) : [],
    architecture: {
      frontend: String(a.frontend ?? 'React'),
      backend: String(a.backend ?? 'Node.js + Express'),
      database: String(a.database ?? 'PostgreSQL'),
      auth: String(a.auth ?? 'JWT'),
      hosting: String(a.hosting ?? 'Vercel + Railway'),
      flow: String(a.flow ?? 'Frontend → API → Database'),
    },
    code: {
      frontend: String(code.frontend ?? '// Frontend code'),
      backend: String(code.backend ?? '// Backend code'),
      sql: String(code.sql ?? '-- SQL'),
    },
    effort: {
      time: String(effort.time ?? 'TBD'),
      complexity: String(effort.complexity ?? 'Medium'),
      cost: String(effort.cost ?? 'TBD'),
      team: String(effort.team ?? '2-3 developers'),
    },
  };
}

/**
 * Refine an existing blueprint based on a user's natural language request.
 * The current blueprint is included as context so the AI can make targeted modifications.
 */
export async function refineBlueprint(
  originalBlueprint: Blueprint,
  refinementMessage: string,
  requestedModel?: string
): Promise<Blueprint> {
  const client = getGroqClient();
  const groqModel = resolveModel(requestedModel);

  console.log(`[Refine] model=${groqModel} | request="${refinementMessage.slice(0, 100)}"`);

  const systemPrompt = `You are BuildX — an AI product architect. You have previously generated a product blueprint.
The user wants to MODIFY this blueprint based on their new request.

CURRENT BLUEPRINT:
${JSON.stringify(originalBlueprint, null, 2)}

RULES:
1. Return ONLY a complete, valid JSON object with the SAME shape as the current blueprint
2. Apply the user's requested changes while preserving everything else
3. If the user asks to add a feature, add it to the appropriate section AND update schema/endpoints/screens as needed
4. If the user asks to change the tech stack, update architecture AND regenerate relevant code
5. Keep all existing data unless the user specifically asks to remove/change it
6. No markdown fences, no explanation — ONLY the JSON object
7. Escape internal quotes as \\"
8. Use \\n for newlines in code strings`;

  const completion = await client.chat.completions.create({
    model: groqModel,
    max_tokens: 4500,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Modification request: ${refinementMessage}\n\nReturn the COMPLETE updated blueprint as JSON. Keep unchanged sections as-is.`,
      },
    ],
  });

  const rawText = completion.choices[0]?.message?.content;
  if (!rawText) {
    throw new Error('AI returned an empty response for refinement.');
  }

  console.log(`[Refine] ${rawText.length} chars received.`);

  const rawJSON = extractJSON(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJSON);
  } catch {
    console.error('[Refine] JSON.parse failed:', rawJSON.slice(0, 300));
    throw new Error('AI returned malformed JSON during refinement. Please try again.');
  }

  const result = BlueprintSchema.safeParse(parsed);
  if (!result.success) {
    console.warn('[Refine] Zod issues (using fallbacks):', result.error.issues.slice(0, 5));
    return applyFallbacks(parsed as Record<string, unknown>);
  }

  return result.data;
}
