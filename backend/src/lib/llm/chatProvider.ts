import OpenAI from 'openai';
import { CompletionOptions, LLMMessage, LLMProvider, ModelTurn } from './types';
import { withProviderRetry } from './providerFailure';

/** Keep provider protocol state intact; never turn reasoning-only output into code. */
export class ChatProvider implements LLMProvider {
  protected client: OpenAI | null = null;
  protected retryRequests = true;
  constructor(protected model: string, private envKeys: string[], private baseURL: string, private timeout: number) {}

  protected async prepare(_options?: CompletionOptions): Promise<void> {}

  protected getClient(): OpenAI {
    const apiKey = this.envKeys.map(key => process.env[key]).find(Boolean);
    if (!apiKey) throw new Error(`Provider is not configured (${this.envKeys[0]})`);
    return this.client ||= new OpenAI({ apiKey, baseURL: this.baseURL, timeout: this.timeout, maxRetries: 0 });
  }

  protected payload(messages: LLMMessage[], options?: CompletionOptions): any {
    return {
      model: this.model, messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 6000,
      ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
      ...(options?.tools?.length ? { tools: options.tools, tool_choice: 'auto' } : {}),
      ...(options?.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
    };
  }

  async turn(messages: LLMMessage[], options?: CompletionOptions): Promise<ModelTurn> {
    options?.signal?.throwIfAborted();
    await this.prepare(options);
    const request = () => this.getClient().chat.completions.create(this.payload(messages, options), { signal: options?.signal });
    const response = await (this.retryRequests ? withProviderRetry(request, options?.signal) : request());
    const choice = response.choices[0];
    if (!choice || choice.finish_reason === 'length' || choice.finish_reason === 'content_filter') {
      throw new Error(`Incomplete model output (${choice?.finish_reason || 'missing choice'})`);
    }
    const message = choice.message as unknown as LLMMessage;
    const toolCalls = message.tool_calls || [];
    if (!message.content?.trim() && !toolCalls.length) throw new Error('Model returned no final content or tool calls');
    return { message, text: message.content || '', toolCalls, finishReason: choice.finish_reason, usage: response.usage };
  }

  async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string> {
    const response = await this.turn(messages, options);
    if (response.toolCalls.length) throw new Error('Unexpected tool call in text-only operation');
    return response.text;
  }

  async *stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string> {
    await this.prepare(options);
    const stream = await this.getClient().chat.completions.create({ ...this.payload(messages, options), stream: true }, { signal: options?.signal }) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
    let finished = false;
    for await (const chunk of stream) {
      options?.signal?.throwIfAborted();
      const choice = chunk.choices[0];
      if (choice?.finish_reason === 'length' || choice?.finish_reason === 'content_filter') throw new Error(`Incomplete stream (${choice.finish_reason})`);
      if (choice?.finish_reason === 'stop') finished = true;
      if (choice?.delta.content) yield choice.delta.content;
    }
    if (!finished) throw new Error('Stream ended without a completion marker');
  }
}
