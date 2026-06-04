import React, { useState } from 'react';
import type { Blueprint } from '../lib/types';
import { methodClass, complexityColor, resolveFlowSteps, flowStepRole, escapeHtml } from '../lib/utils';
import { CodeStudio } from './CodeStudio';
import { SpotlightCard } from './SpotlightCard';
import { 
  Lock, 
  Sliders, 
  ShieldCheck, 
  Sparkles,
  Calendar,
  Zap,
  DollarSign,
  Users,
  Terminal,
  User,
  ShoppingCart,
  Key,
  CreditCard,
  BarChart2,
  Settings,
  MessageSquare,
  Bell,
  Folder,
  Mail,
  Home,
  Search,
  TrendingUp,
  Package,
  Shield,
  FileText,
  Wrench,
  Layout,
  Monitor,
  Play,
  Send,
  Globe,
  Clock,
  HardDrive
} from 'lucide-react';

// ─── Shared ─────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  if (typeof children === 'string') {
    const label = children.replace(/^\/\/\s*/, '');
    return (
      <div className="bp-section-label" aria-label={label}>
        <span className="bp-section-label__prefix">{'// '}</span>
        <span className="bp-section-label__text">{label}</span>
      </div>
    );
  }

  return <div className="bp-section-label">{children}</div>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <SpotlightCard className={`p-5 mb-4 ${className}`} spotlightColor="rgba(82, 39, 255, 0.12)">
      {children}
    </SpotlightCard>
  );
}

// ─── emojiToIcon dynamic resolver ────────────────────────────

function emojiToIcon(emoji: string, size = 16) {
  const cleanEmoji = emoji?.trim();
  switch (cleanEmoji) {
    case '👤': return <User size={size} />;
    case '🛒': return <ShoppingCart size={size} />;
    case '🔑': return <Key size={size} />;
    case '💳': return <CreditCard size={size} />;
    case '📊': return <BarChart2 size={size} />;
    case '⚙️': return <Settings size={size} />;
    case '💬': return <MessageSquare size={size} />;
    case '📅': return <Calendar size={size} />;
    case '🗓️': return <Calendar size={size} />;
    case '🔔': return <Bell size={size} />;
    case '📁': return <Folder size={size} />;
    case '✉️':
    case '📧': return <Mail size={size} />;
    case '🏠': return <Home size={size} />;
    case '🔍': return <Search size={size} />;
    case '📈': return <TrendingUp size={size} />;
    case '📦': return <Package size={size} />;
    case '🔒': return <Lock size={size} />;
    case '🛡️': return <Shield size={size} />;
    case '💰': return <DollarSign size={size} />;
    case '📄': return <FileText size={size} />;
    case '🛠️': return <Wrench size={size} />;
    case '⚡': return <Zap size={size} />;
    default:
      return <Layout size={size} />;
  }
}

// ─── Features ───────────────────────────────────────────────

