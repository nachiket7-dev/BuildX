import { LLMProvider, LLMMessage, CompletionOptions, PipelineStage, PipelineRoute } from './types';
import { GroqProvider } from './groq';
import { NvidiaProvider } from './nvidia';
import { GeminiProvider } from './gemini';

// ─── Default Model IDs ──────────────────────────────────────────────────────
export const DEFAULT_MODEL_KEY = 'gemini-3.5-flash';
const DEFAULT_MODEL = DEFAULT_MODEL_KEY;

export const GPT_OSS_FRONTEND_ID = 'gpt-oss-120b';
export const GPT_OSS_MODEL_ID = 'openai/gpt-oss-120b';

/** Primary models exposed in the UI (5 total) */
export const PRIMARY_MODEL_KEYS = [
  'gemini-3.5-flash',
  'gemini-3.1-pro',
  'qwen-3-32b',
  'gpt-oss-120b',
  'nemotron-3-550b',
] as const;

/** Legacy keys stored in DB / localStorage → current primary key */
export const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'llama-3.1-8b':          'gemini-3.5-flash',
  'llama-3.3-70b':         'gemini-3.5-flash',
  'gemini-2.5-flash':      'gemini-3.5-flash',
  'gemini-2.5-pro':        'gemini-3.1-pro',
  'gemini-3.0-flash':      'gemini-3.5-flash',
  'gemini-3.0-pro':        'gemini-3.1-pro',
  'gemini-3-flash-preview':'gemini-3.5-flash',
};

// ─── Model Map ──────────────────────────────────────────────────────────────
/** Maps external model key strings to internal provider configurations. */
export const MODEL_MAP: Record<string, { provider: string; modelId: string }> = {
  // Groq
  'qwen-3-32b':      { provider: 'groq',   modelId: 'qwen/qwen3-32b' },
  'gpt-oss-120b':    { provider: 'groq',   modelId: GPT_OSS_MODEL_ID },

  // Google AI Studio
  'gemini-3.5-flash':{ provider: 'gemini', modelId: 'gemini-3.5-flash' },
  'gemini-3.1-pro':  { provider: 'gemini', modelId: 'gemini-3.1-pro-preview' },

  // NVIDIA NIM — Nemotron 3 Ultra 550B
  'nemotron-3-550b': { provider: 'nvidia', modelId: 'nvidia/nemotron-3-ultra-550b-a55b' },

  // NVIDIA NIM — Z-AI GLM-5.2 (pipeline DIFF_GENERATION primary + universal fallback)
  'glm-5.2':         { provider: 'nvidia', modelId: 'z-ai/glm-5.2' },

  // NVIDIA NIM — Moonshot Kimi K2.6 (AUTO_FIX primary + PLANNING secondary fallback)
  'kimi-k2.6':       { provider: 'nvidia', modelId: 'moonshotai/kimi-k2.6' },
};

// ─── Pipeline Routes ─────────────────────────────────────────────────────────
/**
 * Defines primary + fallback model assignments per pipeline stage.
 *
 * Routing map (per spec):
 *   PLANNING       → Nemotron 3 Ultra (primary)  | Kimi K2.6 (fallback)
 *   INGESTION      → Gemini 3.5 Flash (primary)  | GLM-5.2 (fallback)
 *   DIFF_GENERATION→ GLM-5.2 (primary)           | Gemini 3.5 Flash (fallback)
 *   AUTO_FIX       → Kimi K2.6 (primary)         | GLM-5.2 (fallback)
 */
export const PIPELINE_ROUTES: Record<PipelineStage, PipelineRoute> = {
  PLANNING:        { primary: 'nemotron-3-550b',  fallback: 'kimi-k2.6'                                   },
  INGESTION:       { primary: 'gemini-3.5-flash', fallback: 'glm-5.2'                                     },
  DIFF_GENERATION: { primary: 'glm-5.2',          fallback: 'gemini-3.5-flash'                            },
  // AUTO_FIX: Kimi K2.6 → GLM-5.2 → gemini-3.5-flash (emergency low-latency escape hatch)
  // gemini-3.5-flash added as 3rd-tier to prevent "All models exhausted" hangs when both
  // NVIDIA NIM models time out under high load.
  AUTO_FIX:        { primary: 'kimi-k2.6',        fallback: 'glm-5.2', emergency: 'gemini-3.5-flash'     },
};

