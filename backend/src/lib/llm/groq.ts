import { ChatProvider } from './chatProvider';

export class GroqProvider extends ChatProvider {
  constructor(model: string) { super(model, ['GROQ_API_KEY'], 'https://api.groq.com/openai/v1', 60000); }
}
