import { useState } from "react";
import {
  ArrowUpRight,
  Braces,
  Check,
  Database,
  GitPullRequest,
  Layers,
} from "../ui/icons";
export function MechanismSection() {
  const [diff, setDiff] = useState(true);
  const [destination, setDestination] = useState(0);
  const [workflow, setWorkflow] = useState(0);
  const destinations = [
    {
      Icon: Layers,
      label: "App preview",
      detail: "Explore the generated interface inside your workspace.",
    },
    {
      Icon: Braces,
      label: "Source code ZIP",
      detail: "Take the project files with you for local development.",
    },
    {
      Icon: GitPullRequest,
      label: "GitHub export",
      detail: "Send your project to your connected GitHub account.",
    },
  ];
  return (
    <>
      <section className="landing-section" id="features">
        <div className="landing-container">
          <div className="section-intro">
            <p className="eyebrow">01 / ROOM TO BUILD</p>
            <h2>
              From the big picture
              <br />
              to the last detail.
            </h2>
            <p>
              A connected place to understand your architecture, work with your
              code, and see what takes shape.
            </p>
          </div>
          <div className="capability-grid">
            <article className="capability-card capability-card--wide">
              <div className="capability-copy">
                <span className="feature-icon">
                  <Database size={20} />
                </span>
                <h3>Structure before syntax.</h3>
                <p>
                  Explore the schema, endpoints, and screens behind your idea.
                  See how the pieces fit before you start refining.
                </p>
              </div>
              <div
                className="schema-demo"
                aria-label="Example data model connecting teams, projects, and tasks"
              >
                {[
                  [
                    "teams",
                    "id · uuid",
                    "name · text",
                    "created_at · timestamp",
                  ],
                  [
                    "projects",
                    "id · uuid",
                    "team_id · teams.id",
                    "name · text",
                  ],
                  [
                    "tasks",
                    "id · uuid",
                    "project_id · projects.id",
                    "status · text",
                  ],
                ].map((table) => (
                  <div className="schema-table" key={table[0]}>
                    <strong>
                      <Database size={12} />
                      {table[0]}
                    </strong>
                    {table.slice(1).map((field) => (
                      <span key={field}>{field}</span>
                    ))}
                  </div>
                ))}
              </div>
            </article>
            <article className="capability-card">
              <span className="feature-icon">
                <GitPullRequest size={20} />
              </span>
              <h3>Every change, in view.</h3>
              <p>
                Ask for a refinement. Review the proposed changes in context and
                decide what belongs in your project.
              </p>
              <div key={String(diff)} className="diff-demo" aria-label="Example code change">
                <span>
                  TaskCard.tsx <span>+2 −1</span>
                </span>
                {diff ? (
                  <>
                    <del>− status: 'backlog'</del>
                    <ins>+ status: task.status</ins>
                    <ins>+ assignee: task.owner</ins>
                  </>
                ) : (
                  <>
                    <code>status: 'backlog'</code>
                    <code>assignee: null</code>
                  </>
                )}
                <footer>
                  <Check size={12} /> A clear view of what changes
                </footer>
              </div>
              <div className="diff-toggle" aria-label="Example change view">
                <button
                  type="button"
                  aria-pressed={!diff}
                  onClick={() => setDiff(false)}
                >
                  Original
                </button>
                <button
                  type="button"
                  aria-pressed={diff}
                  onClick={() => setDiff(true)}
                >
                  Proposed change
                </button>
              </div>
            </article>
            <article className="capability-card">
              <span className="feature-icon">
                <Braces size={20} />
              </span>
              <h3>Your code. Your next step.</h3>
              <p>
                Keep working in the editor, explore the app preview, or export
                your project for local development.
              </p>
              <div className="export-demo">
                {destinations.map(({ Icon, label }, index) => (
                  <button
                    type="button"
                    key={label}
                    aria-pressed={destination === index}
                    onClick={() => setDestination(index)}
                  >
                    <Icon size={16} />
                    {label}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <p key={destination} className="export-description" role="status">
                {destinations[destination].detail}
              </p>
            </article>
          </div>
        </div>
      </section>
      <section className="landing-section workflow-section" id="how-it-works">
        <div className="landing-container">
          <div className="section-intro">
            <p className="eyebrow">02 / A CLEAR PATH FORWARD</p>
            <h2>One idea. Three steps.</h2>
          </div>
          <div className="workflow-selector" aria-label="Explore the workflow">
            {[
              {
                n: "01",
                title: "Describe the possibility.",
                text: "Start in Studio with your idea, the people it is for, and the stack you want to work with.",
              },
              {
                n: "02",
                title: "Make the plan your own.",
                text: "Explore your blueprint. Refine the data model, review endpoints, and shape the experience.",
              },
              {
                n: "03",
                title: "Bring it into focus.",
                text: "Work through the code, inspect the preview, and export when you are ready to take it further.",
              },
            ].map((step, index) => (
              <button
                type="button"
                key={step.n}
                aria-pressed={workflow === index}
                onClick={() => setWorkflow(index)}
              >
                <span>{step.n}</span>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </button>
            ))}
          </div>
          <div key={workflow} className="workflow-detail" role="status">
            <span>
              {
                [
                  "01 / YOUR BRIEF",
                  "02 / YOUR BLUEPRINT",
                  "03 / YOUR WORKSPACE",
                ][workflow]
              }
            </span>
            <p>
              {
                [
                  "Describe who the app serves, the essential features, and your preferred stack. Your draft stays with you when you sign in.",
                  "Inspect the features, data model, API endpoints, screens, architecture, diagrams, and effort estimate in one place.",
                  "Ask for a change, review the proposed diff, and decide what to keep. Explore the preview or export the project.",
                ][workflow]
              }
            </p>
            <ArrowUpRight size={20} />
          </div>
        </div>
      </section>
    </>
  );
}