// ─── Model Key Resolution ────────────────────────────────────────────────────

/** Resolve legacy aliases and validate model keys */
export function resolveModelKey(requestedModel?: string): string {
  const raw = (requestedModel || DEFAULT_MODEL).trim();
  const aliased = LEGACY_MODEL_ALIASES[raw] ?? raw;

  if (MODEL_MAP[aliased]) return aliased;

  if (aliased.includes(':')) {
    const [provider] = aliased.split(':');
    if (['groq', 'gemini', 'nvidia'].includes(provider)) return aliased;
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

/** @deprecated Use resolveModelId — kept for legacy imports */
export function resolveModel(requestedModel?: string): string {
  return resolveModelId(requestedModel);
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
    case 'groq':   return new GroqProvider(modelId);
    case 'nvidia': return new NvidiaProvider(modelId);
    case 'gemini': return new GeminiProvider(modelId);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}. Use one of: groq, gemini, nvidia.`);
  }
}

// ─── Pipeline-Stage Provider ─────────────────────────────────────────────────

/**
 * Returns the **primary** provider for a given pipeline stage,
 * ignoring the user's model selection (stages have fixed assignments).
 */
export function getPipelineProvider(stage: PipelineStage): LLMProvider {
  const route = PIPELINE_ROUTES[stage];
  return getLLMProvider(route.primary);
}

/**
 * Returns the **fallback** provider for a given pipeline stage.
 */
export function getPipelineFallbackProvider(stage: PipelineStage): LLMProvider {
  const route = PIPELINE_ROUTES[stage];
  return getLLMProvider(route.fallback);
}

// ─── Failover Execution Helpers ──────────────────────────────────────────────

/**
 * Completes a prompt using the stage-assigned primary model.
 * If the primary call throws (network error, 429, 500, timeout), automatically
 * retries once with the stage-assigned fallback model.
 *
 * Logs both attempts with stage label for observability.
 */
export async function completeWithPipelineFallback(
  stage: PipelineStage,
  messages: LLMMessage[],
  options?: CompletionOptions
): Promise<{ text: string; usedFallback: boolean; model: string }> {
  const route = PIPELINE_ROUTES[stage];
  const primaryKey   = route.primary;
  const fallbackKey  = route.fallback;
  const emergencyKey = route.emergency;

  // ── Primary attempt ──────────────────────────────────────────────────────
  try {
    console.log(`[Pipeline:${stage}] Attempting primary model: ${primaryKey}`);
    const provider = getLLMProvider(primaryKey);
    const text = await provider.complete(messages, options);
    console.log(`[Pipeline:${stage}] Primary (${primaryKey}) succeeded.`);
    return { text, usedFallback: false, model: primaryKey };
  } catch (primaryErr: any) {
    const errLabel = primaryErr?.status ?? primaryErr?.message ?? String(primaryErr);
    const isTimeout = (primaryErr?.name === 'APIConnectionTimeoutError' ||
      (primaryErr?.message || '').toLowerCase().includes('timed out') ||
      (primaryErr?.message || '').toLowerCase().includes('timeout'));
    console.warn(
      `[Pipeline:${stage}] Primary model (${primaryKey}) failed` +
      ` [${isTimeout ? 'TIMEOUT' : errLabel}]. Triggering fallback: ${fallbackKey}`
    );
  }

  // ── Fallback attempt ─────────────────────────────────────────────────────
  try {
    console.log(`[Pipeline:${stage}] Attempting fallback model: ${fallbackKey}`);
    const fallbackProvider = getLLMProvider(fallbackKey);
    const text = await fallbackProvider.complete(messages, options);
    console.log(`[Pipeline:${stage}] Fallback (${fallbackKey}) succeeded.`);
    return { text, usedFallback: true, model: fallbackKey };
  } catch (fallbackErr: any) {
    const errLabel = fallbackErr?.status ?? fallbackErr?.message ?? String(fallbackErr);
    const isTimeout = (fallbackErr?.name === 'APIConnectionTimeoutError' ||
      (fallbackErr?.message || '').toLowerCase().includes('timed out') ||
      (fallbackErr?.message || '').toLowerCase().includes('timeout'));
    console.warn(
      `[Pipeline:${stage}] Fallback model (${fallbackKey}) failed` +
      ` [${isTimeout ? 'TIMEOUT' : errLabel}].` +
      (emergencyKey ? ` Triggering emergency: ${emergencyKey}` : ' Both primary and fallback exhausted.')
    );

    // ── Emergency attempt (3rd-tier, optional per stage) ──────────────────
    if (emergencyKey) {
      try {
        console.log(`[Pipeline:${stage}] Attempting EMERGENCY model: ${emergencyKey}`);
        const emergencyProvider = getLLMProvider(emergencyKey);
        const text = await emergencyProvider.complete(messages, options);
        console.log(`[Pipeline:${stage}] Emergency (${emergencyKey}) succeeded.`);
        return { text, usedFallback: true, model: emergencyKey };
      } catch (emergencyErr: any) {
        const emergencyLabel = emergencyErr?.status ?? emergencyErr?.message ?? String(emergencyErr);
        console.error(
          `[Pipeline:${stage}] EMERGENCY model (${emergencyKey}) also failed [${emergencyLabel}]. ` +
          `All 3 models exhausted.`
        );
        throw new Error(
          `[Pipeline:${stage}] All models exhausted. ` +
          `Primary: ${primaryKey}, Fallback: ${fallbackKey}, Emergency: ${emergencyKey}. ` +
          `Last error: ${emergencyLabel}`
        );
      }
    }

    throw new Error(
      `[Pipeline:${stage}] All models exhausted. ` +
      `Primary: ${primaryKey}, Fallback: ${fallbackKey}. Last error: ${errLabel}`
    );
  }
}

/**
 * Streams output using the stage-assigned primary model.
 * If the primary stream throws during setup, falls back to `complete()` on the
 * fallback model and yields the full text as a single chunk.
 *
 * Note: mid-stream failures are NOT retried (partial output already flushed).
 */
export async function* streamWithPipelineFallback(
  stage: PipelineStage,
  messages: LLMMessage[],
  options?: CompletionOptions
): AsyncIterable<string> {
  const route = PIPELINE_ROUTES[stage];
  const primaryKey   = route.primary;
  const fallbackKey  = route.fallback;
  const emergencyKey = route.emergency;

  // ── Try streaming from primary ───────────────────────────────────────────
  try {
    console.log(`[Pipeline:${stage}] Attempting streaming from primary: ${primaryKey}`);
    const provider = getLLMProvider(primaryKey);
    // Eagerly resolve the stream before yielding to detect setup errors
    const iter = provider.stream(messages, options);
    // Yield chunks — if it throws mid-stream that's a partial-output failure
    // which we cannot safely recover from (consumer may have already received data)
    for await (const chunk of iter) {
      yield chunk;
    }
    console.log(`[Pipeline:${stage}] Primary stream (${primaryKey}) completed.`);
    return;
  } catch (primaryErr: any) {
    const errLabel = primaryErr?.status ?? primaryErr?.message ?? String(primaryErr);
    const isTimeout = (primaryErr?.name === 'APIConnectionTimeoutError' ||
      (primaryErr?.message || '').toLowerCase().includes('timed out') ||
      (primaryErr?.message || '').toLowerCase().includes('timeout'));
    console.warn(
      `[Pipeline:${stage}] Primary stream (${primaryKey}) failed at setup` +
      ` [${isTimeout ? 'TIMEOUT' : errLabel}]. Falling back to complete() on ${fallbackKey}`
    );
  }

  // ── Fallback: complete() on secondary, yield as single chunk ────────────
  try {
    console.log(`[Pipeline:${stage}] Fallback complete() on: ${fallbackKey}`);
    const fallbackProvider = getLLMProvider(fallbackKey);
    const text = await fallbackProvider.complete(messages, options);
    console.log(`[Pipeline:${stage}] Fallback (${fallbackKey}) succeeded.`);
    yield text;
    return;
  } catch (fallbackErr: any) {
    const errLabel = fallbackErr?.status ?? fallbackErr?.message ?? String(fallbackErr);
    const isTimeout = (fallbackErr?.name === 'APIConnectionTimeoutError' ||
      (fallbackErr?.message || '').toLowerCase().includes('timed out') ||
      (fallbackErr?.message || '').toLowerCase().includes('timeout'));
    console.warn(
      `[Pipeline:${stage}] Fallback (${fallbackKey}) failed` +
      ` [${isTimeout ? 'TIMEOUT' : errLabel}].` +
      (emergencyKey ? ` Attempting emergency: ${emergencyKey}` : ' Both models exhausted.')
    );

    // ── Emergency: 3rd-tier complete(), yield as single chunk ───────────
    if (emergencyKey) {
      try {
        console.log(`[Pipeline:${stage}] EMERGENCY complete() on: ${emergencyKey}`);
        const emergencyProvider = getLLMProvider(emergencyKey);
        const text = await emergencyProvider.complete(messages, options);
        console.log(`[Pipeline:${stage}] Emergency (${emergencyKey}) succeeded.`);
        yield text;
        return;
      } catch (emergencyErr: any) {
        const emergencyLabel = emergencyErr?.status ?? emergencyErr?.message ?? String(emergencyErr);
        console.error(`[Pipeline:${stage}] Emergency (${emergencyKey}) also failed [${emergencyLabel}].`);
        throw new Error(
          `[Pipeline:${stage}] All models exhausted (stream path). ` +
          `Primary: ${primaryKey}, Fallback: ${fallbackKey}, Emergency: ${emergencyKey}. ` +
          `Last error: ${emergencyLabel}`
        );
      }
    }

    throw new Error(
      `[Pipeline:${stage}] All models exhausted (stream path). ` +
      `Primary: ${primaryKey}, Fallback: ${fallbackKey}. Last error: ${errLabel}`
    );
  }
}

// ─── Token Budgets by Provider ───────────────────────────────────────────────

export function getMaxTokensForModel(requestedModel?: string): number {
  const provider = resolveProviderKey(requestedModel);
  if (provider === 'gemini') return 8000;
  if (provider === 'nvidia') return 4000;
  return 5000;
}

export function getAgentMaxTokensForModel(requestedModel?: string): number {
  const provider = resolveProviderKey(requestedModel);
  if (provider === 'gemini') return 16000;
  if (provider === 'nvidia') return 16000;
  return 8000; // groq
}

export function getRefineMaxTokensForModel(requestedModel?: string): number {
  const provider = resolveProviderKey(requestedModel);
  if (provider === 'gemini') return 6000;
  if (provider === 'nvidia') return 4000;
  return 5000;
}

/** Token budget for pipeline stages (stage-specific, not user-model-specific). */
export function getPipelineMaxTokens(stage: PipelineStage): number {
  switch (stage) {
    case 'PLANNING':        return 8000;  // Nemotron 550B — large reasoning budget
    case 'INGESTION':       return 8000;  // Gemini Flash — fast + generous context
    case 'DIFF_GENERATION': return 4096;  // GLM-5.2 — surgical patches, shorter output
    case 'AUTO_FIX':        return 8192;  // Kimi K2.6 — code-repair focused, large context
  }
}

// ─── Provider Health ─────────────────────────────────────────────────────────

export function getProviderHealth(): Record<string, { configured: boolean; label: string }> {
  return {
    groq: {
      configured: Boolean(process.env.GROQ_API_KEY),
      label: 'Groq',
    },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
      label: 'Google AI Studio',
    },
    nvidia: {
      configured: Boolean(process.env.NVIDIA_API_KEY),
      label: 'NVIDIA NIM (Nemotron + GLM-5.2 + Kimi K2.6)',
    },
  };
}
