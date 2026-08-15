// ─── Base message / completion types ────────────────────────────────────────

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

// ─── Multi-Model Pipeline types ─────────────────────────────────────────────

/**
 * Named execution stages for the dual-pipeline architecture.
 *
 * - PLANNING       → fast context synthesis (Gemini 3.5 Flash primary)
 * - INGESTION      → fast context parsing (Gemini 3.5 Flash primary)
 * - DIFF_GENERATION→ surgical patch output (GLM-5.2 primary)
 * - AUTO_FIX       → error-driven self-correction (Kimi K2.6 primary)
 */
export type PipelineStage = 'PLANNING' | 'INGESTION' | 'DIFF_GENERATION' | 'AUTO_FIX';

/**
 * A primary+fallback model pair for a pipeline stage.
 * Both fields are internal model keys as they appear in MODEL_MAP.
 * `emergency` is an optional third-tier model used when both primary and fallback
 * have exhausted all retries (e.g. gemini-3.5-flash as a low-latency escape hatch).
 */
export interface PipelineRoute {
  primary: string;    // internal model key (e.g. 'nemotron-3-550b')
  fallback: string;   // internal model key (e.g. 'glm-5.2')
  emergency?: string; // optional 3rd-tier escape hatch (e.g. 'gemini-3.5-flash')
}

/**
 * Extended completion options that carry an optional pipeline stage hint.
 * When `stage` is provided and callers use `completeWithPipelineFallback`,
 * the stage-level routing and failover logic kicks in automatically.
 */
export interface PipelineCompletionOptions extends CompletionOptions {
  /** If set, the router uses the stage-specific primary model. */
  stage?: PipelineStage;
}
