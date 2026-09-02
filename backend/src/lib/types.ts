import { z } from 'zod';

// ─── Request schema ────────────────────────────────────────
export const StackSpecSchema = z.object({
  framework: z.enum(['next', 'express', 'fastify']).optional(),
  db: z.enum(['postgres', 'supabase', 'mongo']).optional(),
  auth: z.enum(['jwt', 'clerk', 'nextauth']).optional(),
}).optional();

export type StackSpec = z.infer<typeof StackSpecSchema>;

export const BlueprintRequestSchema = z.object({
  idea: z
    .string()
    .min(10, 'Idea must be at least 10 characters')
    .max(1000, 'Idea must be under 1000 characters')
    .trim(),
  model: z.string().optional(),
  stack: StackSpecSchema,
});

export type BlueprintRequest = z.infer<typeof BlueprintRequestSchema>;

// ─── Response types ────────────────────────────────────────
export interface SchemaColumn {
  name: string;
  type: string;
  note?: string;
}

export interface SchemaTable {
  table: string;
  columns: SchemaColumn[];
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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
}

// ─── Saved blueprint (with persistence metadata) ──────────
export interface SavedBlueprint extends Blueprint {
  id: string;
  idea: string;
  views: number;
  createdAt: string;
}

// ─── Zod schema for validating AI output ──────────────────
export const BlueprintSchema = z.object({
  appName: z.string().min(1),
  description: z.string().min(1),
  targetUsers: z.string().min(1),
  complexity: z.enum(['Low', 'Medium', 'High']),
  features: z.object({
    authentication: z.array(z.string()),
    core: z.array(z.string()),
    admin: z.array(z.string()),
    optional: z.array(z.string()),
  }),
  schema: z.array(
    z.object({
      table: z.string(),
      columns: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          note: z.string().optional(),
        })
      ),
    })
  ),
  endpoints: z.array(
    z.object({
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      path: z.string(),
      description: z.string(),
      auth: z.boolean().optional(),
    })
  ),
  screens: z.array(
    z.object({
      name: z.string(),
      icon: z.string(),
      components: z.string(),
    })
  ),
  productArchetype: z.enum([
    'B2C_STOREFRONT', 'B2C_MOBILE_FEED', 'B2B_SAAS_WORKSPACE',
    'DEVTOOL_CONSOLE', 'TWO_SIDED_MARKETPLACE', 'CREATOR_PORTAL',
  ]).optional(),
  layoutParadigm: z.enum([
    'TOP_NAV_STOREFRONT', 'LEFT_SIDEBAR_DASHBOARD', 'MOBILE_EMULATOR_SHELL',
    'FULLSCREEN_CANVAS', 'SPLIT_CONSOLE',
  ]).optional(),
  primaryLandingScreenId: z.string().optional(),
  architecture: z.object({
    frontend: z.string(),
    backend: z.string(),
    database: z.string(),
    auth: z.string(),
    hosting: z.string(),
    flow: z.string(),
  }),
  code: z.object({
    frontend: z.string(),
    backend: z.string(),
    sql: z.string(),
    files: z.record(z.string()).optional(),
  }),
  effort: z.object({
    time: z.string(),
    complexity: z.string(),
    cost: z.string(),
    team: z.string(),
  }),
  diagrams: z.object({
    er: z.string().optional(),
    arch: z.string().optional(),
    apiFlow: z.string().optional(),
  }).optional(),
  githubUrl: z.string().optional(),
  modelUsed: z.string().optional(),
});

// ─── Subagent Pipeline Contracts ──────────────────────────

export const PlannerOutputSchema = z.object({
  plan: z.array(z.string()),
  targetFiles: z.array(z.string()),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

export const PatchFileSchema = z.object({
  filePath: z.string(),
  content: z.string(),
});
export type PatchFile = z.infer<typeof PatchFileSchema>;

export const PatchGeneratorOutputSchema = z.array(PatchFileSchema);
export type PatchGeneratorOutput = z.infer<typeof PatchGeneratorOutputSchema>;

export type SubagentStreamEvent =
  | { type: 'agent_plan'; data: { plan: string[]; targetFiles: string[] } }
  | { type: 'agent_patch'; data: { filePath: string; content: string } }
  | { type: 'agent_complete'; data: { success: boolean; modifiedFiles: string[]; message?: string } }
  | { type: 'file_patch'; data: { filePath: string; content: string } };
