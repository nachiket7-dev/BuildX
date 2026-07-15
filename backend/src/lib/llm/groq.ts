import OpenAI from 'openai';
import { LLMProvider, LLMMessage, CompletionOptions } from './types';

export class GroqProvider implements LLMProvider {
  private client: OpenAI | null = null;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error(
          'GROQ_API_KEY environment variable is not set. ' +
            'Get a free key at https://console.groq.com'
        );
      }
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 90 * 1000,
        maxRetries: 0, // We handle retries manually with backoff
      });
    }
    return this.client;
  }

  async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string> {
    const client = this.getClient();
    const completion = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat as any,
    });
    return completion.choices[0]?.message?.content || '';
  }

  async *stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string> {
    const client = this.getClient();
    const responseStream = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat as any,
      stream: true,
    });
    for await (const chunk of responseStream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}
