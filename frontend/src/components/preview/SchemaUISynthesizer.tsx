import { useState, useMemo } from 'react';
import { Search, ChevronDown, MoreVertical, Plus, Filter, ArrowUpRight, ArrowDownRight, Eye, Edit, Trash, FileText, Layout } from 'lucide-react';
import type { Blueprint, UiScreen, SchemaTable, SchemaColumn, ApiEndpoint } from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenKind = 'dashboard' | 'list' | 'form' | 'detail' | 'catalog' | 'settings' | 'auth' | 'generic';

interface SynthesizerProps {
  blueprint: Partial<Blueprint>;
  activeScreenId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active:    { bg: 'rgba(16,185,129,0.12)', text: '#34d399' },
  Completed: { bg: 'rgba(124, 124, 244,0.12)', text: '#B8B8FA' },
  Pending:   { bg: 'rgba(245,158,11,0.12)', text: '#fcd34d' },
  Draft:     { bg: 'rgba(161,161,170,0.12)', text: '#a1a1aa' },
  Archived:  { bg: 'rgba(239,68,68,0.12)',  text: '#fca5a5' },
};
const STATUS_KEYS = Object.keys(STATUS_COLORS);

/** Deterministic hash for consistent mock data per seed string */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

/** Produce a mock value for a column based on its name and type */
function mockValueForColumn(col: SchemaColumn, rowIndex: number): string {
  const n = col.name.toLowerCase();
  const t = (col.type || '').toLowerCase();

  if (n === 'id' || n.endsWith('_id')) return `#${(1000 + rowIndex + 1).toString()}`;
  if (n.includes('email'))  return `user${rowIndex + 1}@example.com`;
  if (n.includes('name') && !n.includes('table')) return `Entity ${String.fromCharCode(65 + (rowIndex % 26))}`;
  if (n.includes('title') || n.includes('label')) return `Item ${rowIndex + 1}`;
  if (n.includes('description') || n.includes('bio')) return `Description for record ${rowIndex + 1}`;
  if (n.includes('status') || n.includes('state')) return STATUS_KEYS[rowIndex % STATUS_KEYS.length];
  if (n.includes('date') || n.includes('_at') || n === 'created_at' || n === 'updated_at') {
    const d = new Date(2025, (rowIndex % 12), 10 + (rowIndex % 20));
    return d.toISOString().split('T')[0];
  }
  if (n.includes('price') || n.includes('amount') || n.includes('cost') || n.includes('total')) {
    return `$${((rowIndex + 1) * 24.5 + rowIndex * 3.5).toFixed(2)}`;
  }
  if (n.includes('count') || n.includes('qty') || n.includes('quantity')) return `${(rowIndex + 1) * 7}`;
  if (n.includes('rating') || n.includes('score')) return `${(3.5 + (rowIndex % 15) * 0.1).toFixed(1)}`;
  if (n.includes('url') || n.includes('link')) return `https://example.com/${rowIndex + 1}`;
  if (n.includes('phone')) return `+1 555-${String(100 + rowIndex).padStart(3, '0')}-${String(1000 + rowIndex)}`;
  if (n.includes('image') || n.includes('avatar') || n.includes('photo')) return `img_${rowIndex + 1}.png`;
  if (t.includes('bool')) return rowIndex % 2 === 0 ? 'Yes' : 'No';
  if (t.includes('int') || t.includes('number') || t.includes('float') || t.includes('decimal')) {
    return `${(rowIndex + 1) * 42}`;
  }

  return `Value ${rowIndex + 1}`;
}

/** Classify a screen by its name & components description */
function classifyScreen(screen: UiScreen): ScreenKind {
  const text = `${screen.name} ${screen.components || ''}`.toLowerCase();
  if (/login|signup|sign.?up|register|auth|onboarding|forgot.?password/.test(text)) return 'auth';
  if (/dashboard|overview|analytics|summary|metrics|statistics|home/.test(text)) return 'dashboard';
  if (/settings?|config|preference|notification/.test(text)) return 'settings';
  if (/detail|view|inspect|profile|account|info/.test(text)) return 'detail';
  if (/form|create|edit|add|new|input|submit|compose|write/.test(text)) return 'form';
  if (/list|table|grid|browse|catalog|menu|search|explore|discover|index|feed/.test(text)) return 'list';
  if (/card|gallery|collection|store|shop|catalog|portfolio/.test(text)) return 'catalog';
  return 'generic';
}

