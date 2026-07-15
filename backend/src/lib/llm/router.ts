import { LLMProvider } from './types';
import { GroqProvider } from './groq';
import { NvidiaProvider } from './nvidia';
import { GeminiProvider } from './gemini';

// ─── Default Model IDs ──────────────────────────────────────
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
  'llama-3.1-8b': 'gemini-3.5-flash',
  'llama-3.3-70b': 'gemini-3.5-flash',
  'gemini-2.5-flash': 'gemini-3.5-flash',
  'gemini-2.5-pro': 'gemini-3.1-pro',
  'gemini-3.0-flash': 'gemini-3.5-flash',
  'gemini-3.0-pro': 'gemini-3.1-pro',
  'gemini-3-flash-preview': 'gemini-3.5-flash',
};

// Map external model key strings to internal provider configurations
export const MODEL_MAP: Record<string, { provider: string; modelId: string }> = {
  // Groq
  'qwen-3-32b': { provider: 'groq', modelId: 'qwen/qwen3-32b' },
  'gpt-oss-120b': { provider: 'groq', modelId: GPT_OSS_MODEL_ID },

  // Google AI Studio
  'gemini-3.5-flash': { provider: 'gemini', modelId: 'gemini-3.5-flash' },
  'gemini-3.1-pro':   { provider: 'gemini', modelId: 'gemini-3.1-pro-preview' },

  // NVIDIA NIM
  'nemotron-3-550b': { provider: 'nvidia', modelId: 'nvidia/nemotron-3-ultra-550b-a55b' },
};

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
    case 'groq':
      return new GroqProvider(modelId);
    case 'nvidia':
      return new NvidiaProvider(modelId);
    case 'gemini':
      return new GeminiProvider(modelId);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}. Use one of: groq, gemini, nvidia.`);
  }
}

// ─── Token Budgets by Provider ──────────────────────────────
export function getMaxTokensForModel(requestedModel?: string): number {
  const provider = resolveProviderKey(requestedModel);
  if (provider === 'gemini') return 8000;
  if (provider === 'nvidia') return 4000;
  return 5000;
}

export function getAgentMaxTokensForModel(requestedModel?: string): number {
  const provider = resolveProviderKey(requestedModel);
  // These must be large enough to contain complete file source code in the JSON response.
  // 3000 tokens (old Nemotron limit) caused guaranteed JSON truncation mid-files[].
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
      label: 'NVIDIA NIM',
    },
  };
}
