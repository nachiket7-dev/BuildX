import { useState, useEffect, useRef, type FormEvent } from "react";
import { ArrowUpRight, Layers, Check } from "./ui/icons";
import { useNavigate } from "react-router-dom";
import { EXAMPLE_IDEAS } from "../lib/utils";
import type { StackSpec } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { StudioBlueprint, STACK_LABELS } from "./StudioBlueprint";
import { SegmentedControl } from "./ui/SegmentedControl";
const DRAFT_KEY = "buildx_create_draft";
const defaults: StackSpec = {
  framework: "next",
  db: "postgres",
  auth: "clerk",
};
function readDraft(): { idea: string; stack: StackSpec } {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
    return {
      idea: typeof d.idea === "string" ? d.idea : "",
      stack: {
        framework: ["next", "express", "fastify"].includes(d.stack?.framework)
          ? d.stack.framework
          : defaults.framework,
        db: ["postgres", "supabase", "mongo"].includes(d.stack?.db)
          ? d.stack.db
          : defaults.db,
        auth: ["jwt", "clerk", "nextauth"].includes(d.stack?.auth)
          ? d.stack.auth
          : defaults.auth,
      },
    };
  } catch {
    return { idea: "", stack: defaults };
  }
}
export function CreateProjectForm({
  onGenerate,
  isLoading,
}: {
  onGenerate: (idea: string, stack?: StackSpec) => void;
  isLoading: boolean;
}) {
  const [draft, setDraft] = useState(readDraft);
  const [configuring, setConfiguring] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  const ideaInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = ideaInput.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(220, Math.max(64, input.scrollHeight))}px`;
    };
    resize();
    let width = input.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === width) return;
      width = input.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    });
    observer.observe(input);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [draft.idea]);
  const { user, authReady, sessionError, retrySession } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* Storage can be unavailable in private sessions. */
    }
  }, [draft]);
  useEffect(() => {
    if (!isLoading) lock.current = false;
  }, [isLoading]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (draft.idea.trim().length < 10 || isLoading || lock.current) return;
    if (!user) {
      navigate("/login", { state: { from: "/create" } });
      return;
    }
    if (!authReady) return;
    lock.current = true;
    onGenerate(draft.idea.trim(), draft.stack);
  }
  const invalid = submitted && draft.idea.trim().length < 10;
  return (
    <section className="creation-studio">
      <div className="studio-intro">
        <div className="studio-writing">
          <p className="studio-eyebrow">
            <span /> THE ARCHITECTURE STUDIO
          </p>
          <h1>
            It starts
            <br />
            <em>with an idea.</em>
          </h1>
          <p className="studio-description">
            Give your next big idea a solid foundation.
            <br className="studio-desktop-break" /> Turn what’s in your head
            into a connected blueprint.
          </p>
          {sessionError && (
            <div className="studio-session-error" role="alert">
              <p>We couldn’t verify your session. Your draft is still here.</p>
              <Button onClick={retrySession}>Retry session check</Button>
            </div>
          )}
          <form
            onSubmit={submit}
            className={`studio-composer ${invalid ? "studio-composer--invalid" : ""}`}
          >
            <label htmlFor="project-idea">What would you like to build?</label>
            <textarea
              id="project-idea"
              ref={ideaInput}
              value={draft.idea}
              onChange={(e) =>
                setDraft((d) => ({ ...d, idea: e.target.value }))
              }
              placeholder="An idea, a problem, a possibility…"
              rows={2}
              maxLength={10000}
              disabled={isLoading}
              aria-invalid={invalid}
              aria-describedby="project-idea-help"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
              }}
            />
            <div className="studio-composer-footer">
              <span className="studio-draft">
                <Check size={12} /> Draft saved
              </span>
              <Button
                type="submit"
                variant="primary"
                loading={
                  isLoading || (Boolean(user) && !authReady && !sessionError)
                }
                disabled={Boolean(user) && !authReady}
              >
                {user ? "Generate blueprint" : "Sign in to build"}
                <ArrowUpRight size={17} />
              </Button>
            </div>
          </form>
          <p
            id="project-idea-help"
            className={`studio-input-help ${invalid ? "studio-input-help--error" : ""}`}
          >
            {invalid
              ? "Add a little more detail—at least 10 characters."
              : "Describe who it’s for and what it should do. ⌘ / Ctrl + Enter to send."}
          </p>
          <button
            type="button"
            className="studio-stack-trigger"
            onClick={() => setConfiguring(true)}
            disabled={isLoading}
            aria-haspopup="dialog"
          >
            <Layers size={15} />
            <span>
              {STACK_LABELS[draft.stack.framework]}
              <b> / </b>
              {STACK_LABELS[draft.stack.db]}
              <b> / </b>
              {STACK_LABELS[draft.stack.auth]}
            </span>
            <strong>
              Configure <ArrowUpRight size={12} />
            </strong>
          </button>
        </div>
        <StudioBlueprint stack={draft.stack} />
      </div>
      <div className="studio-starting-points">
        <div className="studio-section-label">
          <span>A LITTLE INSPIRATION</span>
          <span>Choose a starting point. Make it yours.</span>
        </div>
        <div className="studio-examples">
          {EXAMPLE_IDEAS.slice(0, 4).map((example, index) => (
            <button
              type="button"
              key={example.label}
              disabled={isLoading}
              onClick={() => {
                setDraft((d) => ({ ...d, idea: example.idea }));
                ideaInput.current?.focus();
              }}
              className={`studio-example studio-example--${index}`}
            >
              <div className="studio-example-art" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span className="studio-example-title">
                {example.label}
                <ArrowUpRight size={15} />
              </span>
              <span className="studio-example-description">
                {
                  [
                    "Discovery. Orders. Delivery.",
                    "Contacts. Pipelines. Teams.",
                    "Courses. Progress. Learning.",
                    "Talent. Projects. Contracts.",
                  ][index]
                }
              </span>
            </button>
          ))}
        </div>
      </div>
      <Modal
        isOpen={configuring}
        onClose={() => setConfiguring(false)}
        title="Your foundation"
        description="Choose the technologies for your blueprint. Your choices are saved with this draft."
        size="sm"
      >
        <div className="studio-stack-options">
          <div className="studio-stack-fields">
            <div>
              <span>Framework</span>
              <SegmentedControl
                ariaLabel="Framework"
                value={draft.stack.framework}
                onChange={(value) =>
                  setDraft((d) => ({
                    ...d,
                    stack: { ...d.stack, framework: value },
                  }))
                }
                options={[
                  { value: "next", label: "Next.js" },
                  { value: "express", label: "Express" },
                  { value: "fastify", label: "Fastify" },
                ]}
              />
            </div>
            <div>
              <span>Database</span>
              <SegmentedControl
                ariaLabel="Database"
                value={draft.stack.db}
                onChange={(value) =>
                  setDraft((d) => ({ ...d, stack: { ...d.stack, db: value } }))
                }
                options={[
                  { value: "postgres", label: "Postgres" },
                  { value: "supabase", label: "Supabase" },
                  { value: "mongo", label: "MongoDB" },
                ]}
              />
            </div>
            <div>
              <span>Authentication</span>
              <SegmentedControl
                ariaLabel="Authentication"
                value={draft.stack.auth}
                onChange={(value) =>
                  setDraft((d) => ({
                    ...d,
                    stack: { ...d.stack, auth: value },
                  }))
                }
                options={[
                  { value: "jwt", label: "JWT" },
                  { value: "clerk", label: "Clerk" },
                  { value: "nextauth", label: "NextAuth" },
                ]}
              />
            </div>
          </div>
        </div>
        <Button
          className="studio-stack-done"
          variant="primary"
          onClick={() => setConfiguring(false)}
        >
          Done <Check size={15} />
        </Button>
      </Modal>
    </section>
  );
}
