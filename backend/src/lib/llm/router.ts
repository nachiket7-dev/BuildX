import { LLMProvider, LLMMessage, CompletionOptions, PipelineStage, PipelineRoute } from './types';
import { GroqProvider } from './groq';
import { NvidiaProvider } from './nvidia';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';
import { CooldownStore, createDefaultCooldownStore } from './cooldownStore';

// ─── Default Model IDs ──────────────────────────────────────────────────────
export const DEFAULT_MODEL_KEY = 'gemini-3.5-flash';
const DEFAULT_MODEL = DEFAULT_MODEL_KEY;

export const GPT_OSS_FRONTEND_ID = 'gpt-oss-120b';
export const GPT_OSS_MODEL_ID = 'openai/gpt-oss-120b';

/** Primary models exposed in the UI (6 total) */
export const PRIMARY_MODEL_KEYS = [
  'gemini-3.5-flash',
  'gemini-3.1-pro',
  'qwen-3-32b',
  'gpt-oss-120b',
  'nemotron-3-550b',
  'kimi-k2.6',
  'glm-5.2',
] as const;

/** Legacy keys stored in DB / localStorage → current primary key */
export const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'llama-3.1-8b':          'gemini-3.5-flash',
  'llama-3.1-8b-instant':  'gemini-3.5-flash',
  'llama-3.3-70b':         'gemini-3.5-flash',
  'llama-3.3-70b-versatile':'gemini-3.5-flash',
  'llama3-70b-8192':       'gemini-3.5-flash',
  'llama3-8b-8192':        'gemini-3.5-flash',
  'gemini-2.5-flash':      'gemini-3.5-flash',
  'gemini-2.5-pro':        'gemini-3.1-pro',
  'gemini-3.0-flash':      'gemini-3.5-flash',
  'gemini-3.0-pro':        'gemini-3.1-pro',
  'gemini-3-flash-preview':'gemini-3.5-flash',
  'nemotron-4-340b':       'nemotron-3-super-120b',
};

// ─── Subagent Specialized Model Constants ───────────────────────────────────
export const PLANNER_MODEL = 'nemotron-3-550b';
export const PATCH_MODEL = 'kimi-k2.6';
export const INGEST_MODEL = 'glm-5.2';
export const VERIFIER_MODEL = 'gemini-3.5-flash';

// ─── Model Map ──────────────────────────────────────────────────────────────
/** Maps external model key strings to internal provider configurations. */
export const MODEL_MAP: Record<string, { provider: string; modelId: string }> = {
  // Groq (Fast & Free)
  'qwen-3-32b':           { provider: 'groq',       modelId: 'qwen/qwen3.6-27b' },
  'gpt-oss-120b':         { provider: 'groq',       modelId: GPT_OSS_MODEL_ID },

  // Google AI Studio (Primary & Ultra Fast)
  'gemini-3.5-flash':     { provider: 'gemini',     modelId: 'gemini-3.5-flash' },
  'gemini-3.1-pro':       { provider: 'gemini',     modelId: 'gemini-3.1-pro-preview' },

  // NVIDIA NIM — Nemotron 3 Ultra 550B
  'nemotron-3-550b':      { provider: 'nvidia',     modelId: 'nvidia/nemotron-3-ultra-550b-a55b' },
  'nemotron-3-ultra-550b':{ provider: 'nvidia',     modelId: 'nvidia/nemotron-3-ultra-550b-a55b' },

  // NVIDIA NIM — Nemotron 3 Super 120B (lighter; available on free NVIDIA tier)
  'nemotron-3-super-120b':{ provider: 'nvidia',     modelId: 'nvidia/nemotron-3-super-120b-a12b' },

  // OpenRouter — Moonshot Kimi K2.6 & K3 (Reasoning & Code synthesis)
  'kimi-k2.6':            { provider: 'openrouter', modelId: 'moonshotai/kimi-k2.6' },
  'kimi-k3':              { provider: 'openrouter', modelId: 'moonshotai/kimi-k3' },

  // OpenRouter — GLM 5.2 (Deep context & Ingestion)
  'glm-5.2':              { provider: 'openrouter', modelId: 'z-ai/glm-5.2' },
};

