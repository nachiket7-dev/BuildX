import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { Blueprint } from '../lib/types';
import { generateERDiagram, generateArchDiagram, generateAPIFlow } from '../lib/diagrams';

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#7c6aff',
    primaryTextColor: '#f0f0f8',
    primaryBorderColor: '#7c6aff',
    lineColor: '#5a5a70',
    secondaryColor: '#18181f',
    tertiaryColor: '#111118',
    background: '#0a0a0f',
    mainBkg: '#18181f',
    nodeBorder: '#7c6aff',
    clusterBkg: '#111118',
    titleColor: '#f0f0f8',
    edgeLabelBackground: '#18181f',
  },
  fontFamily: '"DM Mono", monospace',
  fontSize: 13,
});

type DiagramTab = 'er' | 'arch' | 'api';

const DIAGRAM_TABS: { id: DiagramTab; label: string; icon: string }[] = [
  { id: 'er', label: 'ER Diagram', icon: '🗄️' },
  { id: 'arch', label: 'Architecture', icon: '🏗️' },
  { id: 'api', label: 'API Flow', icon: '🔀' },
];

function MermaidRenderer({ chart, id }: { chart: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const uniqueId = `mermaid-${id}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Mermaid] Render error:', err);
          setError('Failed to render diagram');
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
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--coral)' }}>
          {error}
        </p>
        <details className="mt-3 text-left">
          <summary
            className="font-mono-custom text-xs cursor-pointer"
            style={{ color: 'var(--text3)' }}
          >
            View source
          </summary>
          <pre
            className="mt-2 p-3 rounded-lg text-xs overflow-x-auto"
            style={{ background: 'var(--surface3)', color: 'var(--text2)' }}
          >
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container rounded-xl p-6 overflow-x-auto"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function DiagramsPanel({ blueprint }: { blueprint: Blueprint }) {
  const [activeTab, setActiveTab] = useState<DiagramTab>('er');

  const erDiagram = generateERDiagram(blueprint.schema);
  const archDiagram = generateArchDiagram(blueprint.architecture);
  const apiDiagram = generateAPIFlow(blueprint.endpoints);

  return (
    <div>
      <div
        className="font-mono-custom text-xs uppercase tracking-widest mb-4"
        style={{ color: 'var(--text3)' }}
      >
        // visual diagrams
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {DIAGRAM_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="font-mono-custom text-xs px-4 py-2 rounded-lg border transition-all duration-150"
            style={{
              background: activeTab === id ? 'var(--accent-glow)' : 'var(--surface2)',
              borderColor: activeTab === id ? 'rgba(124,106,255,0.3)' : 'var(--border)',
              color: activeTab === id ? 'var(--accent2)' : 'var(--text3)',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Diagram content */}
      {activeTab === 'er' && (
        <div>
          <p className="text-xs mb-4" style={{ color: 'var(--text3)' }}>
            Entity-Relationship diagram showing {blueprint.schema.length} tables and their relationships
          </p>
          <MermaidRenderer chart={erDiagram} id="er" />
        </div>
      )}

      {activeTab === 'arch' && (
        <div>
          <p className="text-xs mb-4" style={{ color: 'var(--text3)' }}>
            System architecture and technology stack
          </p>
          <MermaidRenderer chart={archDiagram} id="arch" />
        </div>
      )}

      {activeTab === 'api' && (
        <div>
          <p className="text-xs mb-4" style={{ color: 'var(--text3)' }}>
            API request flow sequence diagram
          </p>
          <MermaidRenderer chart={apiDiagram} id="api" />
        </div>
      )}
    </div>
  );
}
