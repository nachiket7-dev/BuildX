import OpenAI from 'openai';
import { LLMProvider, LLMMessage, CompletionOptions } from './types';

export class GeminiProvider implements LLMProvider {
  private client: OpenAI | null = null;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'GEMINI_API_KEY environment variable is not set. ' +
            'Get a free key from Google AI Studio: https://aistudio.google.com/app/apikey'
        );
      }
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        timeout: 5 * 60 * 1000, // 5 minutes — large codegen files (8k+ tokens) can take 45-90s
        maxRetries: 0,           // Retries managed manually in completeWithRetry
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
      stream: true,
    });
    for await (const chunk of responseStream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}