// ─── Circuit Breaker & Cooldown Tracking ────────────────────────────────────
let cooldownStore: CooldownStore = createDefaultCooldownStore();

export function configureCooldownStore(store: CooldownStore): void {
  cooldownStore = store;
}

export async function isModelCoolingDown(modelKey: string): Promise<boolean> {
  return (await cooldownStore.getExpiry(modelKey)) !== undefined;
}

export async function markModelCooldown(modelKey: string, cooldownMs = 180_000): Promise<void> {
  await cooldownStore.setExpiry(modelKey, Date.now() + cooldownMs);
  console.warn(`[LLM Circuit Breaker] Model "${modelKey}" entered ${cooldownMs / 1000}s cooldown.`);
}

export async function resetAllCooldowns(): Promise<void> {
  await cooldownStore.clear();
}

// ─── Pipeline Routes ─────────────────────────────────────────────────────────
/**
 * Defines primary + fallback + emergency model assignments per pipeline stage.
 *
 * Routing strategy (primary → fallback → emergency):
 *   PLANNING        → Gemini 3.5 Flash → Nemotron 3 Ultra 550B → Gemini 3.1 Pro
 *   INGESTION       → GLM 5.2 → Gemini 3.5 Flash → GPT-OSS 120B
 *   DIFF_GENERATION → Gemini 3.5 Flash → Kimi K2.6 → Qwen 3-32B
 *   AUTO_FIX        → Gemini 3.5 Flash → Kimi K2.6 → Qwen 3-32B
 *   CODE_GENERATION → Gemini 3.5 Flash → Kimi K2.6 → Qwen 3-32B
 *   REFINEMENT      → Gemini 3.5 Flash → Kimi K2.6 → Qwen 3-32B
 *   PREVIEW_GENERATION → Gemini 3.5 Flash → Kimi K2.6 → Qwen 3-32B
 *   SCHEMA_VERIFIER  → Gemini 3.5 Flash → Qwen 3-32B → Nemotron Super 120B
 */
export const PIPELINE_ROUTES: Record<PipelineStage, PipelineRoute> = {
  PLANNING:        { primary: 'gemini-3.5-flash', fallback: PLANNER_MODEL,     emergency: 'gemini-3.1-pro' },
  INGESTION:       { primary: INGEST_MODEL,      fallback: 'gemini-3.5-flash', emergency: 'gpt-oss-120b' },
  DIFF_GENERATION: { primary: 'gemini-3.5-flash', fallback: PATCH_MODEL,       emergency: 'qwen-3-32b' },
  AUTO_FIX:        { primary: 'gemini-3.5-flash', fallback: PATCH_MODEL,       emergency: 'qwen-3-32b' },
  CODE_GENERATION: { primary: 'gemini-3.5-flash', fallback: PATCH_MODEL,       emergency: 'qwen-3-32b' },
  REFINEMENT:      { primary: 'gemini-3.5-flash', fallback: PATCH_MODEL,       emergency: 'qwen-3-32b' },
  PREVIEW_GENERATION: { primary: 'gemini-3.5-flash', fallback: PATCH_MODEL,    emergency: 'qwen-3-32b' },
  SCHEMA_VERIFIER:  { primary: VERIFIER_MODEL,       fallback: 'qwen-3-32b',    emergency: 'nemotron-3-super-120b' },
};

// ─── Subagent Model Tiers ───────────────────────────────────────────────────

export type SubagentRole = 'PLANNER' | 'PATCH_GENERATOR' | 'SCHEMA_VERIFIER' | 'INGESTION';

export type SubagentTierRoute = PipelineRoute;

const SUBAGENT_STAGE: Record<SubagentRole, PipelineStage> = {
  INGESTION: 'INGESTION',
  PLANNER: 'PLANNING',
  PATCH_GENERATOR: 'DIFF_GENERATION',
  SCHEMA_VERIFIER: 'SCHEMA_VERIFIER',
};

