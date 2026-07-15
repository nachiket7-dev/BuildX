import { getLLMProvider, getRefineMaxTokensForModel } from './llm/router';
import { extractJSON } from './jsonExtract';
import { tryParsePartial } from './stream';
import type { Blueprint } from './types';
import { BlueprintSchema } from './types';
import { formatSQL } from './normalizeBlueprint';
import { generateMonorepoFiles } from './scaffold';

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
  const code = blueprint.code ?? { frontend: '', backend: '', sql: '' };
  const trim = (s: string | undefined, max = 200) => {
    const text = s ?? '';
    return text.length > max ? text.slice(0, max) + '... (truncated)' : text;
  };
  return {
    appName: blueprint.appName,
    description: blueprint.description,
    targetUsers: blueprint.targetUsers,
    complexity: blueprint.complexity,
    features: blueprint.features,
    schema: blueprint.schema,
    endpoints: blueprint.endpoints,
    screens: blueprint.screens,
    architecture: blueprint.architecture,
    effort: blueprint.effort,
    code: {
      frontend: trim(code.frontend),
      backend: trim(code.backend),
      sql: trim(code.sql),
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

function mergeStringArrays(orig: string[], pat: string[]): string[] {
  const res = [...orig];
  for (const p of pat) {
    if (!res.some(o => o.toLowerCase() === p.toLowerCase().trim())) {
      res.push(p);
    }
  }
  return res;
}

function applyFallbacks(partial: Record<string, unknown>, original: Blueprint): Blueprint {
  const f = (partial.features as Record<string, unknown>) ?? {};
  const a = (partial.architecture as Record<string, unknown>) ?? {};
  const effort = (partial.effort as Record<string, unknown>) ?? {};
  const code = (partial.code as Record<string, unknown>) ?? {};

  const appNameChanged = partial.appName !== undefined && String(partial.appName).trim() !== original.appName;
  const dbName = String(a.database ?? original.architecture.database).toLowerCase();
  const isMongo = dbName.includes('mongo');
  const originalIsMongo = original.architecture.database.toLowerCase().includes('mongo');
  const dbChanged = isMongo !== originalIsMongo;
  const isMajorRewrite = appNameChanged || dbChanged;

  // 1. Schema Tables/Collections Merge
  let schema: Blueprint['schema'] = [...original.schema];
  if (Array.isArray(partial.schema)) {
    const patchedSchema = (partial.schema as Array<Record<string, unknown>>).map((t) => ({
      table: String(t.table ?? t.collection ?? 'table'),
      columns: (Array.isArray(t.columns) ? t.columns : Array.isArray(t.fields) ? t.fields : []).map(
        (col: Record<string, unknown>) => ({
          name: String(col.name ?? 'column'),
          type: String(col.type ?? 'TEXT'),
          ...(col.note != null && col.note !== '' ? { note: String(col.note) } : {}),
        })
      ),
    }));

    if (isMajorRewrite) {
      schema = patchedSchema;
    } else {
      for (const patchedTable of patchedSchema) {
        const idx = schema.findIndex(t => t.table.toLowerCase() === patchedTable.table.toLowerCase());
        if (idx !== -1) {
          schema[idx] = patchedTable;
        } else {
          schema.push(patchedTable);
        }
      }
    }
  }

  // 2. Features Merge
  const features: Blueprint['features'] = isMajorRewrite
    ? {
        authentication: Array.isArray(f.authentication) ? f.authentication.map(String) : original.features.authentication,
        core: Array.isArray(f.core) ? f.core.map(String) : original.features.core,
        admin: Array.isArray(f.admin) ? f.admin.map(String) : original.features.admin,
        optional: Array.isArray(f.optional) ? f.optional.map(String) : original.features.optional,
      }
    : {
        authentication: Array.isArray(f.authentication) ? mergeStringArrays(original.features.authentication, f.authentication.map(String)) : original.features.authentication,
        core: Array.isArray(f.core) ? mergeStringArrays(original.features.core, f.core.map(String)) : original.features.core,
        admin: Array.isArray(f.admin) ? mergeStringArrays(original.features.admin, f.admin.map(String)) : original.features.admin,
        optional: Array.isArray(f.optional) ? mergeStringArrays(original.features.optional, f.optional.map(String)) : original.features.optional,
      };

  // 3. API Endpoints Merge
  let endpoints: Blueprint['endpoints'] = [...original.endpoints];
  if (Array.isArray(partial.endpoints)) {
    const patchedEndpoints = (partial.endpoints as Array<Record<string, unknown>>).map((ep) => ({
      method: safeMethod(ep.method),
      path: String(ep.path ?? '/'),
      description: String(ep.description ?? ''),
      auth: ep.auth !== undefined ? Boolean(ep.auth) : undefined,
    }));

    if (isMajorRewrite) {
      endpoints = patchedEndpoints;
    } else {
      for (const patchedEp of patchedEndpoints) {
        const idx = endpoints.findIndex(e => e.path.toLowerCase() === patchedEp.path.toLowerCase() && e.method === patchedEp.method);
        if (idx !== -1) {
          endpoints[idx] = { ...endpoints[idx], ...patchedEp };
        } else {
          endpoints.push(patchedEp as any);
        }
      }
    }
  }

  // 4. UI Screens Merge
  let screens: Blueprint['screens'] = [...original.screens];
  if (Array.isArray(partial.screens)) {
    const patchedScreens = (partial.screens as Array<Record<string, unknown>>).map((s) => ({
      name: String(s.name ?? 'Screen'),
      icon: String(s.icon ?? 'layout'),
      components: String(s.components ?? ''),
    }));

    if (isMajorRewrite) {
      screens = patchedScreens;
    } else {
      for (const patchedScreen of patchedScreens) {
        const idx = screens.findIndex(s => s.name.toLowerCase() === patchedScreen.name.toLowerCase());
        if (idx !== -1) {
          screens[idx] = patchedScreen;
        } else {
          screens.push(patchedScreen);
        }
      }
    }
  }

  const sqlRaw = unescapeString(String(code.sql ?? original.code.sql));

  const blueprint: Blueprint = {
    appName: unescapeString(String(partial.appName ?? original.appName)),
    description: unescapeString(String(partial.description ?? original.description)),
    targetUsers: unescapeString(String(partial.targetUsers ?? original.targetUsers)),
    complexity: safeComplexity(partial.complexity ?? original.complexity),
    features,
    schema,
    endpoints: endpoints.map((ep) => ({
      method: safeMethod(ep.method),
      path: String(ep.path ?? '/'),
      description: String(ep.description ?? ''),
      auth: Boolean(ep.auth),
    })),
    screens,
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
      files: (typeof code.files === 'object' && code.files !== null && !Array.isArray(code.files))
        ? { ...code.files } as Record<string, string>
        : original.code.files
        ? { ...original.code.files }
        : undefined,
    },
    effort: {
      time: String(effort.time ?? original.effort.time),
      complexity: String(effort.complexity ?? original.effort.complexity),
      cost: String(effort.cost ?? original.effort.cost),
      team: String(effort.team ?? original.effort.team),
    },
    diagrams: (partial.diagrams && typeof partial.diagrams === 'object')
      ? partial.diagrams as Blueprint['diagrams']
      : original.diagrams,
    githubUrl: original.githubUrl,
  };

  const hasDbMismatch = blueprint.code.files && (
    isMongo
      ? (!blueprint.code.files['backend/schema.js'] || blueprint.code.files['backend/prisma/schema.prisma'])
      : (!blueprint.code.files['backend/schema.sql'] || blueprint.code.files['backend/schema.js'])
  );

  if (!blueprint.code.files || isMongo !== originalIsMongo || hasDbMismatch) {
    try {
      blueprint.code.files = generateMonorepoFiles(blueprint);
    } catch {
      // ignore
    }
  }

  if (blueprint.code.files) {
    if (blueprint.code.frontend && blueprint.code.frontend.trim()) {
      blueprint.code.files['frontend/src/App.tsx'] = blueprint.code.frontend;
    }
    if (blueprint.code.backend && blueprint.code.backend.trim()) {
      blueprint.code.files['backend/src/app.ts'] = blueprint.code.backend;
    }
    if (blueprint.code.sql && blueprint.code.sql.trim()) {
      if (isMongo) {
        blueprint.code.files['backend/schema.js'] = blueprint.code.sql;
        delete blueprint.code.files['backend/schema.sql'];
        delete blueprint.code.files['backend/prisma/schema.prisma'];
      } else {
        blueprint.code.files['backend/schema.sql'] = blueprint.code.sql;
        delete blueprint.code.files['backend/schema.js'];
      }
    }
  }

  return blueprint;
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
  const provider = getLLMProvider(requestedModel);
  const maxTokens = getRefineMaxTokensForModel(requestedModel);
  const context = buildRefineContext(originalBlueprint);

  console.log(`[Refine] model=${requestedModel || 'default'} | max_tokens=${maxTokens} | request="${refinementMessage.slice(0, 100)}"`);

  const userContent = `Modification request: ${refinementMessage}

Return the updated blueprint as JSON (same keys as input).`;

  async function callLLM(temperature: number, strict = false) {
    const systemPrompt = strict
      ? `${buildSystemPrompt(context)}\n\nCRITICAL: Return compact valid JSON only. No code blocks. Maximize correctness over verbosity.`
      : buildSystemPrompt(context);

    return provider.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { temperature, maxTokens, responseFormat: { type: 'json_object' } }
    );
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
        const rawText = await callLLM(temperature, strict);
        if (!rawText) {
          throw new Error('AI returned an empty response for refinement.');
        }

        console.log(`[Refine] ${rawText.length} chars received.`);
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
          return runWithoutJsonMode(originalBlueprint, refinementMessage, context, requestedModel, maxTokens);
        }
        console.warn(`[Refine] Attempt failed (${temperature}/${strict}):`, msg);
      }
    }

    throw lastErr ?? new Error('Refinement failed. Please try again.');
  }

  return runWithRetries();
}

/** Fallback when the model rejects response_format json_object */
async function runWithoutJsonMode(
  originalBlueprint: Blueprint,
  refinementMessage: string,
  context: RefineContext,
  requestedModel: string | undefined,
  maxTokens: number
): Promise<Blueprint> {
  const provider = getLLMProvider(requestedModel);
  const systemPrompt = buildSystemPrompt(context);
  const userContent = `Modification request: ${refinementMessage}\n\nReturn the updated blueprint as JSON.`;

  for (const temperature of [0.2, 0]) {
    const rawText = await provider.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { temperature, maxTokens }
    );
    if (!rawText) continue;
    try {
      return parseRefineResponse(rawText, originalBlueprint);
    } catch (err) {
      console.warn('[Refine] Fallback parse failed:', (err as Error).message);
    }
  }

  throw new Error('AI returned malformed JSON during refinement. Please try again.');
}
