import React, { useState } from 'react';
import type { Blueprint } from '../lib/types';
import { methodClass, complexityColor, parseFlow, escapeHtml } from '../lib/utils';

// ─── Shared ─────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono-custom text-xs uppercase tracking-widest mb-4"
      style={{ color: 'var(--text3)' }}
    >
      {children}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card p-5 mb-4 ${className}`}>
      {children}
    </div>
  );
}

// ─── Features ───────────────────────────────────────────────

const FEATURE_CATS = [
  {
    key: 'authentication' as const,
    label: 'Authentication',
    icon: '🔐',
    accentVar: '--blue',
    bgVar: '--blue-dim',
  },
  {
    key: 'core' as const,
    label: 'Core Features',
    icon: '⚙️',
    accentVar: '--green',
    bgVar: '--green-dim',
  },
  {
    key: 'admin' as const,
    label: 'Admin Features',
    icon: '🛡️',
    accentVar: '--amber',
    bgVar: '--amber-dim',
  },
  {
    key: 'optional' as const,
    label: 'Enhancements',
    icon: '✨',
    accentVar: '--purple',
    bgVar: '--purple-dim',
  },
] as const;

export function FeaturesPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div>
      <SectionLabel>// feature breakdown</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURE_CATS.map((cat) => {
          const items = blueprint.features[cat.key];
          if (!items?.length) return null;
          return (
            <Card key={cat.key}>
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center text-base"
                  style={{ background: `var(${cat.bgVar})` }}
                >
                  {cat.icon}
                </div>
                <span
                  className="font-mono-custom text-xs font-medium"
                  style={{ color: `var(${cat.accentVar})` }}
                >
                  {cat.label}
                </span>
              </div>
              <div className="flex flex-col">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 py-1.5 text-sm"
                    style={{
                      color: 'var(--text2)',
                      borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: `var(${cat.accentVar})` }}
                    />
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Schema ─────────────────────────────────────────────────

export function SchemaPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div>
      <SectionLabel>// database schema · {blueprint.schema.length} tables</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {blueprint.schema.map((table) => (
          <div
            key={table.table}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* Table header */}
            <div
              className="flex items-center gap-2.5 px-5 py-3.5"
              style={{
                background: 'var(--surface2)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--purple-dim)', border: '1px solid rgba(192,132,252,0.2)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--purple)">
                  <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v2H3V5zm0 4h18v2H3V9zm0 4h18v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z" />
                </svg>
              </div>
              <span className="font-mono-custom text-sm font-medium" style={{ color: 'var(--purple)' }}>
                {table.table}
              </span>
            </div>

            {/* Columns */}
            <div style={{ background: 'var(--surface)' }}>
              {table.columns.map((col, i) => (
                <div
                  key={col.name}
                  className="flex items-center justify-between px-5 py-2 text-xs"
                  style={{
                    borderBottom:
                      i < table.columns.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span className="font-mono-custom min-w-0 truncate" style={{ color: 'var(--text)' }}>
                    {col.name}
                  </span>
                  <div className="flex items-center gap-2 text-right flex-shrink-0 max-w-[55%]">
                    <span className="font-mono-custom break-all" style={{ color: 'var(--text3)' }}>
                      {col.type}
                    </span>
                    {col.note && (
                      <span
                        className="font-mono-custom px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          background: 'var(--accent-glow)',
                          color: 'var(--accent2)',
                          border: '1px solid rgba(124,106,255,0.2)',
                        }}
                      >
                        {col.note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── API Endpoints ───────────────────────────────────────────

export function ApiPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div>
      <SectionLabel>// api endpoints · {blueprint.endpoints.length} routes</SectionLabel>
      <div className="flex flex-col gap-2">
        {blueprint.endpoints.map((ep, i) => (
          <div
            key={`${ep.method}-${ep.path}-${i}`}
            className="flex items-start gap-3 px-4 py-3 rounded-[10px] border transition-colors duration-150"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            }}
          >
            <span
              className={`font-mono-custom text-[10px] font-medium px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5 w-14 text-center ${methodClass(ep.method)}`}
              style={{ letterSpacing: '0.3px' }}
            >
              {ep.method}
            </span>
            <div>
              <div className="font-mono-custom text-sm" style={{ color: 'var(--text)' }}>
                {ep.path}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                {ep.description}
                {ep.auth && (
                  <span
                    className="ml-2 font-mono-custom text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: 'var(--amber-dim)',
                      color: 'var(--amber)',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    auth
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UI Screens ──────────────────────────────────────────────

export function UiPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div>
      <SectionLabel>// ui screens · {blueprint.screens.length} screens</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {blueprint.screens.map((screen) => (
          <Card key={screen.name}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              {screen.icon}
            </div>
            <div
              className="font-display font-semibold text-sm mb-2"
              style={{ color: 'var(--text)' }}
            >
              {screen.name}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
              {screen.components}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Architecture ────────────────────────────────────────────

export function ArchPanel({ blueprint }: { blueprint: Blueprint }) {
  const { architecture } = blueprint;
  const layers = [
    { label: 'Frontend', value: architecture.frontend },
    { label: 'Backend', value: architecture.backend },
    { label: 'Database', value: architecture.database },
    { label: 'Auth', value: architecture.auth },
    { label: 'Hosting', value: architecture.hosting },
  ];
  const flowSteps = parseFlow(architecture.flow);

  return (
    <div>
      <SectionLabel>// system architecture</SectionLabel>

      {/* Tech stack grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {layers.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-[10px] p-4"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
          >
            <div
              className="font-mono-custom text-[10px] uppercase tracking-widest mb-2"
              style={{ color: 'var(--text3)' }}
            >
              {label}
            </div>
            <div className="text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Request flow */}
      <Card>
        <div
          className="font-mono-custom text-xs uppercase tracking-widest mb-5"
          style={{ color: 'var(--text3)' }}
        >
          // request flow
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {flowSteps.map((step, i) => (
            <React.Fragment key={i}>
              <div
                className="font-mono-custom text-xs px-3.5 py-2 rounded-lg"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                }}
              >
                {step}
              </div>
              {i < flowSteps.length - 1 && (
                <span className="text-lg" style={{ color: 'var(--text3)' }}>
                  →
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Starter Code ────────────────────────────────────────────

type CodeTab = 'frontend' | 'backend' | 'sql';

const CODE_TABS: { id: CodeTab; label: string; shortLabel: string; lang: string }[] = [
  { id: 'frontend', label: 'React · Frontend', shortLabel: 'FE', lang: 'tsx' },
  { id: 'backend', label: 'Express · Backend', shortLabel: 'BE', lang: 'ts' },
  { id: 'sql', label: 'SQL Schema', shortLabel: 'SQL', lang: 'sql' },
];

export function CodePanel({ blueprint }: { blueprint: Blueprint }) {
  const [activeCode, setActiveCode] = useState<CodeTab>('frontend');

  function copyCode(text: string) {
    navigator.clipboard.writeText(text).catch(() => {
      // Clipboard API might be unavailable in some contexts
    });
  }

  const currentCode =
    activeCode === 'frontend'
      ? blueprint.code.frontend
      : activeCode === 'backend'
      ? blueprint.code.backend
      : blueprint.code.sql;

  return (
    <div>
      <SectionLabel>// starter code</SectionLabel>

      {/* Code tabs + copy button */}
      <div className="flex items-end justify-between mb-0 flex-wrap gap-2">
        <div className="flex gap-1">
          {CODE_TABS.map(({ id, label, shortLabel }) => (
            <button
              key={id}
              onClick={() => setActiveCode(id)}
              className="font-mono-custom text-xs px-4 py-2 rounded-t-lg border border-b-0 transition-all duration-150"
              style={{
                background: activeCode === id ? 'var(--surface3)' : 'var(--surface2)',
                borderColor: activeCode === id ? 'var(--border2)' : 'var(--border)',
                color: activeCode === id ? 'var(--accent2)' : 'var(--text3)',
              }}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => copyCode(currentCode)}
          className="font-mono-custom text-xs px-3 py-1.5 rounded-lg border mb-0 transition-all duration-150 flex items-center gap-1.5"
          style={{
            background: 'var(--surface2)',
            borderColor: 'var(--border)',
            color: 'var(--text2)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text2)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </button>
      </div>

      {/* Code display */}
      <div className="code-block rounded-t-none"
        style={{ borderTopLeftRadius: 0 }}
        dangerouslySetInnerHTML={{ __html: escapeHtml(currentCode) }}
      />
    </div>
  );
}

// ─── Effort ──────────────────────────────────────────────────

export function EffortPanel({ blueprint }: { blueprint: Blueprint }) {
  const { effort, complexity } = blueprint;
  const cards = [
    { label: 'Timeline', value: effort.time, icon: '🗓️' },
    { label: 'Complexity', value: effort.complexity, icon: '⚡' },
    { label: 'Est. Cost', value: effort.cost, icon: '💰' },
    { label: 'Team Size', value: effort.team, icon: '👥' },
  ];

  return (
    <div>
      <SectionLabel>// effort estimation</SectionLabel>

      {/* Complexity badge */}
      <div className="mb-6">
        <span
          className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full border font-medium ${complexityColor(complexity)}`}
        >
          <span>Overall Complexity:</span>
          <strong>{complexity}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ label, value, icon }) => (
          <div
            key={label}
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="font-mono-custom text-[10px] uppercase tracking-widest mb-3 flex items-center gap-1.5"
              style={{ color: 'var(--text3)' }}
            >
              <span>{icon}</span>
              {label}
            </div>
            <div
              className="font-display font-bold text-xl leading-snug"
              style={{ color: 'var(--text)' }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
