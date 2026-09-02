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
 * Named execution stages for the unified agent pipeline.
 *
 * - PLANNING        → blueprint planning and orchestration
 * - INGESTION       → source/workspace context parsing
 * - DIFF_GENERATION → surgical patch output
 * - AUTO_FIX        → error-driven self-correction
 * - CODE_GENERATION → scaffold file generation
 * - REFINEMENT      → blueprint patch/refinement
 * - PREVIEW_GENERATION → AI-enhanced HTML preview generation
 * - SCHEMA_VERIFIER → schema and output integrity verification
 */
export type PipelineStage =
  | 'PLANNING'
  | 'INGESTION'
  | 'DIFF_GENERATION'
  | 'AUTO_FIX'
  | 'CODE_GENERATION'
  | 'REFINEMENT'
  | 'PREVIEW_GENERATION'
  | 'SCHEMA_VERIFIER';

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
