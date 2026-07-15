export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' };
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string>;
  stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string>;
}
