import OpenAI from 'openai';
import { LLMProvider, LLMMessage, CompletionOptions } from './types';

export class OpenRouterProvider implements LLMProvider {
  private client: OpenAI | null = null;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OPENROUTER_API_KEY environment variable is not set. ' +
            'Please add OPENROUTER_API_KEY or OPEN_ROUTER_API_KEY to your backend/.env file.'
        );
      }
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 90 * 1000, // 90s timeout for deep reasoning and code generation
        maxRetries: 0,
        defaultHeaders: {
          'HTTP-Referer': 'https://buildx.dev',
          'X-Title': 'BuildX IDE Studio',
        },
      });
    }
    return this.client;
  }

  async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string> {
    const client = this.getClient();
    const completion = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens || 4000,
      response_format: options?.responseFormat as any,
    });

    const choice = completion.choices[0];
    if (!choice) return '';

    // If message.content exists, use it
    if (choice.message?.content) {
      return choice.message.content;
    }

    // For reasoning models where content might be embedded in reasoning field
    const msgAny = choice.message as any;
    if (msgAny?.reasoning) {
      console.warn(`[OpenRouter] Model ${this.model} provided response in reasoning field.`);
      return msgAny.reasoning;
    }

    if (Array.isArray(msgAny?.reasoning_details) && msgAny.reasoning_details.length > 0) {
      const combined = msgAny.reasoning_details.map((d: any) => d.text || '').filter(Boolean).join('\n');
      if (combined) {
        console.warn(`[OpenRouter] Model ${this.model} provided response in reasoning_details array.`);
        return combined;
      }
    }

    return '';
  }

  async *stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string> {
    const client = this.getClient();
    const responseStream = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens || 4000,
      stream: true,
    });

    for await (const chunk of responseStream) {
      const delta = chunk.choices[0]?.delta as any;
      if (delta?.content) {
        yield delta.content;
      } else if (delta?.reasoning) {
        // Yield reasoning as think tags if streamed
        yield `<think>${delta.reasoning}</think>`;
      }
    }
  }
}
