import OpenAI from 'openai';

let _client: OpenAI | null = null;

// ─── Model ID Mapping ─────────────────────────────────────
// Keys must EXACTLY match the `id` field in frontend AVAILABLE_MODELS
// Values must be valid Groq API model identifiers
// See: https://console.groq.com/docs/models
export const MODEL_MAPPING: Record<string, string> = {
  'llama-3.3-70b': 'llama-3.3-70b-versatile',
  'llama-3.1-8b': 'llama-3.1-8b-instant',
  'qwen-3-32b': 'qwen/qwen3-32b',
  'gpt-oss-120b': 'openai/gpt-oss-120b',
};

export const DEFAULT_MODEL = MODEL_MAPPING['llama-3.3-70b'];

/**
 * Resolve a frontend model label to its Groq API model ID.
 * Falls back to DEFAULT_MODEL and logs a warning if the key is unrecognized.
 */
export function resolveModel(requestedModel?: string): string {
  if (!requestedModel) return DEFAULT_MODEL;

  const resolved = MODEL_MAPPING[requestedModel];
  if (resolved) return resolved;

  console.warn(
    `[Groq] Unknown model key "${requestedModel}". ` +
      `Valid keys: ${Object.keys(MODEL_MAPPING).join(', ')}. Falling back to default.`
  );
  return DEFAULT_MODEL;
}

/**
 * Per-request completion-token budget for the SINGLE-SHOT generator
 * (generator.ts produces the entire blueprint in one call, so it needs
 * a large ceiling). Kept conservative to stay under Groq free-tier TPM.
 */
export function getMaxTokens(groqModel: string): number {
  if (groqModel === 'openai/gpt-oss-120b') return 6000;
  if (groqModel.includes('8b')) return 6000;
  return 5000; // llama-3.3-70b / qwen — one full blueprint per call
}

/**
 * Per-request completion-token budget for the AGENTIC orchestrator, which
 * makes ~5 sequential calls. Each agent only emits one small JSON section,
 * so a tight per-call cap keeps the TOTAL tokens-per-minute well under
 * Groq's free-tier limit and prevents "token limit exceeded" errors.
 */
export function getAgentMaxTokens(groqModel: string): number {
  if (groqModel === 'openai/gpt-oss-120b') return 3000;
  if (groqModel.includes('8b')) return 3000;
  return 4000;
}

/**
 * Per-request budget for REFINE. The model returns only a small PATCH
 * (changed keys), but DB-stack rewrites can still emit sizeable code, so
 * we give a bit more headroom than a single agent while staying TPM-safe.
 */
export function getRefineMaxTokens(groqModel: string): number {
  if (groqModel === 'openai/gpt-oss-120b') return 5000;
  if (groqModel.includes('8b')) return 5000;
  return 5000;
}

export function getGroqClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GROQ_API_KEY environment variable is not set. ' +
          'Get a free key at https://console.groq.com → API Keys, ' +
          'then add it to backend/.env: GROQ_API_KEY=gsk_...'
      );
    }
    // Groq exposes an OpenAI-compatible REST API — same SDK, different baseURL
    _client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _client;
}
