import OpenAI from 'openai';
import { LLMProvider, LLMMessage, CompletionOptions } from './types';

export class NvidiaProvider implements LLMProvider {
  private client: OpenAI | null = null;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) {
        throw new Error('NVIDIA_API_KEY is not defined in env configuration!');
      }

      // 60s timeout limit to allow frontier models (Nemotron 3 / Kimi K2.6) to generate code without premature client timeouts
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        timeout: 60_000, // 60s timeout limit
        maxRetries: 0,
      });
    }
    return this.client;
  }

  async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string> {
    const client = this.getClient();
    const payload = {
      model: this.model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
      ...(options?.responseFormat ? { response_format: options.responseFormat as any } : {}),
    };
    console.log('[Nvidia LLM Request]:', {
      model: payload.model,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      messagesCount: payload.messages.length,
      apiKeyPrefix: process.env.NVIDIA_API_KEY ? process.env.NVIDIA_API_KEY.slice(0, 10) : 'none',
      promptPreview: payload.messages[payload.messages.length - 1]?.content?.slice(0, 150)
    });
    try {
      const completion = await client.chat.completions.create(payload);
      return completion.choices[0]?.message?.content || '';
    } catch (err: any) {
      console.error('[Nvidia LLM Error]:', err.status, err.message);
      if (err.response) {
        try {
          const bodyText = await err.response.text();
          console.error('[Nvidia LLM Error Response Body]:', bodyText);
        } catch (_) {}
      }
      throw err;
    }
  }

  async *stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string> {
    const client = this.getClient();
    const responseStream = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
      ...(options?.responseFormat ? { response_format: options.responseFormat as any } : {}),
      stream: true,
    });
    for await (const chunk of responseStream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}
