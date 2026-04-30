import { z } from 'zod';

// ─── Request schema ────────────────────────────────────────
export const BlueprintRequestSchema = z.object({
  idea: z
    .string()
    .min(10, 'Idea must be at least 10 characters')
    .max(1000, 'Idea must be under 1000 characters')
    .trim(),
  model: z.string().optional(),
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
  }),
  effort: z.object({
    time: z.string(),
    complexity: z.string(),
    cost: z.string(),
    team: z.string(),
  }),
});
