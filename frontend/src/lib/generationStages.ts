import type { AgentEvent } from "./types";

/** User-facing stages, in the order emitted by the blueprint orchestrator. */
export const GENERATION_STAGES = [
  {
    agent: "pm",
    label: "Plan",
    title: "Understanding the idea",
    output: "Requirements & features",
  },
  {
    agent: "architect",
    label: "Database",
    title: "Designing the data model",
    output: "Tables & relationships",
  },
  {
    agent: "api_dev",
    label: "API",
    title: "Connecting the endpoints",
    output: "Routes & authentication",
  },
  {
    agent: "designer",
    label: "Screens",
    title: "Shaping the experience",
    output: "Screens & components",
  },
  {
    agent: "coder",
    label: "Code",
    title: "Assembling the code",
    output: "Frontend & backend files",
  },
  {
    agent: "qa",
    label: "Review",
    title: "Reviewing consistency",
    output: "Schema & index checks",
  },
] as const;

export function agentState(events: AgentEvent[], agent: AgentEvent["agent"]) {
  const latest = [...events].reverse().find((event) => event.agent === agent);
  if (!latest || latest.status === "idle") return "waiting";
  return latest.status === "completed" ? "complete" : "active";
}
