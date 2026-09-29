import { LLMProvider, LLMMessage, CompletionOptions, PipelineStage, PipelineRoute } from './types';
import { GroqProvider } from './groq';
import { NvidiaProvider } from './nvidia';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';
import { CooldownStore, createDefaultCooldownStore } from './cooldownStore';
import { isTransientProviderFailure, ProviderCapacityError, retryAfterMs } from './providerFailure';
import { SPECIALIST_MODELS, prototypeModelsEnabled } from './specialists';

// ─── Default Model IDs ──────────────────────────────────────────────────────
export const DEFAULT_MODEL_KEY = 'gemini-3.8-flash';
const DEFAULT_MODEL = DEFAULT_MODEL_KEY;

export const GPT_OSS_FRONTEND_ID = 'gpt-oss-120b';
export const GPT_OSS_MODEL_ID = 'openai/gpt-oss-120b';

/** Supported model keys, including experimental backend-only routes. */
export const PRIMARY_MODEL_KEYS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'kimi-k3',
  'glm-5.3',
  'glm-5.2',
  'nemotron-3-550b',
  'gpt-oss-120b',
] as const;

/** Legacy keys stored in DB / localStorage → current primary key */
export const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'kimi-k2.6':             'kimi-k3',
  'moonshotai/kimi-k2.6':  'kimi-k3',
  'llama-3.1-8b':          'gemini-3.5-flash',
  'llama-3.1-8b-instant':  'gemini-3.5-flash',
  'llama-3.3-70b':         'gemini-3.5-flash',
  'llama-3.3-70b-versatile':'gemini-3.5-flash',
  'llama3-70b-8192':       'gemini-3.5-flash',
  'llama3-8b-8192':        'gemini-3.5-flash',
  'gemini-2.5-flash':      'gemini-3.5-flash',
  'gemini-3.0-flash':      'gemini-3.5-flash',
  'gemini-3-flash-preview':'gemini-3.5-flash',
  'nemotron-4-340b':       'nemotron-3-super-120b',
};

// ─── Subagent Specialized Model Constants ───────────────────────────────────
export const PLANNER_MODEL = 'gemini-3.8-flash';
export const PATCH_MODEL = 'gemini-3.8-flash';
export const INGEST_MODEL = 'gemini-3.8-flash';
export const VERIFIER_MODEL = 'gemini-3.5-flash';

