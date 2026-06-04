import { getGroqClient, resolveModel, getRefineMaxTokens } from './groq';
import { extractJSON } from './jsonExtract';
import { tryParsePartial } from './stream';
import type { Blueprint } from './types';
import { BlueprintSchema } from './types';
import { formatSQL } from './normalizeBlueprint';

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type ValidMethod = (typeof VALID_METHODS)[number];

/** Blueprint sent to the model */
type RefineContext = Blueprint;

function safeMethod(m: unknown): ValidMethod {
  if (typeof m === 'string' && VALID_METHODS.includes(m as ValidMethod)) return m as ValidMethod;
  return 'GET';
}

function safeComplexity(c: unknown): 'Low' | 'Medium' | 'High' {
  if (c === 'Low' || c === 'Medium' || c === 'High') return c;
  return 'Medium';
}

function buildRefineContext(blueprint: Blueprint): RefineContext {
  return blueprint;
}

/** Build a trimmed version of the blueprint for the system prompt to save tokens */
function buildTrimmedContext(blueprint: Blueprint): Record<string, unknown> {
  return {
    ...blueprint,
    code: {
      frontend: blueprint.code.frontend.length > 200
        ? blueprint.code.frontend.slice(0, 200) + '... (truncated)'
        : blueprint.code.frontend,
      backend: blueprint.code.backend.length > 200
        ? blueprint.code.backend.slice(0, 200) + '... (truncated)'
        : blueprint.code.backend,
      sql: blueprint.code.sql.length > 200
        ? blueprint.code.sql.slice(0, 200) + '... (truncated)'
        : blueprint.code.sql,
    },
  };
}

function unescapeString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function applyFallbacks(partial: Record<string, unknown>, original: Blueprint): Blueprint {
  const f = (partial.features as Record<string, unknown>) ?? {};
  const a = (partial.architecture as Record<string, unknown>) ?? {};
  const effort = (partial.effort as Record<string, unknown>) ?? {};
  const code = (partial.code as Record<string, unknown>) ?? {};
  const endpoints = Array.isArray(partial.endpoints) ? partial.endpoints : original.endpoints;

  const dbName = String(a.database ?? original.architecture.database).toLowerCase();
  const isMongo = dbName.includes('mongo');

  // Normalize schema: MongoDB LLMs may return {collection, fields} instead of {table, columns}
  let schema: Blueprint['schema'];
  if (Array.isArray(partial.schema)) {
    schema = (partial.schema as Array<Record<string, unknown>>).map((t) => ({
      table: String(t.table ?? t.collection ?? 'table'),
      columns: (Array.isArray(t.columns) ? t.columns : Array.isArray(t.fields) ? t.fields : []).map(
        (col: Record<string, unknown>) => ({
          name: String(col.name ?? 'column'),
          type: String(col.type ?? 'TEXT'),
          ...(col.note != null && col.note !== '' ? { note: String(col.note) } : {}),
        })
      ),
    }));
  } else {
    schema = original.schema;
  }

  const sqlRaw = unescapeString(String(code.sql ?? original.code.sql));

  return {
    appName: unescapeString(String(partial.appName ?? original.appName)),
    description: unescapeString(String(partial.description ?? original.description)),
    targetUsers: unescapeString(String(partial.targetUsers ?? original.targetUsers)),
    complexity: safeComplexity(partial.complexity ?? original.complexity),
    features: {
      authentication: Array.isArray(f.authentication)
        ? f.authentication.map(String)
        : original.features.authentication,
      core: Array.isArray(f.core) ? f.core.map(String) : original.features.core,
      admin: Array.isArray(f.admin) ? f.admin.map(String) : original.features.admin,
      optional: Array.isArray(f.optional) ? f.optional.map(String) : original.features.optional,
    },
    schema,
    endpoints: endpoints.map((ep: Record<string, unknown>) => ({
      method: safeMethod(ep.method),
      path: String(ep.path ?? '/'),
      description: String(ep.description ?? ''),
      auth: Boolean(ep.auth),
    })),
    screens: Array.isArray(partial.screens)
      ? (partial.screens as Blueprint['screens'])
      : original.screens,
    architecture: {
      frontend: String(a.frontend ?? original.architecture.frontend),
      backend: String(a.backend ?? original.architecture.backend),
      database: String(a.database ?? original.architecture.database),
      auth: String(a.auth ?? original.architecture.auth),
      hosting: String(a.hosting ?? original.architecture.hosting),
      flow: String(a.flow ?? original.architecture.flow),
    },
    code: {
      frontend: unescapeString(String(code.frontend ?? original.code.frontend)),
      backend: unescapeString(String(code.backend ?? original.code.backend)),
      sql: isMongo ? sqlRaw : formatSQL(sqlRaw),
    },
    effort: {
      time: String(effort.time ?? original.effort.time),
      complexity: String(effort.complexity ?? original.effort.complexity),
      cost: String(effort.cost ?? original.effort.cost),
      team: String(effort.team ?? original.effort.team),
    },
  };
}

function mergeRefinePatch(original: Blueprint, patch: Record<string, unknown>): Blueprint {
  const withFallbacks = applyFallbacks(patch, original);
  const result = BlueprintSchema.safeParse(withFallbacks);
  return result.success ? result.data : withFallbacks;
}

