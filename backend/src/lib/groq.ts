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