// ─── Model Map ──────────────────────────────────────────────────────────────
/** Maps external model key strings to internal provider configurations. */
export const MODEL_MAP: Record<string, { provider: string; modelId: string }> = {
  ...SPECIALIST_MODELS,
  // Groq (Fast & Free)
  'gpt-oss-120b':         { provider: 'groq',       modelId: GPT_OSS_MODEL_ID },

  // Google AI Studio (Primary & Ultra Fast)
  'gemini-3.8-flash':     { provider: 'gemini',     modelId: 'gemini-3.8-flash' },
  'gemini-3.5-flash':     { provider: 'gemini',     modelId: 'gemini-3.5-flash' },

  // NVIDIA NIM — Nemotron 3 Ultra 550B
  'nemotron-3-550b':      { provider: 'nvidia',     modelId: 'nvidia/nemotron-3-ultra-550b-a55b' },
  'nemotron-3-ultra-550b':{ provider: 'nvidia',     modelId: 'nvidia/nemotron-3-ultra-550b-a55b' },

  // NVIDIA NIM — Nemotron 3 Super 120B (lighter; available on free NVIDIA tier)
  'nemotron-3-super-120b':{ provider: 'nvidia',     modelId: 'nvidia/nemotron-3-super-120b-a12b' },

  // Moonshot Kimi K3 (NVIDIA NIM / OpenRouter)
  'kimi-k3':              { provider: 'nvidia',     modelId: 'moonshotai/kimi-k3' },
  'kimi-k2.6':            { provider: 'openrouter', modelId: 'moonshotai/kimi-k2.6' },

  // NVIDIA free trial endpoint. Keep opt-in until tool and latency evaluation passes.
  'glm-5.3':              { provider: 'nvidia',     modelId: 'z-ai/glm-5.3' },

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
export const PIPELINE_ROUTES: Record<PipelineStage, PipelineRoute> = {
  PLANNING: { primary: 'gemini-3.8-flash', fallback: 'gemini-3.5-flash' },
  INGESTION: { primary: 'gemini-3.8-flash', fallback: 'gemini-3.5-flash' },
  DIFF_GENERATION: { primary: 'gemini-3.8-flash', fallback: 'gemini-3.5-flash' },
  AUTO_FIX: { primary: 'gemini-3.8-flash', fallback: 'gemini-3.5-flash' },
  CODE_GENERATION: { primary: 'gemini-3.8-flash', fallback: 'gemini-3.5-flash' },
  REFINEMENT: { primary: 'gemini-3.8-flash', fallback: 'gemini-3.5-flash' },
  PREVIEW_GENERATION: { primary: 'gemini-3.8-flash', fallback: 'gemini-3.5-flash' },
  SCHEMA_VERIFIER: { primary: 'gemini-3.5-flash', fallback: 'gemini-3.8-flash' },
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
    case 'north-mini-code-free': return 'North Mini Code (free)';
    case 'laguna-s-free': return 'Laguna S 2.1 (free)';
    case 'laguna-xs-free': return 'Laguna XS 2.1 (free)';
    case 'nemotron-super-free': return 'Nemotron Super (free prototype)';
    case 'nemotron-ultra-free': return 'Nemotron Ultra (free prototype)';
    case 'gemini-3.8-flash':
      return 'Gemini 3.8 Flash';
    case 'nemotron-3-550b':
    case 'nemotron-3-ultra-550b':
    case 'nvidia/nemotron-3-ultra-550b-a55b':
      return 'Nemotron 3 Ultra 550B';
    case 'nemotron-3-super-120b':
    case 'nvidia/nemotron-3-super-120b-a12b':
      return 'Nemotron 3 Super 120B';
    case 'kimi-k3':
    case 'moonshotai/kimi-k3':
      return 'Kimi K3';
    case 'kimi-k2.6':
    case 'moonshotai/kimi-k2.6':
      return 'Kimi K2.6';
    case 'glm-5.2':
    case 'z-ai/glm-5.2':
      return 'GLM 5.2';
    case 'glm-5.3':
    case 'z-ai/glm-5.3':
      return 'GLM 5.3';
    case 'gpt-oss-120b':
    case 'openai/gpt-oss-120b':
      return 'GPT-OSS 120B';

    case 'gemini-3.5-flash':
      return 'Gemini 3.5 Flash';

    default:
      return modelKey;
  }
}

// ─── Model Key Resolution ────────────────────────────────────────────────────

