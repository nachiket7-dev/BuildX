import { ChatProvider } from './chatProvider';
import { prototypeModelsEnabled } from './specialists';

export class NvidiaProvider extends ChatProvider {
  constructor(model: string) { super(model, ['NVIDIA_API_KEY'], 'https://integrate.api.nvidia.com/v1', 90000); }
  protected async prepare(): Promise<void> {
    if (!prototypeModelsEnabled()) throw new Error('NVIDIA hosted endpoints require development prototype opt-in');
  }
}
