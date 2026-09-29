import { ChatProvider } from './chatProvider';

export class GeminiProvider extends ChatProvider {
  constructor(model: string) { super(model, ['GEMINI_API_KEY'], 'https://generativelanguage.googleapis.com/v1beta/openai/', 120000); }
}
