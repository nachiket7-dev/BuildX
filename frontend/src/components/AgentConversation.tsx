import { Loader2, ChevronRight, Cpu } from "./ui/icons";

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
  thinkingSteps?: string[];
  model?: string;
  error?: boolean;
  telemetry?: {
    planner?: {
      modelUsed: string;
      executionTimeMs?: number;
      wasFallback?: boolean;
    };
    patches?: Array<{
      filePath: string;
      modelUsed: string;
      executionTimeMs?: number;
      wasFallback?: boolean;
    }>;
  };
}
const modelNames: Record<string, string> = {
  "pipeline": "Auto",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "nemotron-3-550b": "Nemotron 3 Ultra",
  "nemotron-3-ultra-550b": "Nemotron 3 Ultra",
  "nemotron-3-super-120b": "Nemotron 3 Super",
  "kimi-k3": "Kimi K3",
  "kimi-k2.6": "Kimi K2.6",
  "glm-5.2": "GLM 5.2",
  "glm-5.3": "GLM 5.3",
};
function modelName(key: string) {
  return modelNames[key] || key.split("/").pop() || key;
}
const stages: Record<string, string> = {
  INGESTION: "Reading the workspace",
  PLANNING: "Planning the changes",
  DIFF_GENERATION: "Preparing changes",
  SCHEMA_VERIFIER: "Checking changes",
};

export function AgentMessage({ message }: { message: AgentChatMessage }) {
  const { role, content, telemetry, thinkingSteps = [] } = message;
  const hasDetails = Boolean(
    thinkingSteps.length || telemetry?.planner || telemetry?.patches?.length,
  );
  const longRequest =
    role === "user" && (content.length > 550 || content.split("\n").length > 7);
  return (
    <article
      className={`agent-message agent-message--${role}${message.error ? " agent-message--error" : ""}`}
      aria-label={role === "user" ? "Your message" : "Agent response"}
    >
      <div className="agent-message-author">
        {role === "user" ? (
          "You"
        ) : (
          <>
            <Cpu size={12} /> BuildX
          </>
        )}
        {message.error && <span>Request failed</span>}
      </div>
      {longRequest ? (
        <details className="agent-request-details">
          <summary>
            <span>
              {content.split("\n")[0].slice(0, 120)}
              {content.split("\n")[0].length > 120 ? "…" : ""}
            </span>
            <small>
              Show full request <ChevronRight size={12} />
            </small>
          </summary>
          <div className="agent-message-content">{content}</div>
        </details>
      ) : (
        <div className="agent-message-content">{content}</div>
      )}
      {role === "assistant" && hasDetails && (
        <details className="agent-run-details">
          <summary>
            <ChevronRight size={12} /> Run details{" "}
            <span>
              {thinkingSteps.length
                ? `${thinkingSteps.length} activities`
                : "Models & files"}
            </span>
          </summary>
          {telemetry?.planner && (
            <p className="agent-model-detail">
              Planner · {modelName(telemetry.planner.modelUsed)}
              {telemetry.planner.wasFallback ? " (fallback)" : ""}
            </p>
          )}
          {telemetry?.patches?.map((patch, index) => (
            <p
              className="agent-model-detail"
              key={`${patch.filePath}-${index}`}
            >
              <code>{patch.filePath}</code>
              <span>
                {modelName(patch.modelUsed)}
                {patch.wasFallback ? " (fallback)" : ""}
              </span>
            </p>
          ))}
          {thinkingSteps.length > 0 && (
            <ol className="agent-activity-list">
              {thinkingSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </details>
      )}
    </article>
  );
}

export function AgentRunStatus({
  stage,
  elapsedMs,
  model,
  steps,
  plan,
}: {
  stage: string;
  elapsedMs?: number;
  model?: string;
  steps: string[];
  plan: string;
}) {
  return (
    <div className="agent-current-run">
      <div className="agent-current-summary" role="status">
        <Loader2 size={14} className="agent-working-icon" />
        <span>{stages[stage] || "Working on your request"}</span>
        {elapsedMs != null && (
          <time>
            {Math.floor(elapsedMs / 60000)}:
            {String(Math.floor(elapsedMs / 1000) % 60).padStart(2, "0")}
          </time>
        )}
      </div>
      {(steps.length > 0 || plan || model) && (
        <details className="agent-run-details">
          <summary>
            <ChevronRight size={12} /> View activity
          </summary>
          {model && <p className="agent-model-detail">{modelName(model)}</p>}
          {plan && (
            <div className="agent-plan">
              <span>Plan</span>
              <pre>{plan}</pre>
            </div>
          )}
          {steps.length > 0 && (
            <ol className="agent-activity-list">
              {steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </details>
      )}
    </div>
  );
}
