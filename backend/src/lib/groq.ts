import OpenAI from 'openai';

let _client: OpenAI | null = null;

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