/** Compatibility view for callers that still ask for a role-specific route. */
export const SUBAGENT_TIERS: Record<SubagentRole, SubagentTierRoute> = Object.fromEntries(
  Object.entries(SUBAGENT_STAGE).map(([role, stage]) => [role, PIPELINE_ROUTES[stage]])
) as Record<SubagentRole, SubagentTierRoute>;

/** Formats model identifier to a clean human-readable name for telemetry badges */
export function getFriendlyModelName(modelKey?: string): string {
  if (!modelKey) return 'Gemini 3.5 Flash';
  switch (modelKey) {
    case 'nemotron-3-550b':
    case 'nemotron-3-ultra-550b':
    case 'nvidia/nemotron-3-ultra-550b-a55b':
      return 'Nemotron 3 Ultra 550B';
    case 'nemotron-3-super-120b':
    case 'nvidia/nemotron-3-super-120b-a12b':
      return 'Nemotron 3 Super 120B';
    case 'kimi-k2.6':
    case 'moonshotai/kimi-k2.6':
      return 'Kimi K2.6 (OpenRouter)';
    case 'kimi-k3':
    case 'moonshotai/kimi-k3':
      return 'Kimi K3 (OpenRouter)';
    case 'glm-5.2':
    case 'z-ai/glm-5.2':
      return 'GLM 5.2 (OpenRouter)';
    case 'gpt-oss-120b':
    case 'openai/gpt-oss-120b':
      return 'GPT-OSS 120B';
    case 'qwen-3-32b':
    case 'qwen/qwen3.6-27b':
      return 'Qwen 3.6 27B';
    case 'gemini-3.5-flash':
      return 'Gemini 3.5 Flash';
    case 'gemini-3.1-pro':
    case 'gemini-3.1-pro-preview':
      return 'Gemini 3.1 Pro';
    default:
      return modelKey;
  }
}

// ─── Model Key Resolution ────────────────────────────────────────────────────

/** Resolve legacy aliases and validate model keys */
export function resolveModelKey(requestedModel?: string): string {
  const raw = (requestedModel || DEFAULT_MODEL).trim();
  const aliased = LEGACY_MODEL_ALIASES[raw] ?? raw;

  if (MODEL_MAP[aliased]) return aliased;

  if (aliased.includes(':')) {
    const [provider] = aliased.split(':');
    if (['groq', 'gemini', 'nvidia', 'openrouter'].includes(provider)) return aliased;
  }

  console.warn(`[LLM Router] Unknown model key "${raw}". Falling back to ${DEFAULT_MODEL_KEY}.`);
  return DEFAULT_MODEL_KEY;
}

function resolveProviderKey(requestedModel?: string): string {
  const modelKey = resolveModelKey(requestedModel);
  const config = MODEL_MAP[modelKey];
  if (config) return config.provider;
  if (modelKey.includes(':')) return modelKey.split(':')[0];
  return 'groq';
}

/** Resolve a frontend model key to the provider API model identifier. */
export function resolveModelId(requestedModel?: string): string {
  const modelKey = resolveModelKey(requestedModel);
  const config = MODEL_MAP[modelKey];
  if (config) return config.modelId;

  if (modelKey.includes(':')) {
    return modelKey.split(':').slice(1).join(':');
  }

  return MODEL_MAP[DEFAULT_MODEL_KEY].modelId;
}

export function isPremiumModel(requestedModel?: string): boolean {
  const modelKey = resolveModelKey(requestedModel);
  return modelKey === GPT_OSS_FRONTEND_ID || resolveModelId(modelKey) === GPT_OSS_MODEL_ID;
}

// ─── Provider Factory ────────────────────────────────────────────────────────

