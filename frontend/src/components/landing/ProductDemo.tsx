import { useEffect, useRef, useState } from "react";
import { BrandMark } from "../Logo";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Terminal,
  GitBranch,
} from "../ui/icons";
import { GENERATION_STAGES } from "../../lib/generationStages";
import { BlueprintArtifact, type DemoArtifact } from "./BlueprintArtifact";
import { demoBlueprint, demoIdea, DEMO_DURATIONS } from "./demoData";

const views: DemoArtifact[] = [
  "features",
  "features",
  "schema",
  "api",
  "ui",
  "code",
  "architecture",
  "architecture",
];
const tabs: { id: DemoArtifact; label: string }[] = [
  { id: "features", label: "Features" },
  { id: "schema", label: "Database" },
  { id: "api", label: "API Endpoints" },
  { id: "ui", label: "UI Screens" },
  { id: "architecture", label: "Architecture" },
  { id: "code", label: "Code" },
];

export function ProductDemo({ ready = true }: { ready?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);
  const [replay, setReplay] = useState(0);
  const [selected, setSelected] = useState<DemoArtifact | null>(null);
  const remaining = useRef(DEMO_DURATIONS[0]);
  const revision = useRef(0);
  const complete = step === 7;
  const running =
    playing && !complete && !reducedMotion && inView && visible && ready;
  const currentView = selected ?? views[step];
  const showIdea = step === 0 && !selected;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const scheduledRevision = revision.current;
    let advanced = false;
    const timer = window.setTimeout(() => {
      advanced = true;
      remaining.current = DEMO_DURATIONS[step + 1];
      setStep(step + 1);
      setSelected(null);
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      if (!advanced && revision.current === scheduledRevision)
        remaining.current = Math.max(
          0,
          remaining.current - (performance.now() - start),
        );
    };
  }, [running, step, replay]);

  function goTo(next: number, autoplay = false) {
    revision.current += 1;
    remaining.current = DEMO_DURATIONS[next];
    setReplay((value) => value + 1);
    setPlaying(autoplay);
    setStep(next);
    setSelected(null);
  }

  const status = complete
    ? "Your blueprint, ready to explore."
    : step === 0
      ? "Every build starts with an idea."
      : GENERATION_STAGES[step - 1].title;

  return (
    <figure
      ref={ref}
      className="generation-demo"
      data-running={running}
      aria-label="Guided BuildX product demo: an idea becomes a structured blueprint"
    >
      <div className="generation-demo-topbar">
        <BrandMark className="demo-symbol" />
        <span>
          BuildX <ChevronRight size={12} />{" "}
          <strong>{demoBlueprint.appName}</strong>
        </span>
        <span className="demo-mode">
          <i /> Guided product demo
        </span>
      </div>
      <div className="demo-brief">
        <span className="demo-brief-label">
          <GitBranch size={16} /> THE IDEA
        </span>
        <p>{demoIdea}</p>
        <span className="demo-stack">
          React <i /> Express <i /> PostgreSQL
        </span>
      </div>
      <div className="demo-stage-layout">
        <nav className="demo-stage-rail" aria-label="Demo generation stages">
          <div className="demo-rail-heading">
            THE BUILD SEQUENCE <span>06</span>
          </div>
          {GENERATION_STAGES.map((stage, index) => {
            const active = step === index + 1;
            const done = step > index + 1;
            return (
              <button
                type="button"
                className={`demo-stage ${active ? "is-active" : ""} ${done ? "is-complete" : ""}`}
                aria-current={active ? "step" : undefined}
                key={stage.agent}
                onClick={() => goTo(index + 1)}
              >
                <span className="demo-stage-node">
                  {done ? (
                    <Check size={13} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  <strong>{stage.label}</strong>
                  <small>{stage.output}</small>
                </span>
                <span className="demo-stage-state">
                  {done
                    ? "Done"
                    : active
                      ? playing && !reducedMotion
                        ? "Working"
                        : "Inspect"
                      : "Queued"}
                </span>
              </button>
            );
          })}
          <div className="demo-rail-footer">
            <span className="demo-signal" />
            <span>One idea. Connected outputs.</span>
          </div>
        </nav>
        <div className="demo-output">
          <div className="demo-output-header">
            <div>
              <span className="eyebrow">
                {complete
                  ? "BLUEPRINT ASSEMBLED"
                  : step === 0
                    ? "FROM INTENT TO ARCHITECTURE"
                    : `AGENT ${String(step).padStart(2, "0")} / 06`}
              </span>
              <h3>{status}</h3>
            </div>
            <span
              className={`demo-output-indicator ${complete ? "is-complete" : ""}`}
              aria-hidden="true"
            >
              {complete ? <Check size={18} /> : <GitBranch size={18} />}
            </span>
          </div>
          <div
            className="demo-artifact-tabs"
            aria-label="Demo blueprint artifacts"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={currentView === tab.id}
                onClick={() => {
                  setPlaying(false);
                  setSelected(tab.id);
                }}
              >
                <span>{tab.label}</span>
                {currentView === tab.id && (
                  <motion.i
                    layoutId="demo-artifact-tab"
                    transition={{ duration: 0.2 }}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="demo-artifact-canvas">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={showIdea ? "idea" : currentView}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {showIdea ? (
                  <div className="demo-idea-canvas">
                    <span className="demo-idea-kicker">
                      A FEW WORDS. A PLACE TO START.
                    </span>
                    <div className="demo-idea-card">
                      <GitBranch size={22} />
                      <p>{demoIdea}</p>
                      <span>
                        YOUR PROJECT BRIEF <ArrowRight size={14} />
                      </span>
                    </div>
                    <div className="demo-idea-outputs">
                      <span>Data model</span>
                      <span>API routes</span>
                      <span>UI screens</span>
                    </div>
                  </div>
                ) : (
                  <BlueprintArtifact view={currentView} />
                )}
              </motion.div>
            </AnimatePresence>
            {step === 0 && !selected && (
              <div className="demo-awaiting">
                <span className="demo-signal" />
                {reducedMotion
                  ? "Select a stage to explore the demo"
                  : "The idea is ready. Watch the blueprint take shape."}
              </div>
            )}
          </div>
          <div className="demo-output-footer">
            <Terminal size={14} />
            <span>
              {selected
                ? "Inspecting example output"
                : complete
                  ? "Explore the artifacts above. Start your own project in Studio."
                  : step === 0
                    ? "An illustrative project, built around a real BuildX workflow."
                    : GENERATION_STAGES[step - 1].output}
            </span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
      <figcaption className="demo-playback">
        <span>
          <span className="demo-caption-label">IDEA → BLUEPRINT</span>
          <span className="demo-timing">
            Simulated outputs · illustrative timing
          </span>
        </span>
        <div>
          <button
            type="button"
            onClick={() => goTo(0, true)}
            aria-label="Replay product demo"
          >
            <RotateCcw size={14} />
            <span>Replay</span>
          </button>
          {reducedMotion ? (
            <button type="button" onClick={() => goTo(complete ? 0 : step + 1)}>
              <span>{complete ? "Start again" : "Next stage"}</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (complete) goTo(0, true);
                else {
                  setSelected(null);
                  setPlaying(!playing);
                }
              }}
              aria-label={
                playing && !complete
                  ? "Pause product demo"
                  : "Play product demo"
              }
            >
              {playing && !complete ? <Pause size={14} /> : <Play size={14} />}
              <span>{playing && !complete ? "Pause" : "Play"}</span>
            </button>
          )}
        </div>
      </figcaption>
      <span className="sr-only" role="status">
        {status}
      </span>
    </figure>
  );
}
