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
}

export interface Effort {
  time: string;
  complexity: string;
  cost: string;
  team: string;
}

export interface Blueprint {
  appName: string;
  description: string;
  targetUsers: string;
  complexity: 'Low' | 'Medium' | 'High';
  features: Features;
  schema: SchemaTable[];
  endpoints: ApiEndpoint[];
  screens: UiScreen[];
  architecture: Architecture;
  code: StarterCode;
  effort: Effort;
}

// ─── Saved blueprint (with persistence metadata) ──────────
export interface SavedBlueprint extends Blueprint {
  id: string;
  idea: string;
  views: number;
  createdAt: string;
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
  | 'code'
  | 'effort';

// ─── Partial blueprint for streaming ──────────────────────
export type PartialBlueprint = Partial<Blueprint>;
