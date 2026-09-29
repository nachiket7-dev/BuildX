import { useEffect, useRef, useState } from "react";
import type { Blueprint } from "../lib/types";
import {
  generateERDiagram,
  generateArchDiagram,
  generateAPIFlow,
} from "../lib/diagrams";
import { SpotlightCard } from "./SpotlightCard";

const loadMermaid = (() => {
  let pending: Promise<typeof import('mermaid')['default']> | undefined;
  return () => pending ||= import('mermaid').then(({ default: mermaid }) => {
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#9292db",
    primaryTextColor: "#e4e4ef",
    primaryBorderColor: "#9292db",
    lineColor: "#475569",
    secondaryColor: "#111113",
    tertiaryColor: "#111113",
    background: "#080b0f",
    mainBkg: "#111113",
    nodeBorder: "#9292db",
    clusterBkg: "#111113",
    titleColor: "#e4e4ef",
    edgeLabelBackground: "#111113",
  },
  fontFamily: '"Inter", sans-serif',
  fontSize: 13,
});

    return mermaid;
  });
})();

import { Database, Network, GitMerge } from "./ui/icons";

type DiagramTab = "er" | "arch" | "api";

const DIAGRAM_TABS = [
  { id: "er", label: "ER Diagram", icon: Database },
  { id: "arch", label: "Architecture", icon: Network },
  { id: "api", label: "API Flow", icon: GitMerge },
] as const;

function MermaidRenderer({ chart, id }: { chart: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setSvg("");
      setError(null);
      try {
        const mermaid = await loadMermaid();
        if (cancelled) return;
        const uniqueId = `mermaid-${id}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Mermaid] Render error:", err);
          setError("Failed to render diagram");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
        <details className="mt-3 text-left">
          <summary
            className="font-sans text-xs cursor-pointer tracking-tight"
            style={{ color: "var(--text3)" }}
          >
            View source
          </summary>
          <pre
            className="mt-2 p-3 rounded-lg text-xs font-mono overflow-x-auto"
            style={{ background: "var(--surface3)", color: "var(--text2)" }}
          >
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  if (!svg)
    return (
      <div className="panel-empty" role="status">
        Rendering diagram…
      </div>
    );

  return (
    <SpotlightCard
      className="mermaid-container diagram-surface overflow-x-auto"
      spotlightColor="rgba(124, 124, 244, 0.08)"
    >
      <div
        ref={containerRef}
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </SpotlightCard>
  );
}

function cleanMermaidChart(chart: string): string {
  if (!chart) return "";
  return chart
    .replace(/^```mermaid\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
}

export function DiagramsPanel({ blueprint }: { blueprint: Blueprint }) {
  const [activeTab, setActiveTab] = useState<DiagramTab>("er");

  const erDiagram = cleanMermaidChart(
    blueprint.diagrams?.er || generateERDiagram(blueprint.schema || []),
  );
  const archDiagram = cleanMermaidChart(
    blueprint.diagrams?.arch ||
      generateArchDiagram(blueprint.architecture || ({} as any)),
  );
  const apiDiagram = cleanMermaidChart(
    blueprint.diagrams?.apiFlow || generateAPIFlow(blueprint.endpoints || []),
  );

  const hasData =
    activeTab === "er"
      ? Boolean(blueprint.diagrams?.er || blueprint.schema?.length)
      : activeTab === "api"
        ? Boolean(blueprint.diagrams?.apiFlow || blueprint.endpoints?.length)
        : Boolean(
            blueprint.diagrams?.arch ||
            Object.values(blueprint.architecture || {}).some(Boolean),
          );
  return (
    <div>
      <div className="diagram-panel-heading">
        <div className="panel-section-label">
          <span aria-hidden="true">06</span>
          <h2>visual diagrams</h2>
        </div>
        <div className="diagram-controls" aria-label="Diagram views">
          {DIAGRAM_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-pressed={activeTab === id}
              className="diagram-view-button"
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Diagram content */}
      {!hasData && (
        <p className="panel-empty">No data available for this diagram yet.</p>
      )}
      {hasData && activeTab === "er" && (
        <div>
          <p className="text-xs mb-4" style={{ color: "var(--text3)" }}>
            Entity-Relationship diagram showing{" "}
            {(blueprint.schema || []).length} tables and their relationships
          </p>
          <MermaidRenderer chart={erDiagram} id="er" />
        </div>
      )}

      {hasData && activeTab === "arch" && (
        <div>
          <p className="text-xs mb-4" style={{ color: "var(--text3)" }}>
            System architecture and technology stack
          </p>
          <MermaidRenderer chart={archDiagram} id="arch" />
        </div>
      )}

      {hasData && activeTab === "api" && (
        <div>
          <p className="text-xs mb-4" style={{ color: "var(--text3)" }}>
            API request flow sequence diagram
          </p>
          <MermaidRenderer chart={apiDiagram} id="api" />
        </div>
      )}
    </div>
  );
}