/** Fuzzy-match a screen name to the closest schema table */
function matchScreenToTable(screenName: string, tables: SchemaTable[]): SchemaTable | null {
  const sn = screenName.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Direct match
  for (const t of tables) {
    const tn = t.table.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sn.includes(tn) || tn.includes(sn)) return t;
    // Singular/plural matching
    if (sn.includes(tn.replace(/s$/, '')) || tn.replace(/s$/, '').includes(sn.replace(/s$/, ''))) return t;
  }
  // Fallback: pick the first non-user table
  return tables.find(t => !t.table.toLowerCase().includes('user') && !t.table.toLowerCase().includes('session')) || tables[0] || null;
}

/** Derive metric values from schema tables */
function deriveMetrics(tables: SchemaTable[], appName: string): Array<{ label: string; value: string; change: string; up: boolean }> {
  const h = hashSeed(appName);
  const metrics: Array<{ label: string; value: string; change: string; up: boolean }> = [];

  for (const table of tables.slice(0, 4)) {
    const name = table.table.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const hasAmount = table.columns.some(c => /price|amount|cost|total|revenue/.test(c.name.toLowerCase()));
    const base = ((h + metrics.length * 137) % 900) + 100;

    if (hasAmount) {
      metrics.push({
        label: `Total ${name}`,
        value: `$${(base * 12.5).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        change: `${(8 + (metrics.length * 3) % 15)}%`,
        up: metrics.length % 3 !== 2,
      });
    } else {
      metrics.push({
        label: `Total ${name}`,
        value: base.toLocaleString(),
        change: `${(5 + (metrics.length * 7) % 20)}%`,
        up: metrics.length % 2 === 0,
      });
    }
  }

  return metrics.length > 0 ? metrics : [
    { label: 'Total Records', value: `${((h % 500) + 200).toLocaleString()}`, change: '12%', up: true },
    { label: 'Active Items', value: `${((h % 200) + 50).toLocaleString()}`, change: '8%', up: true },
    { label: 'Processing', value: `${((h % 30) + 5).toLocaleString()}`, change: '3%', up: false },
    { label: 'Completion Rate', value: `${85 + (h % 14)}%`, change: '5%', up: true },
  ];
}

/** Parse components string into feature/component items */
function parseComponents(components: string): string[] {
  if (!components) return [];
  return components
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 80);
}

/** Pick an accent color from app name */
function pickAccent(appName: string): string {
  const palettes = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#7C7CF4', '#14b8a6', '#ef4444'];
  const h = hashSeed(appName || 'App');
  return palettes[h % palettes.length];
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

/** Status pill with auto-coloring */
function StatusPill({ value }: { value: string }) {
  const colors = STATUS_COLORS[value] || { bg: 'rgba(161,161,170,0.12)', text: '#a1a1aa' };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono"
      style={{ background: colors.bg, color: colors.text }}
    >
      {value}
    </span>
  );
}

/** Metric card */
function MetricCard({ label, value, change, up }: { label: string; value: string; change: string; up: boolean }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 hover:border-white/[0.15] transition-all group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
        <div className={`flex items-center gap-0.5 text-[10px] font-mono font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {change}
        </div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="mt-3 h-8 w-full rounded-lg overflow-hidden bg-white/[0.02]">
        <svg viewBox="0 0 120 32" className="w-full h-full" preserveAspectRatio="none">
          <path
            d={up
              ? 'M0,28 Q20,24 30,20 T60,16 T90,10 T120,4'
              : 'M0,8 Q20,12 30,16 T60,20 T90,24 T120,28'}
            stroke={up ? '#34d399' : '#f87171'}
            strokeWidth="1.5"
            fill="none"
            opacity="0.6"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Screen Renderers ─────────────────────────────────────────────────────────

/** Dashboard: metrics grid + recent activity */
function DashboardView({ tables, appName, endpoints }: { tables: SchemaTable[]; appName: string; endpoints: ApiEndpoint[] }) {
  const metrics = deriveMetrics(tables, appName);
  const recentTable = tables.find(t => t.columns.some(c => /date|_at|created/.test(c.name.toLowerCase()))) || tables[0];

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <MetricCard key={i} {...m} />
        ))}
      </div>

      {/* Recent Activity Table */}
      {recentTable && (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Recent {recentTable.table.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </h3>
            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-colors">
                <Filter size={12} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {recentTable.columns.slice(0, 6).map(col => (
                    <th key={col.name} className="px-4 py-3 text-left font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                      {col.name.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, ri) => (
                  <tr key={ri} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    {recentTable.columns.slice(0, 6).map(col => {
                      const val = mockValueForColumn(col, ri);
                      const isStatus = /status|state/.test(col.name.toLowerCase());
                      return (
                        <td key={col.name} className="px-4 py-3 text-zinc-300 font-mono">
                          {isStatus ? <StatusPill value={val} /> : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* API Endpoints Summary */}
      {endpoints.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">API Endpoints</h3>
          <div className="space-y-1.5">
            {endpoints.slice(0, 6).map((ep, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  ep.method === 'GET' ? 'bg-emerald-500/15 text-emerald-400' :
                  ep.method === 'POST' ? 'bg-indigo-500/15 text-indigo-400' :
                  ep.method === 'PUT' || ep.method === 'PATCH' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {ep.method}
                </span>
                <code className="text-[11px] text-zinc-300 font-mono">{ep.path}</code>
                <span className="text-[10px] text-zinc-500 ml-auto truncate max-w-[200px]">{ep.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Data table / List view */
function ListView({ table, screenName }: { table: SchemaTable; screenName: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const displayCols = table.columns.slice(0, 7);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">
          {screenName}
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder={`Search ${table.table.replace(/_/g, ' ')}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500/50 w-48"
            />
          </div>
          <button className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-colors">
            <Filter size={12} />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/30 transition-colors">
            <Plus size={12} />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {displayCols.map(col => (
                  <th key={col.name} className="px-4 py-3 text-left font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                    <button className="flex items-center gap-1 hover:text-zinc-200 transition-colors">
                      {col.name.replace(/_/g, ' ')}
                      <ChevronDown size={10} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, ri) => (
                <tr key={ri} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                  {displayCols.map(col => {
                    const val = mockValueForColumn(col, ri);
                    const isStatus = /status|state/.test(col.name.toLowerCase());
                    const isId = col.name === 'id' || col.name.endsWith('_id');
                    return (
                      <td key={col.name} className={`px-4 py-3 ${isId ? 'text-zinc-500 font-mono text-[10px]' : 'text-zinc-300'}`}>
                        {isStatus ? <StatusPill value={val} /> : val}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Eye size={12} /></button>
                      <button className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Edit size={12} /></button>
                      <button className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-red-400 transition-colors"><Trash size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>Showing 1-8 of 24 records</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">Prev</button>
            <button className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 font-semibold">1</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">2</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">3</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Form / Create / Edit view */
function FormView({ table, screenName }: { table: SchemaTable; screenName: string }) {
  const editableCols = table.columns.filter(c => c.name !== 'id' && !c.name.endsWith('_at'));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">{screenName}</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Fill in the details for {table.table.replace(/_/g, ' ')}
        </p>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 space-y-5">
        {editableCols.map(col => {
          const n = col.name.toLowerCase();
          const t = (col.type || '').toLowerCase();
          const label = col.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          // Boolean -> toggle
          if (t.includes('bool')) {
            return (
              <div key={col.name} className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">{label}</label>
                <button className="w-10 h-5 rounded-full bg-emerald-500/30 border border-emerald-500/40 relative transition-colors">
                  <span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-emerald-400 transition-transform" />
                </button>
              </div>
            );
          }

          // Status/state -> select
          if (n.includes('status') || n.includes('state') || n.includes('type') || n.includes('role') || n.includes('category')) {
            return (
              <div key={col.name}>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</label>
                <div className="relative">
                  <select className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none appearance-none focus:border-indigo-500/50">
                    {STATUS_KEYS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                </div>
              </div>
            );
          }

          // Text area for descriptions
          if (n.includes('description') || n.includes('bio') || n.includes('content') || n.includes('body') || n.includes('notes')) {
            return (
              <div key={col.name}>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</label>
                <textarea
                  placeholder={`Enter ${label.toLowerCase()}...`}
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none resize-none focus:border-indigo-500/50"
                />
              </div>
            );
          }

          // Default text/number input
          const inputType = (n.includes('email') ? 'email' :
            n.includes('password') ? 'password' :
            n.includes('phone') ? 'tel' :
            n.includes('url') || n.includes('link') ? 'url' :
            (t.includes('int') || t.includes('float') || t.includes('decimal') || t.includes('number') || n.includes('price') || n.includes('amount') || n.includes('qty')) ? 'number' :
            (n.includes('date') || t.includes('date') || t.includes('timestamp')) ? 'date' :
            'text');

          return (
            <div key={col.name}>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</label>
              <input
                type={inputType}
                placeholder={`Enter ${label.toLowerCase()}...`}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500/50"
              />
            </div>
          );
        })}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
          <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button className="px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-xs text-indigo-300 font-semibold hover:bg-indigo-500/30 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Detail / Profile / Inspector view */
function DetailView({ table, screenName }: { table: SchemaTable; screenName: string }) {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{screenName}</h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white transition-colors">
            <Edit size={12} />
            Edit
          </button>
          <button className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-colors">
            <MoreVertical size={12} />
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/20 flex items-center justify-center text-2xl font-bold text-indigo-300">
            {screenName.charAt(0)}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{mockValueForColumn(table.columns.find(c => c.name.toLowerCase().includes('name') || c.name.toLowerCase().includes('title')) || table.columns[1] || table.columns[0], 0)}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusPill value="Active" />
              <span className="text-[10px] font-mono text-zinc-500">
                {table.table.toUpperCase()}-#1001
              </span>
            </div>
          </div>
        </div>

        {/* Key-Value pairs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.06]">
          {table.columns.slice(0, 8).map((col) => (
            <div key={col.name} className="bg-[#0c0c10] px-4 py-3 flex items-start justify-between gap-3">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                {col.name.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-zinc-200 font-mono text-right">
                {/status|state/.test(col.name.toLowerCase())
                  ? <StatusPill value={mockValueForColumn(col, 0)} />
                  : mockValueForColumn(col, 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Auth / Login view (generic) */
function AuthView({ appName, accent }: { appName: string; accent: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white mx-auto mb-3"
            style={{ background: `${accent}33`, border: `1px solid ${accent}55` }}
          >
            {appName.charAt(0)}
          </div>
          <h2 className="text-xl font-bold text-white">Welcome back</h2>
          <p className="text-xs text-zinc-500 mt-1">Sign in to {appName}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" placeholder="you@example.com" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500/50" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Password</label>
            <input type="password" placeholder="••••••••" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500/50" />
          </div>
          <button
            className="w-full py-2.5 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
          >
            Sign In
          </button>
          <p className="text-center text-[10px] text-zinc-500">
            Don't have an account? <span className="text-indigo-400 cursor-pointer hover:underline">Sign up</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Settings view */
function SettingsView({ screenName }: { screenName: string }) {
  const sections = [
    { label: 'General', items: ['Display Name', 'Timezone', 'Language'] },
    { label: 'Notifications', items: ['Email Alerts', 'Push Notifications', 'Weekly Digest'] },
    { label: 'Privacy', items: ['Profile Visibility', 'Data Sharing', 'Two-Factor Auth'] },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-lg font-bold text-white">{screenName}</h2>
      {sections.map(section => (
        <div key={section.label} className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{section.label}</h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {section.items.map(item => (
              <div key={item} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <span className="text-xs text-zinc-300">{item}</span>
                <button className="w-9 h-5 rounded-full bg-white/10 border border-white/10 relative transition-colors">
                  <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-zinc-400 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic screen: render component descriptions as feature cards */
function GenericView({ screen, table }: { screen: UiScreen; table: SchemaTable | null }) {
  const items = parseComponents(screen.components);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">{screen.name}</h2>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 hover:border-white/[0.15] transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
                <FileText size={15} className="text-indigo-400" />
              </div>
              <h4 className="text-xs font-semibold text-white mb-1">{item}</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Interactive component for {screen.name.toLowerCase()}
              </p>
            </div>
          ))}
        </div>
      ) : table ? (
        <ListView table={table} screenName={screen.name} />
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <FileText size={22} />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">{screen.name}</h3>
          <p className="text-xs text-zinc-500">{screen.components || 'Screen content'}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Synthesizer ─────────────────────────────────────────────────────────

export function SchemaUISynthesizer({ blueprint, activeScreenId }: SynthesizerProps) {
  const screens = blueprint.screens || [];
  const tables = blueprint.schema || [];
  const endpoints = blueprint.endpoints || [];
  const appName = blueprint.appName || blueprint.title || 'App';
  const accent = pickAccent(appName);

  // Find active screen
  const activeScreen = useMemo(() => {
    if (!activeScreenId || screens.length === 0) return screens[0] || null;
    // Exact match
    const exact = screens.find(s => s.name === activeScreenId);
    if (exact) return exact;
    // Fuzzy match
    const clean = activeScreenId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return screens.find(s => s.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(clean)) || screens[0] || null;
  }, [screens, activeScreenId]);

  const [selectedScreen, setSelectedScreen] = useState<string>(activeScreen?.name || '');

  // Resolve which screen to render
  const currentScreen = useMemo(() => {
    return screens.find(s => s.name === selectedScreen) || activeScreen || screens[0] || null;
  }, [screens, selectedScreen, activeScreen]);

  const screenKind = currentScreen ? classifyScreen(currentScreen) : 'generic';
  const matchedTable = currentScreen ? matchScreenToTable(currentScreen.name, tables) : tables[0] || null;

  if (screens.length === 0 && tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-zinc-500">
            <Layout size={28} />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">No Schema Data</h3>
          <p className="text-xs text-zinc-500 max-w-xs">
            This blueprint doesn't have screen or schema definitions yet. Generate code with the AI agent to see a live preview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0A0A0B] text-zinc-100 flex flex-col">
      {/* Top navigation bar with screen tabs */}
      <header className="sticky top-0 z-20 bg-[#111113]/95 backdrop-blur-xl border-b border-white/[0.08] px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 12px ${accent}33` }}
            >
              {appName.charAt(0)}
            </div>
            <span className="text-sm font-bold text-white tracking-tight">{appName}</span>
          </div>

          {/* Screen pills */}
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none px-2">
            {screens.map(screen => (
              <button
                key={screen.name}
                onClick={() => setSelectedScreen(screen.name)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  currentScreen?.name === screen.name
                    ? 'bg-white/10 border border-white/20 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <FileText size={12} className={currentScreen?.name === screen.name ? 'text-white' : 'text-zinc-400'} />
                <span>{screen.name}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Screen content */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {currentScreen && screenKind === 'dashboard' && (
          <DashboardView tables={tables} appName={appName} endpoints={endpoints} />
        )}
        {currentScreen && screenKind === 'list' && matchedTable && (
          <ListView table={matchedTable} screenName={currentScreen.name} />
        )}
        {currentScreen && screenKind === 'catalog' && matchedTable && (
          <ListView table={matchedTable} screenName={currentScreen.name} />
        )}
        {currentScreen && screenKind === 'form' && matchedTable && (
          <FormView table={matchedTable} screenName={currentScreen.name} />
        )}
        {currentScreen && screenKind === 'auth' && (
          <AuthView appName={appName} accent={accent} />
        )}
        {currentScreen && screenKind === 'detail' && matchedTable && (
          <DetailView table={matchedTable} screenName={currentScreen.name} />
        )}
        {currentScreen && screenKind === 'settings' && (
          <SettingsView screenName={currentScreen.name} />
        )}
        {currentScreen && screenKind === 'generic' && (
          <GenericView screen={currentScreen} table={matchedTable} />
        )}
        {!currentScreen && (
          <div className="flex items-center justify-center h-64 text-zinc-500 text-xs font-mono">
            Select a screen to preview
          </div>
        )}
      </main>
    </div>
  );
}

export default SchemaUISynthesizer;
