import {
  ApiPanel,
  ArchPanel,
  FeaturesPanel,
  SchemaPanel,
  UiPanel,
  EffortPanel,
} from "./BlueprintPanels";
import { DiagramsPanel } from "./DiagramsPanel";
import type { Blueprint } from "../lib/types";
import { LandingPreloader } from "./LandingPreloader";
import { StreamingView } from "./StreamingView";
import { GENERATION_STAGES } from "../lib/generationStages";
import { demoBlueprint } from "./landing/demoData";
import type { AgentEvent } from "../lib/types";
import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { Tooltip } from "./ui/Tooltip";
import { Dropdown } from "./ui/Dropdown";
export default function ComponentPreview() {
  const [panel, setPanel] = useState("api");
  const [sample, setSample] = useState("standard");
  const fixture: Blueprint =
    sample === "empty"
      ? {
          ...demoBlueprint,
          features: { authentication: [], core: [], admin: [], optional: [] },
          schema: [],
          endpoints: [],
          screens: [],
          architecture: {
            frontend: "",
            backend: "",
            database: "",
            auth: "",
            hosting: "",
            flow: "",
          },
          effort: { time: "", complexity: "", cost: "", team: "" },
        }
      : sample === "long"
        ? {
            ...demoBlueprint,
            endpoints: Array.from({ length: 18 }, (_, i) => ({
              method: i % 2 ? "GET" : "POST",
              path: `/api/organizations/[organizationId]/projects/[projectId]/collaborators/${i}/permissions`,
              description:
                "Manage project permissions for invited collaborators, including inherited access policies, organization membership checks, and auditable role updates.",
              auth: true,
            })),
            architecture: {
              ...demoBlueprint.architecture,
              frontend:
                "React application with server-rendered public pages, protected team workspaces, and accessible UI components",
              flow: "Browser and authenticated team workspace → Application API and permission checks → Background processing and durable task queue → Relational database and activity history",
            },
            screens: [
              ...demoBlueprint.screens,
              {
                name: "Organization settings and collaborator permission management",
                icon: "",
                components:
                  "Organization details, Role assignments, Inherited access policy, Audit history, Notification preferences",
              },
            ],
          }
        : demoBlueprint;
  const panels = {
    api: ApiPanel,
    architecture: ArchPanel,
    features: FeaturesPanel,
    schema: SchemaPanel,
    screens: UiPanel,
    effort: EffortPanel,
    diagrams: DiagramsPanel,
  };
  const Panel = panels[panel as keyof typeof panels];
  const [open, setOpen] = useState(false);
  const [entrance, setEntrance] = useState(false);
  const [stage, setStage] = useState(2);
  const events: AgentEvent[] = GENERATION_STAGES.slice(0, stage + 1).map(
    (item, index) => ({
      agent: item.agent,
      status: index < stage ? "completed" : "thinking",
      timestamp: "",
      log: item.title,
    }),
  );
  return (
    <main className="component-preview">
      {entrance && <LandingPreloader onComplete={() => setEntrance(false)} />}
      <h1>BuildX components</h1>
      <section className="panel-verification">
        <h2>Application panels</h2>
        <div className="fixture-controls">
          <label>
            Content{" "}
            <select
              aria-label="Preview content"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            >
              <option value="standard">Standard project</option>
              <option value="long">Long project content</option>
              <option value="empty">Empty sections</option>
            </select>
          </label>
          {Object.keys(panels).map((key) => (
            <Button
              key={key}
              aria-pressed={panel === key}
              onClick={() => setPanel(key)}
            >
              {key}
            </Button>
          ))}
        </div>
        <div className="blueprint-content" key={`${sample}-${panel}`}>
          <Panel blueprint={fixture} />
        </div>
      </section>
      <Button onClick={() => setEntrance(true)}>Preview brand entrance</Button>
      <p>Development preview · keyboard, focus, and state checks</p>
      <div className="flex flex-wrap gap-3">
        {(
          [
            "primary",
            "secondary",
            "ghost",
            "danger",
            "success",
            "outline",
          ] as const
        ).map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button disabled>Disabled</Button>
        <Button loading>Saving</Button>
      </div>
      <Input label="Project name" helperText="A clear name for your project" />
      <Input label="Project name" error="Enter a project name" />
      <Tooltip content="Opens a test dialog">
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
      </Tooltip>
      <Dropdown
        trigger={<Button>Open menu</Button>}
        items={[
          { label: "Open dialog", onClick: () => setOpen(true) },
          { label: "Unavailable", disabled: true, onClick: () => {} },
        ]}
      />
      <section className="component-generation-preview">
        <h2>Generation states · simulated fixture</h2>
        <div className="flex flex-wrap gap-2">
          {GENERATION_STAGES.map((item, index) => (
            <Button
              key={item.agent}
              onClick={() => setStage(index)}
              aria-pressed={stage === index}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <StreamingView
          progress={((stage + 1) / 6) * 100}
          partialBlueprint={{
            appName: demoBlueprint.appName,
            schema: stage >= 1 ? demoBlueprint.schema : undefined,
            endpoints: stage >= 2 ? demoBlueprint.endpoints : undefined,
            screens: stage >= 3 ? demoBlueprint.screens : undefined,
          }}
          agentEvents={events}
        />
      </section>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Component dialog"
        description="Focus stays in this dialog until you close it."
      >
        <Input label="Name" />
        <Button onClick={() => setOpen(false)}>Done</Button>
      </Modal>
    </main>
  );
}