export function getLLMProvider(requestedModel?: string): LLMProvider {
  const modelKey = resolveModelKey(requestedModel);

  let provider = MODEL_MAP[DEFAULT_MODEL_KEY].provider;
  let modelId = MODEL_MAP[DEFAULT_MODEL_KEY].modelId;

  const config = MODEL_MAP[modelKey];
  if (config) {
    provider = config.provider;
    modelId = config.modelId;
  } else if (modelKey.includes(':')) {
    const parts = modelKey.split(':');
    provider = parts[0];
    modelId = parts.slice(1).join(':');
  }

  console.log(`[LLM Router] Routing request to: provider=${provider}, modelId=${modelId}`);

  switch (provider) {
    case 'groq':       return new GroqProvider(modelId);
    case 'nvidia':     return new NvidiaProvider(modelId);
    case 'gemini':     return new GeminiProvider(modelId);
    case 'openrouter': return new OpenRouterProvider(modelId);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}. Use one of: groq, gemini, nvidia, openrouter.`);
  }
}

// ─── Failover Execution Helpers ──────────────────────────────────────────────

/**
 * Completes a prompt using the preferred model followed by the stage candidates.
 * Rate-limit/capacity failures enter cooldown immediately and move to the next
 * candidate; transient transport failures receive a bounded retry.
 *
 * Logs both attempts with stage label for observability.
 */
function errorStatus(err: any): number {
  return Number(err?.status ?? err?.statusCode ?? 0);
}

function errorMessage(err: any): string {
  return String(err?.message || '').toLowerCase();
}

function isRateLimitError(err: any): boolean {
  const msg = errorMessage(err);
  return errorStatus(err) === 429 || errorStatus(err) === 413 ||
    msg.includes('rate limit') || msg.includes('too many requests') ||
    msg.includes('resourceexhausted') || msg.includes('tokens per minute') ||
    msg.includes('request too large') || msg.includes('tpm') ||
    err?.code === 'rate_limit_exceeded';
}

function isTimeoutError(err: any): boolean {
  const msg = errorMessage(err);
  return err?.name === 'APIConnectionTimeoutError' || msg.includes('timed out') || msg.includes('timeout');
}

function isFatalProviderError(err: any): boolean {
  return [401, 402, 404].includes(errorStatus(err));
}

function getRetryAfterMs(err: any, defaultMs: number): number {
  const headerValue = err?.headers?.['retry-after'] ?? err?.response?.headers?.['retry-after'];
  const headerSeconds = Number.parseFloat(String(headerValue ?? ''));
  if (Number.isFinite(headerSeconds) && headerSeconds >= 0) {
    return Math.ceil(headerSeconds + 2) * 1000;
  }

  const match = String(err?.message || '').match(/(?:try again in|retry after)\s+(\d+(?:\.\d+)?)\s*s?/i);
  if (match) return Math.ceil(Number(match[1]) + 2) * 1000;
  return defaultMs;
}

async function updateModelCooldown(modelKey: string, err: any): Promise<void> {
  if (isFatalProviderError(err)) {
    await markModelCooldown(modelKey, 300_000);
  } else if (isRateLimitError(err)) {
    // Do not immediately retry a model that has explicitly reported exhaustion.
    await markModelCooldown(modelKey, Math.min(Math.max(getRetryAfterMs(err, 60_000), 30_000), 300_000));
  } else if (isTimeoutError(err) || errorStatus(err) === 503) {
    await markModelCooldown(modelKey, 120_000);
  }
}

function candidateModels(stage: PipelineStage, preferredModel?: string): string[] {
  const route = PIPELINE_ROUTES[stage];
  const preferred = preferredModel && preferredModel !== 'pipeline'
    ? resolveModelKey(preferredModel)
    : undefined;

  const standardList = [preferred, route.primary, route.fallback, route.emergency];
  const universalSafety = ['gemini-3.5-flash', 'qwen-3-32b', 'nemotron-3-super-120b', 'gpt-oss-120b'];

  return Array.from(new Set([...standardList, ...universalSafety].filter(Boolean) as string[]));
}

type ProviderFactory = (modelKey: string) => LLMProvider;

export async function completeWithPipelineFallback(
  stage: PipelineStage,
  messages: LLMMessage[],
  options?: CompletionOptions,
  preferredModel?: string,
  providerFactory: ProviderFactory = getLLMProvider
): Promise<{ text: string; usedFallback: boolean; model: string }> {
  const candidates = candidateModels(stage, preferredModel);

  for (let i = 0; i < candidates.length; i++) {
    const modelKey = candidates[i];
    const isPrimary = i === 0;

    if (await isModelCoolingDown(modelKey)) {
      console.warn(`[Pipeline:${stage}] Model "${modelKey}" is in cooldown. Skipping to next candidate.`);
      continue;
    }

    try {
      console.log(`[Pipeline:${stage}] Attempting ${isPrimary ? 'preferred/primary' : 'fallback'} model: ${modelKey}`);
      const provider = providerFactory(modelKey);
      const text = await executeWithRetry(() => provider.complete(messages, options), modelKey, 1, 1000);
      console.log(`[Pipeline:${stage}] ${isPrimary ? 'Primary' : 'Fallback'} (${modelKey}) succeeded.`);
      return { text, usedFallback: !isPrimary, model: modelKey };
    } catch (err: any) {
      await updateModelCooldown(modelKey, err);
      const errLabel = err?.status ?? err?.statusCode ?? err?.message ?? String(err);
      console.warn(
        `[Pipeline:${stage}] Model (${modelKey}) failed [${isTimeoutError(err) ? 'TIMEOUT' : errLabel}]. ` +
        (i + 1 < candidates.length ? `Triggering next candidate: ${candidates[i + 1]}` : 'All candidates exhausted.')
      );
    }
  }

  throw new Error(`[Pipeline:${stage}] All models exhausted (${candidates.join(' -> ')}).`);
}

// ─── Subagent Failover & Exponential Backoff Execution ───────────────────────

/**
 * Exponential backoff wrapper:
 * Retries transient transport/capacity errors, but immediately moves to the next
 * candidate after a provider reports rate-limit or request-capacity exhaustion.
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  modelKey: string,
  maxRetries = 1,
  baseDelayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (isRateLimitError(err)) {
        throw err;
      }

      const isTransient = isTimeoutError(err) || errorStatus(err) >= 500;
      if (isTransient && attempt <= maxRetries) {
        const delay = Math.min(Math.pow(2, attempt - 1) * baseDelayMs, 15_000);
        console.warn(
          `[LLM Router Retry] Transient error encountered on ${modelKey}. ` +
          `Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})…`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

export interface SubagentExecutionResult {
  text: string;
  modelUsed: string;
  executionTimeMs: number;
  wasFallback: boolean;
  errorHistory?: Array<{ model: string; error: string }>;
}

export class PartialPipelineStreamError extends Error {
  readonly stage: PipelineStage;
  readonly model: string;
  readonly emittedChunks: number;
  readonly retryable = true;

  constructor(stage: PipelineStage, model: string, emittedChunks: number, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`[Pipeline:${stage}] ${model} failed after partial streaming output: ${detail}`);
    this.name = 'PartialPipelineStreamError';
    this.stage = stage;
    this.model = model;
    this.emittedChunks = emittedChunks;
  }
}

/**
 * Completes a prompt for a dedicated subagent tier (PLANNER, PATCH_GENERATOR, SCHEMA_VERIFIER).
 * Automatically applies cooldowns and bounded transient retries before moving
 * to the next candidate model.
 */
export async function completeForSubagent(
  role: SubagentRole,
  messages: LLMMessage[],
  options?: CompletionOptions,
  preferredModel?: string
): Promise<SubagentExecutionResult> {
  const preferred = preferredModel && preferredModel !== 'pipeline' ? resolveModelKey(preferredModel) : undefined;
  const stage = SUBAGENT_STAGE[role];
  const candidates = candidateModels(stage, preferred);
  const startTime = Date.now();
  const errorHistory: Array<{ model: string; error: string }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const modelKey = candidates[i];
    const isPrimary = i === 0;

    if (await isModelCoolingDown(modelKey)) {
      console.warn(`[Subagent:${role}] Model "${modelKey}" is in cooldown. Skipping to next candidate.`);
      continue;
    }

    try {
      console.log(`[Subagent:${role}] Invoking ${isPrimary ? 'primary' : 'fallback'} model: ${modelKey}`);
      const provider = getLLMProvider(modelKey);
      const text = await executeWithRetry(
        () => provider.complete(messages, options),
        modelKey,
        1,
        1000
      );

      const executionTimeMs = Date.now() - startTime;
      return {
        text,
        modelUsed: modelKey,
        executionTimeMs,
        wasFallback: !isPrimary,
        errorHistory: errorHistory.length > 0 ? errorHistory : undefined,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      errorHistory.push({ model: modelKey, error: errMsg });

      await updateModelCooldown(modelKey, err);

      const nextModel = candidates[i + 1];
      if (nextModel) {
        console.warn(
          `[LLM Router Warning] Model ${modelKey} failed for [${role}] with error: "${errMsg}". ` +
          `Triggering fallback model ${nextModel}.`
        );
      } else {
        console.error(
          `[LLM Router Error] All candidate models exhausted for [${role}]: ${candidates.join(' -> ')}. Last error: "${errMsg}".`
        );
      }
    }
  }

  throw new Error(
    `[Subagent:${role}] All candidate models failed: ${candidates.join(' -> ')}. Errors: ${JSON.stringify(errorHistory)}`
  );
}

/**
 * Streams output through the same candidate list as non-streaming calls.
 * A fallback is safe only before the first chunk has been emitted; after that
 * point the caller receives a terminal error instead of a second response.
 */
export async function* streamWithPipelineFallback(
  stage: PipelineStage,
  messages: LLMMessage[],
  options?: CompletionOptions,
  preferredModel?: string,
  providerFactory: ProviderFactory = getLLMProvider
): AsyncIterable<string> {
  const candidates = candidateModels(stage, preferredModel);
  let lastError: any;

  for (const modelKey of candidates) {
    if (await isModelCoolingDown(modelKey)) {
      console.warn(`[Pipeline:${stage}] Model "${modelKey}" is in cooldown. Skipping stream candidate.`);
      continue;
    }

    let emittedChunk = false;
    let emittedChunks = 0;
    try {
      console.log(`[Pipeline:${stage}] Attempting stream on ${modelKey}`);
      for await (const chunk of providerFactory(modelKey).stream(messages, options)) {
        emittedChunk = true;
        emittedChunks++;
        yield chunk;
      }
      return;
    } catch (err: any) {
      lastError = err;
      await updateModelCooldown(modelKey, err);
      if (emittedChunk) {
        throw new PartialPipelineStreamError(stage, modelKey, emittedChunks, err);
      }
      console.warn(`[Pipeline:${stage}] Stream candidate ${modelKey} failed before output; trying the next candidate.`);
    }
  }

  throw new Error(`[Pipeline:${stage}] All stream models exhausted: ${lastError?.message || 'unknown error'}`);
}

// ─── Token Budgets by Provider ───────────────────────────────────────────────

export function getAgentMaxTokensForModel(requestedModel?: string): number {
  const provider = resolveProviderKey(requestedModel);
  if (provider === 'gemini') return 16000;
  if (provider === 'nvidia') return 16000;
  if (provider === 'openrouter') return 12000;
  return 8000; // groq
}

export function getPipelineMaxTokens(stage: PipelineStage): number {
  switch (stage) {
    case 'PLANNING':        return 5000;
    case 'INGESTION':       return 5000;
    case 'DIFF_GENERATION': return 6000;
    case 'AUTO_FIX':        return 5000;
    case 'CODE_GENERATION': return 6000;
    case 'REFINEMENT':      return 6000;
    case 'PREVIEW_GENERATION': return 8000;
    case 'SCHEMA_VERIFIER':  return 4000;
  }
}

// ─── Provider Health ─────────────────────────────────────────────────────────

export function getProviderHealth(): Record<string, { configured: boolean; label: string }> {
  return {
    groq: {
      configured: Boolean(process.env.GROQ_API_KEY),
      label: 'Groq (Qwen 3-32B + GPT-OSS 120B)',
    },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
      label: 'Google AI Studio (Gemini 3.5 Flash + 3.1 Pro)',
    },
    nvidia: {
      configured: Boolean(process.env.NVIDIA_API_KEY),
      label: 'NVIDIA NIM (Nemotron 3 Ultra 550B + Nemotron Super)',
    },
    openrouter: {
      configured: Boolean(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY),
      label: 'OpenRouter (GLM 5.2 + Kimi K2.6 & K3)',
    },
  };
}
