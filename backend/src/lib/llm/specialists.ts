/** Candidates are backend-only until application evaluations qualify them. */
export const SPECIALIST_MODELS: Record<string, { provider: string; modelId: string }> = {
  'north-mini-code-free': { provider: 'openrouter', modelId: 'cohere/north-mini-code:free' },
  'laguna-s-free': { provider: 'openrouter', modelId: 'poolside/laguna-s-2.1:free' },
  'laguna-xs-free': { provider: 'openrouter', modelId: 'poolside/laguna-xs-2.1:free' },
  'nemotron-super-free': { provider: 'openrouter', modelId: 'nvidia/nemotron-3-super-120b-a12b:free' },
  'nemotron-ultra-free': { provider: 'openrouter', modelId: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
};

export type AgentTaskKind = 'edit' | 'codegen' | 'blueprint';
export interface AgentRouting {
  profile: 'baseline' | 'free-specialists';
  author: string;
  fallback: string;
  reviewer: string;
  reviewerFallback: string;
  architect: string;
  maxSpecialistCalls: number;
}

export function prototypeModelsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.AGENT_ALLOW_PROTOTYPE_MODELS === 'true';
}

/** Task kind comes from the host workflow, never from model-generated text. */
export function agentRouting(kind: AgentTaskKind, fileCount: number, requested?: string,
  env: NodeJS.ProcessEnv = process.env): AgentRouting {
  const enabled = env.AGENT_MODEL_PROFILE === 'free-specialists';
  const prototype = prototypeModelsEnabled(env);
  const automatic = !requested || requested === 'pipeline';
  const author = !automatic ? requested : !enabled ? 'gemini-3.8-flash'
    : kind === 'blueprint' ? (prototype ? 'nemotron-super-free' : 'gemini-3.8-flash')
    : kind === 'edit' && fileCount <= 3 ? 'north-mini-code-free' : 'laguna-s-free';
  const alternate = author === 'gemini-3.8-flash' ? 'gemini-3.5-flash' : 'gemini-3.8-flash';
  return {
    profile: enabled ? 'free-specialists' : 'baseline', author, fallback: alternate,
    reviewer: enabled && prototype && author !== 'nemotron-super-free' ? 'nemotron-super-free' : alternate,
    reviewerFallback: alternate,
    architect: enabled && prototype ? 'nemotron-ultra-free' : alternate,
    // Includes failures and reviews; prevents one run consuming the daily free allowance.
    maxSpecialistCalls: 6,
  };
}

export function independentReviewModels(route: AgentRouting, author: string, override?: string, previousAuthors: string[] = []): string[] {
  const authors = new Set([author, ...previousAuthors]);
  if (override) {
    if (authors.has(override)) throw new Error('Independent review must use a different model from the author');
    return [override];
  }
  const candidates = [...new Set([route.reviewer, route.reviewerFallback, 'gemini-3.5-flash', 'gemini-3.8-flash', 'gpt-oss-120b'])]
    .filter(model => !authors.has(model)).slice(0, 2);
  if (!candidates.length) throw new Error('No independent reviewer remains for this run');
  return candidates;
}