/** Resolve legacy aliases and validate model keys */
export function resolveModelKey(requestedModel?: string): string {
  const raw = (!requestedModel || requestedModel === 'pipeline' ? DEFAULT_MODEL : requestedModel).trim();
  if (/qwen|gemini.*pro/i.test(raw)) throw new Error('This model has been excluded from BuildX');
  const aliased = LEGACY_MODEL_ALIASES[raw] ?? raw;

  if (MODEL_MAP[aliased]) return aliased;

  throw new Error(`Unsupported model key: ${raw}`);
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
    case 'nvidia':
      if (!prototypeModelsEnabled()) throw new Error('NVIDIA free endpoints require development prototype opt-in');
      return new NvidiaProvider(modelId);
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
  const parsed = retryAfterMs(err);
  if (parsed !== null) return parsed;
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
  const universalSafety: string[] = []; // No hidden premium or unqualified fallback models.

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
  const failures: unknown[] = [];
  const cooldowns: number[] = [];

  for (let i = 0; i < candidates.length; i++) {
    options?.signal?.throwIfAborted();
    const modelKey = candidates[i];
    const isPrimary = i === 0;

    const coolingUntil = await cooldownStore.getExpiry(modelKey);
    if (coolingUntil) {
      cooldowns.push(Math.max(0,coolingUntil-Date.now()));
      console.warn(`[Pipeline:${stage}] Model "${modelKey}" is in cooldown. Skipping to next candidate.`);
      continue;
    }

    try {
      console.log(`[Pipeline:${stage}] Attempting ${isPrimary ? 'preferred/primary' : 'fallback'} model: ${modelKey}`);
      const provider = providerFactory(modelKey);
      const text = await executeWithRetry(() => provider.complete(messages, options), modelKey, 1, 1000);
      if (!text.trim()) throw new Error('Model returned empty output');
      options?.signal?.throwIfAborted();
      console.log(`[Pipeline:${stage}] ${isPrimary ? 'Primary' : 'Fallback'} (${modelKey}) succeeded.`);
      return { text, usedFallback: !isPrimary, model: modelKey };
    } catch (err: any) {
      failures.push(err);
      options?.signal?.throwIfAborted();
      await updateModelCooldown(modelKey, err);
      const coolingUntil = await cooldownStore.getExpiry(modelKey);
      if (coolingUntil) cooldowns.push(Math.max(0,coolingUntil-Date.now()));
      const errLabel = err?.status ?? err?.statusCode ?? err?.message ?? String(err);
      console.warn(
        `[Pipeline:${stage}] Model (${modelKey}) failed [${isTimeoutError(err) ? 'TIMEOUT' : errLabel}]. ` +
        (i + 1 < candidates.length ? `Triggering next candidate: ${candidates[i + 1]}` : 'All candidates exhausted.')
      );
    }
  }

  if ((failures.length || cooldowns.length) && failures.every(isTransientProviderFailure))
    throw new ProviderCapacityError('AI models are temporarily unavailable',Math.max(0,...cooldowns,...failures.map(error=>retryAfterMs(error)??0))||null);
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
  const failures: unknown[] = [];
  const cooldowns: number[] = [];

  for (let i = 0; i < candidates.length; i++) {
    options?.signal?.throwIfAborted();
    const modelKey = candidates[i];
    const isPrimary = i === 0;

    const coolingUntil = await cooldownStore.getExpiry(modelKey);
    if (coolingUntil) {
      cooldowns.push(Math.max(0,coolingUntil-Date.now()));
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

      if (!text.trim()) throw new Error('Model returned empty output');
      const executionTimeMs = Date.now() - startTime;
      return {
        text,
        modelUsed: modelKey,
        executionTimeMs,
        wasFallback: !isPrimary,
        errorHistory: errorHistory.length > 0 ? errorHistory : undefined,
      };
    } catch (err: any) {
      failures.push(err);
      const errMsg = err?.message || String(err);
      errorHistory.push({ model: modelKey, error: errMsg });

      options?.signal?.throwIfAborted();
      await updateModelCooldown(modelKey, err);
      const coolingUntil = await cooldownStore.getExpiry(modelKey);
      if (coolingUntil) cooldowns.push(Math.max(0,coolingUntil-Date.now()));

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

  if ((failures.length || cooldowns.length) && failures.every(isTransientProviderFailure))
    throw new ProviderCapacityError('AI models are temporarily unavailable',Math.max(0,...cooldowns,...failures.map(error=>retryAfterMs(error)??0))||null);
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
      options?.signal?.throwIfAborted();
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
      label: 'Groq (GPT-OSS 120B)',
    },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
      label: 'Google AI Studio (Gemini 3.8 / 3.5 Flash)',
    },
    nvidia: {
      configured: Boolean(process.env.NVIDIA_API_KEY),
      label: 'NVIDIA NIM (Kimi K3, GLM 5.3, Nemotron)',
    },
    openrouter: {
      configured: Boolean(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY),
      label: 'OpenRouter (GLM 5.2 + Kimi K2.6 & K3)',
    },
  };
}
