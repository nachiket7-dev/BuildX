import { GENERATION_STAGES, agentState } from "../lib/generationStages";
import { useEffect, useState } from "react";
import { Check, Database, FileCode2, Layers, Loader2 } from "./ui/icons";
import type {
  PartialBlueprint,
  PipelineStage,
  PipelineStageEvent,
  AgentEvent,
} from "../lib/types";
import { StreamingSections } from "./StreamingSections";
import { Button } from "./ui/Button";
interface StreamingViewProps {
  progress: number;
  partialBlueprint: PartialBlueprint;
  agentEvents?: AgentEvent[];
  activeStage?: PipelineStage | null;
  pipelineEvents?: PipelineStageEvent[];
  onCancel?: () => void;
}
export function StreamingView({
  progress,
  partialBlueprint,
  agentEvents = [],
  activeStage,
  pipelineEvents = [],
  onCancel,
}: StreamingViewProps) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  const latest = agentEvents[agentEvents.length - 1];
  const stage = activeStage || latest?.stage;
  const currentAgent = GENERATION_STAGES.find(
    (item) => item.agent === latest?.agent,
  );
  const label = currentAgent
    ? latest?.status === "completed"
      ? `${currentAgent.label} complete`
      : currentAgent.title
    : stage
      ? stage.toLowerCase().replace(/_/g, " ")
      : "Planning your project";
  const percent = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <section className="generation-view" aria-label="Generating blueprint">
      <div className="generation-heading">
        <span className="feature-icon">
          <Loader2 size={22} className="animate-spin" />
        </span>
        <p className="eyebrow">YOUR IDEA IS TAKING SHAPE</p>
        <h1>{partialBlueprint.appName || "Building your blueprint"}</h1>
        <p>
          We’re connecting the data, features, and screens for your project.
        </p>
      </div>
      <div className="generation-progress">
        <div>
          <span role="status" className="capitalize">
            {label}
          </span>
          <span>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}{" "}
            elapsed
          </span>
        </div>
        <progress
          max={100}
          value={percent}
          aria-label="Blueprint generation progress"
        />
        <p>
          {seconds > 45
            ? "Still working. Complex projects can take a few minutes."
            : "Progress updates as your project’s artifacts arrive."}
        </p>
      </div>
      <div className="generation-timeline" aria-label="Agent progress">
        {GENERATION_STAGES.map((item, index) => {
          const state = agentState(agentEvents, item.agent);
          return (
            <div
              className="generation-stage"
              key={item.agent}
              data-state={state}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span>
                {state === "complete" ? (
                  <Check size={14} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <strong>{item.label}</strong>
              <small>
                {state === "complete"
                  ? "Complete"
                  : state === "active"
                    ? "Working"
                    : "Waiting"}
              </small>
            </div>
          );
        })}
      </div>
      {latest && (
        <p className="generation-live-note" role="status">
          {latest.log ||
            latest.message ||
            GENERATION_STAGES.find((item) => item.agent === latest.agent)
              ?.title}
        </p>
      )}
      <div className="generation-artifacts">
        {[
          {
            label: "Tables",
            count: partialBlueprint.schema?.length || 0,
            Icon: Database,
          },
          {
            label: "Endpoints",
            count: partialBlueprint.endpoints?.length || 0,
            Icon: FileCode2,
          },
          {
            label: "Screens",
            count: partialBlueprint.screens?.length || 0,
            Icon: Layers,
          },
        ].map(({ label, count, Icon }) => (
          <div key={label}>
            <Icon size={17} />
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div
        className="generation-preview-grid"
        aria-label="Received blueprint artifacts"
      >
        <div>
          <h2>
            <Database size={15} /> Data model
          </h2>
          {partialBlueprint.schema?.length ? (
            partialBlueprint.schema.slice(0, 3).map((table) => (
              <div key={table.table} className="generation-received">
                <strong>{table.table}</strong>
                <small>{table.columns.length} fields</small>
              </div>
            ))
          ) : (
            <p>Tables appear as the model takes shape.</p>
          )}
        </div>
        <div>
          <h2>
            <FileCode2 size={15} /> API routes
          </h2>
          {partialBlueprint.endpoints?.length ? (
            partialBlueprint.endpoints.slice(0, 3).map((endpoint) => (
              <div
                key={endpoint.method + endpoint.path}
                className="generation-received"
              >
                <small>{endpoint.method}</small>
                <code>{endpoint.path}</code>
              </div>
            ))
          ) : (
            <p>Routes appear as the API is defined.</p>
          )}
        </div>
        <div>
          <h2>
            <Layers size={15} /> Screen definitions
          </h2>
          {partialBlueprint.screens?.length ? (
            partialBlueprint.screens.slice(0, 3).map((screen) => (
              <div key={screen.name} className="generation-received">
                <strong>{screen.name}</strong>
              </div>
            ))
          ) : (
            <p>Screens appear as the interface is planned.</p>
          )}
        </div>
      </div>
      <StreamingSections partial={partialBlueprint} />
      <details className="generation-details">
        <summary>
          Technical activity{" "}
          <span>{agentEvents.length + pipelineEvents.length} events</span>
        </summary>
        <div>
          {agentEvents.map((event, i) => (
            <p key={i}>
              {event.status === "completed" ? (
                <Check size={12} />
              ) : (
                <span className="demo-signal" aria-hidden="true" />
              )}
              <span>{event.log || event.message || event.status}</span>
            </p>
          ))}
          {pipelineEvents.map((event, i) => (
            <p key={`stage-${i}`}>
              {event.stage}: {event.state}
            </p>
          ))}
          {!agentEvents.length && !pipelineEvents.length && (
            <p>Waiting for the first activity update…</p>
          )}
        </div>
      </details>
      {onCancel && (
        <Button onClick={onCancel} variant="ghost">
          Cancel generation
        </Button>
      )}
    </section>
  );
}
