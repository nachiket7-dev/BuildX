import { Blueprint, BlueprintSchema, StackSpec } from "../types";
import type { AgenticEventSink } from "../orchestrator";
import { AgentOptions, runEngineeringAgent } from "./engine";
import { revision, validateFile } from "./validation";

/** Structured specification work uses the same inspect/act/review loop as code work. */
export async function buildBlueprint(
  idea: string,
  model: string | undefined,
  stack: StackSpec,
  sink: AgenticEventSink,
  signal?: AbortSignal,
  existing?: Blueprint,
  call?: AgentOptions["call"],
  recovery?: Pick<AgentOptions, "resume" | "checkpoint">,
): Promise<Blueprint> {
  const selected = {
    framework: stack?.framework || "express",
    db: stack?.db || "postgres",
    auth: stack?.auth || "jwt",
  };
  const template: Blueprint = {
    stack: selected,
    appName: "Application",
    description: "Describe the application",
    targetUsers: "Identify users",
    complexity: "Medium",
    features: { authentication: [], core: [], admin: [], optional: [] },
    schema: [],
    endpoints: [],
    screens: [],
    architecture: {
      frontend:
        selected.framework === "next" ? "Next.js App Router" : "React + Vite",
      backend: selected.framework === "fastify" ? "Fastify" : "Express",
      database: selected.db,
      auth: selected.auth,
      hosting: "Specify deployment",
      flow: "Specify request flow",
    },
    code: { frontend: "", backend: "", sql: "" },
    effort: {
      time: "Estimate",
      complexity: "Explain",
      cost: "Estimate",
      team: "Estimate",
    },
  };
  const combined = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(8 * 60_000)])
    : AbortSignal.timeout(8 * 60_000);
  sink.status?.("Designing and checking the application blueprint");
  sink.progress?.(5);
  const result = await runEngineeringAgent(
    `Design a complete blueprint for: ${idea}. Edit only blueprint.json. Its current structure is the required output contract. ${existing ? "Refine the existing specification, preserve unrelated features and code, and only change stack choices when the user asks." : "Preserve selected stack " + JSON.stringify(selected) + "."} Add concrete features, relational schema with columns, endpoints with auth requirements, screens, architecture, small syntactically valid starter snippets, effort estimates and optional Mermaid diagrams. No placeholders. This is specification work, not a claim of a built application. Use run_check with kind typecheck and project . to validate the blueprint contract. Resolve diagnostics and request independent review.`,
    [
      {
        path: "blueprint.json",
        content: JSON.stringify(existing || template, null, 2),
      },
    ],
    {
      ...recovery,
      taskKind: 'blueprint',
      model,
      call,
      signal: combined,
      check: async (files, kind) => {
        const errors: string[] = [];
        try {
          const blueprint = BlueprintSchema.parse(
            JSON.parse(files["blueprint.json"]),
          );
          if (
            !existing &&
            (blueprint.stack?.framework !== selected.framework ||
              blueprint.stack?.db !== selected.db ||
              blueprint.stack?.auth !== selected.auth)
          )
            errors.push("Selected stack must be preserved exactly");
          if (
            !blueprint.features.core.length ||
            !blueprint.schema.length ||
            !blueprint.endpoints.length ||
            !blueprint.screens.length
          )
            errors.push(
              "Core features, schema, endpoints and screens must be populated",
            );
          errors.push(
            ...validateFile("App.tsx", blueprint.code.frontend),
            ...validateFile("app.ts", blueprint.code.backend),
          );
          if (Object.keys(files).some((path) => path !== "blueprint.json"))
            errors.push("Only blueprint.json is part of this workflow");
        } catch (error) {
          errors.push(String(error));
        }
        return {
          kind,
          revision: revision(files),
          status: errors.length ? "failed" : "passed",
          output: errors.length
            ? errors.join("\n")
            : "Blueprint schema and starter syntax passed. No application build or runtime was executed.",
        };
      },
    },
    (event, data) => {
      if (event === "thinking") sink.status?.(data.step);
      if (event === "agent_plan")
        sink.agentEvent?.({
          agent: "pm",
          status: "thinking",
          log: data.plan.join(" → "),
        });
      if (event === "validation") sink.status?.(data.output);
    },
  );
  const output = result.stagedDiffs["blueprint.json"]?.modified;
  if (!output) throw new Error("Agent did not produce a blueprint");
  const blueprint = BlueprintSchema.parse(JSON.parse(output)) as Blueprint;
  for (const [key, value] of Object.entries(blueprint))
    sink.section?.(key, value);
  sink.progress?.(100);
  sink.complete?.(blueprint);
  return blueprint;
}
