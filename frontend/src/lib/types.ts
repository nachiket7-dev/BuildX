export interface SchemaColumn {
  name: string;
  type: string;
  note?: string;
}

export interface SchemaTable {
  table: string;
  columns: SchemaColumn[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description: string;
  auth?: boolean;
}

export interface UiScreen {
  name: string;
  icon: string;
  components: string;
}

export interface Features {
  authentication: string[];
  core: string[];
  admin: string[];
  optional: string[];
}

export interface Architecture {
  frontend: string;
  backend: string;
  database: string;
  auth: string;
  hosting: string;
  flow: string;
}

export interface StarterCode {
  frontend: string;
  backend: string;
  sql: string;
  files?: Record<string, string>;
}

export interface Effort {
  time: string;
  complexity: string;
  cost: string;
  team: string;
}

export interface BlueprintDiagrams {
  er?: string;
  arch?: string;
  apiFlow?: string;
}

export interface StackSpec {
  framework: 'next' | 'express' | 'fastify';
  db: 'postgres' | 'supabase' | 'mongo';
  auth: 'jwt' | 'clerk' | 'nextauth';
}

export type ProductArchetype =
  | 'B2C_STOREFRONT'
  | 'B2C_MOBILE_FEED'
  | 'B2B_SAAS_WORKSPACE'
  | 'DEVTOOL_CONSOLE'
  | 'TWO_SIDED_MARKETPLACE'
  | 'CREATOR_PORTAL';

export type LayoutParadigm =
  | 'TOP_NAV_STOREFRONT'
  | 'LEFT_SIDEBAR_DASHBOARD'
  | 'MOBILE_EMULATOR_SHELL'
  | 'FULLSCREEN_CANVAS'
  | 'SPLIT_CONSOLE';

export interface Blueprint {
  appName: string;
  description: string;
  targetUsers: string;
  complexity: 'Low' | 'Medium' | 'High';
  features: Features;
  schema: SchemaTable[];
  endpoints: ApiEndpoint[];
  screens: UiScreen[];
  productArchetype?: ProductArchetype;
  layoutParadigm?: LayoutParadigm;
  primaryLandingScreenId?: string;
  architecture: Architecture;
  code: StarterCode;
  effort: Effort;
  diagrams?: BlueprintDiagrams;
  githubUrl?: string;
  modelUsed?: string;
  title?: string;
  category?: string;
  suggestedRefinements?: string[];
}

// ─── Multi-Model Execution Pipeline Types ─────────────────────
export type PipelineStage =
  | 'PLANNING'
  | 'INGESTION'
  | 'DIFF_GENERATION'
  | 'AUTO_FIX'
  | 'CODE_GENERATION'
  | 'REFINEMENT'
  | 'PREVIEW_GENERATION'
  | 'SCHEMA_VERIFIER';

export interface ModelExecutionMetadata {
  stage: PipelineStage;
  modelName: string;
  isFallback: boolean;
  reasoningText?: string;
}

export interface PipelineStageEvent {
  stage: PipelineStage;
  state: 'start' | 'completed' | 'fallback';
  detail?: string;
}

export interface PipelineErrorEvent {
  stage: PipelineStage;
  model?: string;
  message: string;
  partial: boolean;
  retryable: boolean;
  failedPath?: string;
}

export interface PatchApplyEvent {
  path: string;
  applied: number;
  failedCount: number;
}

export interface AgentEvent {
  agent: 'pm' | 'architect' | 'api_dev' | 'designer' | 'coder' | 'qa';
  status: 'idle' | 'thinking' | 'writing' | 'correcting' | 'completed';
  log?: string;
  message?: string;
  timestamp: string;
  stage?: PipelineStage;
}

// ─── Saved blueprint (with persistence metadata) ──────────
export interface SavedBlueprint extends Blueprint {
  id: string;
  idea: string;
  views: number;
  createdAt: string;
  isPublic?: boolean;
  isOwner?: boolean;
}

export interface BlueprintListItem {
  id: string;
  idea: string;
  appName: string;
  description: string;
  complexity: string;
  createdAt: string;
  views: number;
  endpointsCount?: number;
  schemaCount?: number;
  screensCount?: number;
  productArchetype?: string;
  isPublic?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  id?: string;
}

export interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}

export type TabId =
  | 'features'
  | 'schema'
  | 'api'
  | 'ui'
  | 'architecture'
  | 'diagrams'
  | 'effort';

// ─── Partial blueprint for streaming ──────────────────────
export type PartialBlueprint = Partial<Blueprint>;
