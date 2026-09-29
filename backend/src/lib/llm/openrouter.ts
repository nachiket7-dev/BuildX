import { ChatProvider } from './chatProvider';
import { CompletionOptions, LLMMessage } from './types';
import { verifyFreeOpenRouter } from './freeEligibility';
import { prototypeModelsEnabled } from './specialists';

export class OpenRouterProvider extends ChatProvider {
  protected retryRequests = false;
  constructor(model: string) { super(model, ['OPENROUTER_API_KEY', 'OPEN_ROUTER_API_KEY'], 'https://openrouter.ai/api/v1', 45000); }

  protected async prepare(options?: CompletionOptions): Promise<void> {
    if (this.model.startsWith('nvidia/') && !prototypeModelsEnabled())
      throw new Error('NVIDIA free endpoints require development prototype opt-in');
    const key = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
    if (!key) throw new Error('OpenRouter is not configured');
    await verifyFreeOpenRouter(this.model, key, options);
  }

  protected payload(messages: LLMMessage[], options?: CompletionOptions): any {
    return { ...super.payload(messages, options),
      provider: { require_parameters: true, max_price: { prompt: 0, completion: 0 } },
    };
  }
}