function tryParseRefineJSON(rawText: string): Record<string, unknown> {
  let rawJSON: string;
  try {
    rawJSON = extractJSON(rawText);
  } catch {
    throw new Error('AI returned no JSON object. Please try again.');
  }

  const attempts = [
    rawJSON,
    rawJSON.replace(/,\s*([\]}])/g, '$1'),
    rawJSON.replace(/[\x00-\x1F\x7F]/g, (ch) => (ch === '\n' || ch === '\t' ? ch : '')),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try next */
    }
    const partial = tryParsePartial(attempt);
    if (partial) {
      console.warn('[Refine] Recovered partial JSON from AI response');
      return partial;
    }
  }

  console.error('[Refine] JSON.parse failed:', rawJSON.slice(0, 400));
  throw new Error('AI returned malformed JSON during refinement. Please try again.');
}

function parseRefineResponse(rawText: string, originalBlueprint: Blueprint): Blueprint {
  const patch = tryParseRefineJSON(rawText);
  return mergeRefinePatch(originalBlueprint, patch);
}

function buildSystemPrompt(context: RefineContext): string {
  const trimmed = buildTrimmedContext(context);
  return `You are BuildX — an AI product architect. Modify an existing product blueprint.

CURRENT BLUEPRINT:
${JSON.stringify(trimmed)}

RULES:
1. Return ONLY a JSON object containing the keys you ACTUALLY CHANGED — this is a PATCH, not the full blueprint. Do NOT echo unchanged sections.
2. Top-level keys you may include: appName, description, targetUsers, complexity, features, schema, endpoints, screens, architecture, code, effort. Omit any key you did not change.
3. When modifying features, also include the updated schema, endpoints, screens, and the relevant code.* fields that change.
4. When changing the database stack: include architecture.database, rewrite code.sql to match the new DB technology (e.g. Mongoose schemas for MongoDB instead of SQL), and update code.backend with matching DB driver/queries.
5. Keep code fields CONCISE — return representative boilerplate, not exhaustive files. Use \\n for newlines inside JSON string values. Escape quotes as \\". Output must pass JSON.parse.
6. No markdown fences, no commentary — ONLY the JSON object. Keep the response as small as possible to avoid truncation.`;
}

/**
 * Refine an existing blueprint based on a user's natural language request.
 */
export async function refineBlueprint(
  originalBlueprint: Blueprint,
  refinementMessage: string,
  requestedModel?: string
): Promise<Blueprint> {
  const client = getGroqClient();
  const groqModel = resolveModel(requestedModel);
  const maxTokens = getRefineMaxTokens(groqModel);
  const context = buildRefineContext(originalBlueprint);

  console.log(`[Refine] model=${groqModel} | max_tokens=${maxTokens} | request="${refinementMessage.slice(0, 100)}"`);

  const userContent = `Modification request: ${refinementMessage}

Return the updated blueprint as JSON (same keys as input).`;

  async function callGroq(temperature: number, strict = false) {
    const systemPrompt = strict
      ? `${buildSystemPrompt(context)}\n\nCRITICAL: Return compact valid JSON only. No code blocks. Maximize correctness over verbosity.`
      : buildSystemPrompt(context);

    return client.chat.completions.create({
      model: groqModel,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });
  }

  async function runWithRetries(): Promise<Blueprint> {
    const attempts: Array<{ temperature: number; strict: boolean }> = [
      { temperature: 0.2, strict: false },
      { temperature: 0, strict: false },
      { temperature: 0, strict: true },
    ];

    let lastErr: Error | null = null;
    for (const { temperature, strict } of attempts) {
      try {
        const completion = await callGroq(temperature, strict);
        const rawText = completion.choices[0]?.message?.content;
        if (!rawText) {
          throw new Error('AI returned an empty response for refinement.');
        }

        const finishReason = completion.choices[0]?.finish_reason;
        console.log(`[Refine] ${rawText.length} chars received. Finish: ${finishReason}`);

        if (finishReason === 'length') {
          // Truncated output → JSON is almost certainly incomplete. Try to
          // recover a partial patch; if that fails, throw so we retry.
          console.warn('[Refine] Response truncated — hit max_tokens. Attempting partial recovery.');
          try {
            return parseRefineResponse(rawText, originalBlueprint);
          } catch {
            throw new Error('AI response was truncated (hit token limit). Retrying with tighter output.');
          }
        }

        return parseRefineResponse(rawText, originalBlueprint);
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        const msg = lastErr.message.toLowerCase();
        if (
          msg.includes('json_object') ||
          msg.includes('response_format') ||
          msg.includes('failed_generation') ||
          msg.includes('failed to generate json') ||
          (msg.includes('400') && msg.includes('json'))
        ) {
          console.warn('[Refine] JSON generation failed, falling back to non-JSON mode');
          return runWithoutJsonMode(originalBlueprint, refinementMessage, context, groqModel, maxTokens);
        }
        console.warn(`[Refine] Attempt failed (${temperature}/${strict}):`, msg);
      }
    }

    throw lastErr ?? new Error('Refinement failed. Please try again.');
  }

  return runWithRetries();
}

/** Fallback when Groq model rejects response_format json_object */
async function runWithoutJsonMode(
  originalBlueprint: Blueprint,
  refinementMessage: string,
  context: RefineContext,
  groqModel: string,
  maxTokens: number
): Promise<Blueprint> {
  const client = getGroqClient();
  const systemPrompt = buildSystemPrompt(context);
  const userContent = `Modification request: ${refinementMessage}\n\nReturn the updated blueprint as JSON.`;

  for (const temperature of [0.2, 0]) {
    const completion = await client.chat.completions.create({
      model: groqModel,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });
    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) continue;
    try {
      return parseRefineResponse(rawText, originalBlueprint);
    } catch (err) {
      console.warn('[Refine] Fallback parse failed:', (err as Error).message);
    }
  }

  throw new Error('AI returned malformed JSON during refinement. Please try again.');
}