const FEATURE_CATS = [
  {
    key: 'authentication' as const,
    label: 'Authentication',
    icon: Lock,
    accentVar: '--accent2',
    bgVar: '--accent-glow',
  },
  {
    key: 'core' as const,
    label: 'Core Features',
    icon: Sliders,
    accentVar: '--green',
    bgVar: '--green-dim',
  },
  {
    key: 'admin' as const,
    label: 'Admin Features',
    icon: ShieldCheck,
    accentVar: '--amber',
    bgVar: '--amber-dim',
  },
  {
    key: 'optional' as const,
    label: 'Enhancements',
    icon: Sparkles,
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
          const items = blueprint.features?.[cat.key];
          if (!items?.length) return null;
          const Icon = cat.icon;
          return (
            <Card key={cat.key}>
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center"
                  style={{ 
                    background: `var(${cat.bgVar})`,
                    color: `var(${cat.accentVar})`
                  }}
                >
                  <Icon size={15} />
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
  const isMongo = (blueprint.architecture?.database || '').toLowerCase().includes('mongo');
  const schemaItems = blueprint.schema || [];
  const entityLabel = isMongo ? 'collections' : 'tables';

  return (
    <div>
      <SectionLabel>// database schema · {schemaItems.length} {entityLabel}</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schemaItems.map((table) => {
          const cols = table.columns || [];
          return (
          <SpotlightCard
            key={table.table}
            className="rounded-2xl overflow-hidden p-0"
            spotlightColor="rgba(94, 234, 212, 0.12)"
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
                style={{ background: 'var(--purple-dim)', border: '1px solid rgba(94,234,212,0.2)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--purple)">
                  <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v2H3V5zm0 4h18v2H3V9zm0 4h18v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z" />
                </svg>
              </div>
              <span className="font-mono-custom text-sm font-medium" style={{ color: 'var(--purple)' }}>
                {table.table}
              </span>
              {isMongo && (
                <span className="font-mono-custom text-[9px] px-1.5 py-0.5 rounded ml-auto"
                  style={{ background: 'var(--accent-glow)', color: 'var(--accent2)', border: '1px solid rgba(20,184,166,0.2)' }}>
                  collection
                </span>
              )}
            </div>

            {/* Columns */}
            <div style={{ background: 'var(--surface)' }}>
              {cols.length === 0 ? (
                <div className="px-5 py-4 text-xs font-mono-custom" style={{ color: 'var(--text3)' }}>
                  No fields defined
                </div>
              ) : (
                cols.map((col, i) => (
                <div
                  key={col.name}
                  className="flex items-center justify-between px-3 sm:px-5 py-2 text-[10px] sm:text-xs"
                  style={{
                    borderBottom:
                      i < cols.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span className="font-mono-custom min-w-0 truncate flex-1" style={{ color: 'var(--text)' }}>
                    {col.name}
                  </span>
                  <div className="flex items-center gap-1 sm:gap-2 text-right flex-shrink-0 max-w-[50%] sm:max-w-[55%]">
                    <span className="font-mono-custom break-all" style={{ color: 'var(--text3)' }}>
                      {col.type}
                    </span>
                    {col.note && (
                      <span
                        className="font-mono-custom px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          background: 'var(--accent-glow)',
                          color: 'var(--accent2)',
                          border: '1px solid rgba(20,184,166,0.2)',
                        }}
                      >
                        {col.note}
                      </span>
                    )}
                  </div>
                </div>
              )))}
            </div>
          </SpotlightCard>
        );
        })}
      </div>
    </div>
  );
}

// ─── API Endpoints ───────────────────────────────────────────

export function ApiPanel({ blueprint }: { blueprint: Blueprint }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState<string | null>(null);
  const [consoleTab, setConsoleTab] = useState<'headers' | 'body'>('headers');

  const triggerSandboxTest = (method: string, path: string) => {
    setSandboxLoading(true);
    setSandboxResponse(null);

    // Simulate endpoint request delay
    setTimeout(() => {
      setSandboxLoading(false);
      
      // Generate realistic mock response payloads
      const lowerPath = path.toLowerCase();
      let payload: any = { success: true };

      if (lowerPath.includes('login') || lowerPath.includes('signup')) {
        payload = {
          success: true,
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmI4ZDNhNC1mNTlhLTRmMDItYmVmMC0xNmZkNDBlNTVjOGEiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE3MTU5Nzg4MDB9.s7zD_...",
          user: {
            id: "c2b8d3a4-f59a-4f02-bef0-16fd40e55c8a",
            email: "user@example.com",
            role: "user",
            created_at: new Date().toISOString()
          }
        };
      } else if (lowerPath.includes('profile') || lowerPath.includes('me')) {
        payload = {
          id: "c2b8d3a4-f59a-4f02-bef0-16fd40e55c8a",
          email: "user@example.com",
          profile: {
            first_name: "John",
            last_name: "Doe",
            avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80"
          }
        };
      } else if (lowerPath.includes('product') || lowerPath.includes('item') || lowerPath.includes('list')) {
        payload = {
          items: [
            { id: "p1", title: "Premium Leather Jacket", price: 129.99, rating: 4.8, in_stock: true },
            { id: "p2", title: "Vintage Leather Boots", price: 89.50, rating: 4.5, in_stock: true },
            { id: "p3", title: "Minimalist Leather Belt", price: 34.00, rating: 4.2, in_stock: false }
          ],
          total_count: 3
        };
      } else if (method === 'POST') {
        payload = {
          success: true,
          message: "Resource successfully created in workspace",
          id: Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toISOString()
        };
      } else if (method === 'DELETE') {
        payload = {
          success: true,
          message: "Resource successfully deleted from workspace"
        };
      } else {
        payload = {
          success: true,
          data: {
            status: "ready",
            updated_at: new Date().toISOString()
          }
        };
      }

      setSandboxResponse(JSON.stringify(payload, null, 2));
    }, 600);
  };

  const getMockRequestBody = (method: string, path: string) => {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('login') || lowerPath.includes('signin')) {
      return JSON.stringify({ email: "user@example.com", password: "••••••••" }, null, 2);
    }
    if (lowerPath.includes('signup') || lowerPath.includes('register')) {
      return JSON.stringify({ name: "John Doe", email: "user@example.com", password: "••••••••" }, null, 2);
    }
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      return JSON.stringify({ name: "Premium Leather Jacket", price: 129.99, rating: 4.8, in_stock: true }, null, 2);
    }
    return JSON.stringify({}, null, 2);
  };

  const selectedEndpoint = selectedIdx !== null ? blueprint.endpoints[selectedIdx] : null;

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Endpoints List */}
      <div className="flex-1 space-y-2">
        <SectionLabel>// api endpoints · {(blueprint.endpoints || []).length} routes</SectionLabel>
        <div className="api-endpoint-list max-h-[520px] overflow-y-auto pr-1">
          {(blueprint.endpoints || []).map((ep, i) => {
            const isSelected = selectedIdx === i;
            return (
              <button
                key={`${ep.method}-${ep.path}-${i}`}
                type="button"
                onClick={() => {
                  setSelectedIdx(i);
                  setSandboxResponse(null);
                }}
                className={`api-endpoint-card ${isSelected ? 'api-endpoint-card--selected' : ''}`}
              >
                <span className={`api-endpoint-card__method ${methodClass(ep.method)}`}>
                  {ep.method}
                </span>
                <div className="api-endpoint-card__body">
                  <span className="api-endpoint-card__path">{ep.path}</span>
                  <span className="api-endpoint-card__desc">
                    {ep.description}
                    {ep.auth && <span className="api-endpoint-card__auth">auth required</span>}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sandbox console */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col">
        <SectionLabel>// request sandbox console</SectionLabel>
        {selectedEndpoint ? (
          <SpotlightCard
            fillHeight
            className="api-sandbox-card flex h-[420px] flex-col p-5"
            spotlightColor="rgba(20, 184, 166, 0.1)"
          >
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/10">
              <span
                className="font-mono-custom text-xs font-semibold flex items-center gap-1.5"
                style={{ color: 'var(--text)' }}
              >
                <Terminal size={13} className="text-purple-400" />
                Sandbox REST Client
              </span>
              <span className="text-[9px] font-mono-custom text-green-400 bg-green-500/10 border border-green-500/25 px-1.5 py-0.5 rounded">
                SIMULATOR ONLINE
              </span>
            </div>

            {/* Request input bar */}
            <div
              className="flex items-center gap-2 p-2.5 rounded-lg bg-bg-surface2 border border-white/10 mb-3 text-xs"
              style={{ color: 'var(--text)' }}
            >
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${methodClass(selectedEndpoint.method)}`}>
                {selectedEndpoint.method}
              </span>
              <span className="break-all font-mono-custom leading-snug">{selectedEndpoint.path}</span>
            </div>

            {/* Parameter Selection Tabs */}
            <div className="flex border-b border-white/10 mb-3 text-[10px] font-mono-custom">
              <button
                type="button"
                onClick={() => setConsoleTab('headers')}
                className={`pb-1.5 px-3 border-b-2 transition-all ${
                  consoleTab === 'headers'
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent'
                }`}
                style={consoleTab !== 'headers' ? { color: 'var(--text2)' } : undefined}
              >
                Headers
              </button>
              <button
                type="button"
                onClick={() => setConsoleTab('body')}
                className={`pb-1.5 px-3 border-b-2 transition-all ${
                  consoleTab === 'body'
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent'
                }`}
                style={consoleTab !== 'body' ? { color: 'var(--text2)' } : undefined}
              >
                Body Params
              </button>
            </div>

            {/* Parameter panels */}
            <div className="flex-1 overflow-y-auto space-y-3 font-mono-custom text-xs pr-1 min-h-0">
              {consoleTab === 'headers' ? (
                <div
                  className="p-2.5 rounded-lg bg-bg-surface2 border border-white/10 space-y-1.5"
                  style={{ color: 'var(--text2)' }}
                >
                  <div className="flex justify-between gap-3">
                    <span style={{ color: 'var(--text)' }}>Content-Type</span>
                    <span>application/json</span>
                  </div>
                  {selectedEndpoint.auth && (
                    <div className="flex justify-between gap-3">
                      <span style={{ color: 'var(--text)' }}>Authorization</span>
                      <span className="text-amber-300 break-all">Bearer eyJhbGciOiJIUzI1NiIsInR5c...</span>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="p-2.5 rounded-lg bg-black/50 border border-white/10 text-purple-200 overflow-x-auto text-[11px] leading-normal max-h-[120px] scrollbar-none">
                  {getMockRequestBody(selectedEndpoint.method, selectedEndpoint.path)}
                </pre>
              )}

              {/* Action Trigger Button */}
              <button
                onClick={() => triggerSandboxTest(selectedEndpoint.method, selectedEndpoint.path)}
                disabled={sandboxLoading}
                className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white rounded-lg font-display text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-purple-400/20"
              >
                {sandboxLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin-slow" />
                    Executing Request...
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    Send Mock Request
                  </>
                )}
              </button>

              {/* Response window with full metadata badges */}
              {(sandboxResponse || sandboxLoading) && (
                <div className="space-y-1.5">
                  <div
                    className="flex items-center justify-between text-[10px] uppercase tracking-wider"
                    style={{ color: 'var(--text2)' }}
                  >
                    <span>Response Payload</span>
                    {!sandboxLoading && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-bold bg-green-500/5 px-1 py-0.5 rounded border border-green-500/10">200 OK</span>
                        <span className="text-blue-400 bg-blue-500/5 px-1 py-0.5 rounded border border-blue-500/10">14ms</span>
                      </div>
                    )}
                  </div>
                  <pre className="p-2.5 rounded-lg bg-black/60 border border-white/10 text-green-400 text-[11px] overflow-auto max-h-[140px] scrollbar-thin leading-relaxed">
                    {sandboxLoading ? (
                      <span style={{ color: 'var(--text2)' }}>Waiting for response from simulator...</span>
                    ) : (
                      sandboxResponse
                    )}
                  </pre>
                </div>
              )}
            </div>
          </SpotlightCard>
        ) : (
          <SpotlightCard
            fillHeight
            className="api-sandbox-card flex h-[420px] flex-col items-center justify-center p-8 text-center"
            spotlightColor="rgba(20, 184, 166, 0.05)"
          >
            <Terminal size={28} className="mb-3 text-purple-400/80" />
            <p className="text-sm leading-relaxed max-w-[16rem]" style={{ color: 'var(--text2)' }}>
              Select an endpoint from the routes list on the left to run mock API sandbox tests and inspect
              response JSON objects.
            </p>
          </SpotlightCard>
        )}
      </div>
    </div>
  );
}

// ─── UI Screens ──────────────────────────────────────────────

export function UiPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div>
      <SectionLabel>// ui screens · {(blueprint.screens || []).length} screens</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(blueprint.screens || []).map((screen) => (
          <Card key={screen.name}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--accent2)',
              }}
            >
              {emojiToIcon(screen.icon, 20)}
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
  const architecture = blueprint.architecture || {};
  const layers = [
    { label: 'Frontend', value: architecture.frontend || 'React' },
    { label: 'Backend', value: architecture.backend || 'Node' },
    { label: 'Database', value: architecture.database || 'PostgreSQL' },
    { label: 'Auth', value: architecture.auth || 'JWT' },
    { label: 'Hosting', value: architecture.hosting || 'Railway' },
  ];
  const flowSteps = resolveFlowSteps(architecture.flow || '', {
    frontend: architecture.frontend || '',
    backend: architecture.backend || '',
    database: architecture.database || '',
  });

  return (
    <div>
      <SectionLabel>// system architecture</SectionLabel>

      {/* Tech stack grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {layers.map(({ label, value }) => (
          <SpotlightCard
            key={label}
            className="p-4"
            spotlightColor="rgba(15, 118, 110, 0.12)"
          >
            <div className="font-mono-custom text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text2)' }}>
              {label}
            </div>
            <div className="text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
              {value}
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Request flow */}
      <Card>
        <SectionLabel>// request telemetry flow</SectionLabel>

        <div className="arch-flow-track">
          <div className="arch-flow-row">
            {flowSteps.map((step, i) => (
              <React.Fragment key={`${step}-${i}`}>
                <div className="arch-flow-step">
                  <div className="arch-flow-step__index">0{i + 1}</div>
                  <div className="arch-flow-step__title">{step}</div>
                  <div className="arch-flow-step__role">{flowStepRole(i, flowSteps.length)}</div>
                </div>

                {i < flowSteps.length - 1 && (
                  <div className="arch-flow-connector" aria-hidden>
                    <svg viewBox="0 0 48 24" fill="none" className="arch-flow-connector__svg">
                      <path d="M0 12h40" stroke="rgba(124, 255, 103, 0.2)" strokeWidth="2" strokeLinecap="round" />
                      <path
                        d="M0 12h40"
                        stroke="var(--green)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="animate-svg-pulse"
                      />
                      <polygon points="38,8 48,12 38,16" fill="var(--green)" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Starter Code ────────────────────────────────────────────

export function CodePanel({
  blueprint,
  onRefineMessage,
  isRefining,
}: {
  blueprint: Blueprint;
  onRefineMessage?: (msg: string) => void;
  isRefining?: boolean;
}) {
  return (
    <div>
      <CodeStudio
        blueprint={blueprint}
        onRefineMessage={onRefineMessage}
        isRefining={isRefining}
      />
    </div>
  );
}

// ─── Effort ──────────────────────────────────────────────────

export function EffortPanel({ blueprint }: { blueprint: Blueprint }) {
  const effort = blueprint.effort || {};
  const complexity = blueprint.complexity || 'Medium';
  const cards = [
    { label: 'Timeline', value: effort.time || '3-4 weeks', icon: Calendar, color: 'text-purple-400' },
    { label: 'Complexity', value: effort.complexity || 'Medium', icon: Zap, color: 'text-amber-400' },
    { label: 'Est. Cost', value: effort.cost || 'N/A', icon: DollarSign, color: 'text-green-400' },
    { label: 'Team Size', value: effort.team || '1-2 developers', icon: Users, color: 'text-blue-400' },
  ];

  const milestones = [
    {
      phase: 'Phase 1: Database & Architecture Setup',
      weeks: 'Week 1',
      desc: 'Set up database schema, index parameters, Docker configurations, and deploy relational structures.',
      tasks: ['Database provisioning', 'Prisma/SQL integration', 'Environment configurations setup'],
      status: 'completed'
    },
    {
      phase: 'Phase 2: Authentication & Core APIs Development',
      weeks: 'Week 2',
      desc: 'Wire up REST endpoint routes, implement JWT access/refresh token system, and map bcrypt hashes.',
      tasks: ['User login & registration API', 'Secure route guards', 'Integrations & payments config'],
      status: 'current'
    },
    {
      phase: 'Phase 3: UI Pages & Components Assembly',
      weeks: 'Week 3',
      desc: 'Construct dashboard views, catalog pages, payment flow dialogs, and setup React router.',
      tasks: ['Tailwind layout framework', 'State manager query hook integration', 'Responsive panels test'],
      status: 'pending'
    },
    {
      phase: 'Phase 4: QA testing, Audits & Launching',
      weeks: 'Week 4',
      desc: 'Review security policies, run rate limiting tests, optimize SQL indexing, and deploy production.',
      tasks: ['Security validation suite', 'Vercel & Render build pipelines', 'Self-correcting code checks'],
      status: 'pending'
    }
  ];

  return (
    <div className="space-y-6">
      <SectionLabel>// effort estimation & timeline planning</SectionLabel>

      {/* Complexity badge */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-full border font-medium ${complexityColor(complexity)}`}
        >
          <span>System Complexity:</span>
          <strong>{complexity}</strong>
        </span>
      </div>

      {/* Effort metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <SpotlightCard
            key={label}
            className="p-5"
            spotlightColor="rgba(20, 184, 166, 0.12)"
          >
            <div
              className="font-mono-custom text-[10px] uppercase tracking-widest mb-2.5 flex items-center gap-1.5 text-muted-foreground"
            >
              <Icon size={14} className={color} />
              <span>{label}</span>
            </div>
            <div
              className={`font-display font-bold text-lg leading-snug text-white`}
            >
              {value}
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Roadmap milestones */}
      <SpotlightCard className="p-6 mt-6" spotlightColor="rgba(94, 234, 212, 0.1)">
        <div className="font-mono-custom text-xs uppercase tracking-widest mb-6 text-muted-foreground">
          // project implementation roadmap
        </div>

        <div className="relative border-l border-white/10 pl-6 ml-3 space-y-8">
          {milestones.map((m, i) => {
            const isDone = m.status === 'completed';
            const isCurrent = m.status === 'current';

            return (
              <div key={i} className="relative group">
                {/* Node icon */}
                <div
                  className={`absolute -left-[35px] top-1.5 w-[18px] h-[18px] rounded-full border flex items-center justify-center text-[9px] transition-all duration-300 ${
                    isDone
                      ? 'bg-green-500 border-green-400 text-white shadow-lg shadow-green-500/20'
                      : isCurrent
                      ? 'bg-purple-500 border-purple-400 text-white animate-pulse shadow-lg shadow-purple-500/20'
                      : 'bg-bg-surface border-white/20 text-muted-foreground'
                  }`}
                >
                  {isDone ? '✓' : isCurrent ? '•' : ''}
                </div>

                {/* Milestone details */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-display font-bold text-sm text-white">
                      {m.phase}
                    </h4>
                    <span className="font-mono-custom text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground">
                      {m.weeks}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                    {m.desc}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {m.tasks.map((task, idx) => (
                      <span
                        key={idx}
                        className="font-mono-custom text-[10px] px-2 py-0.5 rounded bg-bg-surface2 border border-white/5 text-muted-foreground hover:text-white transition-colors"
                      >
                        - {task}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SpotlightCard>
    </div>
  );
}
