import { getLLMProvider, getAgentMaxTokensForModel } from '../llm/router';
import type { Blueprint, UiScreen, SchemaTable } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function screenIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('dashboard') || n.includes('home') || n.includes('overview')) return '📊';
  if (n.includes('user') || n.includes('profile') || n.includes('account'))    return '👤';
  if (n.includes('setting') || n.includes('config') || n.includes('prefer'))   return '⚙️';
  if (n.includes('report') || n.includes('analytic') || n.includes('stat'))    return '📈';
  if (n.includes('message') || n.includes('chat') || n.includes('inbox'))      return '💬';
  if (n.includes('order') || n.includes('checkout') || n.includes('payment'))  return '🛒';
  if (n.includes('product') || n.includes('catalog') || n.includes('item'))    return '📦';
  if (n.includes('calendar') || n.includes('schedule') || n.includes('event')) return '📅';
  if (n.includes('search'))                                                     return '🔍';
  if (n.includes('login') || n.includes('auth') || n.includes('sign'))         return '🔐';
  return '📄';
}

function pickAccent(appName: string): { hex: string; rgb: string; light: string } {
  const palettes = [
    { hex: '#7c3aed', rgb: '124,58,237',  light: '#a78bfa' },
    { hex: '#0ea5e9', rgb: '14,165,233',  light: '#38bdf8' },
    { hex: '#10b981', rgb: '16,185,129',  light: '#34d399' },
    { hex: '#f59e0b', rgb: '245,158,11',  light: '#fcd34d' },
    { hex: '#ec4899', rgb: '236,72,153',  light: '#f9a8d4' },
    { hex: '#6366f1', rgb: '99,102,241',  light: '#a5b4fc' },
    { hex: '#14b8a6', rgb: '20,184,166',  light: '#5eead4' },
    { hex: '#ef4444', rgb: '239,68,68',   light: '#fca5a5' },
  ];
  let hash = 0;
  for (let i = 0; i < appName.length; i++) hash = (hash * 31 + appName.charCodeAt(i)) & 0xffffffff;
  return palettes[Math.abs(hash) % palettes.length];
}

function mockRows(table: SchemaTable, count = 5): string {
  const firstName = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];
  const lastName  = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
  const words     = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
  const statuses  = ['Active', 'Pending', 'Completed', 'Archived', 'Draft'];
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const cells = table.columns.slice(0, 6).map(col => {
      const n = col.name.toLowerCase();
      if (n.includes('email'))   return `${firstName[i % 8].toLowerCase()}@example.com`;
      if (n.includes('name') && !n.includes('table')) return `${firstName[i % 8]} ${lastName[i % 7]}`;
      if (n.includes('title') || n.includes('label')) return `${words[i % 10]} ${words[(i + 3) % 10]}`;
      if (n.includes('status'))  return statuses[i % statuses.length];
      if (n.includes('date') || n.includes('at'))     return `2025-0${(i % 9) + 1}-${10 + i}`;
      if (n.includes('price') || n.includes('amount') || n.includes('cost')) return `$${(i + 1) * 24}.99`;
      if (n.includes('count') || n.includes('qty'))   return String((i + 1) * 7);
      if (n === 'id' || n.endsWith('_id')) return String(1000 + i + 1);
      return `Item ${i + 1}`;
    });
    rows.push(`<tr class="border-b border-white/5 hover:bg-white/5 transition-colors">${cells.map(c => `<td class="px-4 py-3 text-sm text-gray-300">${escHtml(c)}</td>`).join('')}</tr>`);
  }
  return rows.join('\n');
}

type ScreenKind = 'dashboard' | 'list' | 'form' | 'profile' | 'settings' | 'auth' | 'generic';
function classifyScreen(screen: UiScreen): ScreenKind {
  const n = (screen.name + ' ' + screen.components).toLowerCase();
  if (n.includes('dashboard') || n.includes('overview') || n.includes('analytics')) return 'dashboard';
  if (n.includes('login') || n.includes('signup') || n.includes('register'))        return 'auth';
  if (n.includes('setting') || n.includes('config') || n.includes('preference'))    return 'settings';
  if (n.includes('profile') || n.includes('account'))                               return 'profile';
  if (n.includes('form') || n.includes('create') || n.includes('edit'))             return 'form';
  if (n.includes('list') || n.includes('table') || n.includes('grid'))              return 'list';
  return 'generic';
}

function renderDashboard(blueprint: Blueprint, accent: ReturnType<typeof pickAccent>): string {
  const stats = [
    { label: 'Total Users', value: '1,284', change: '+12%' },
    { label: 'Active Today', value: '347', change: '+5%' },
    { label: 'Revenue', value: '$8,942', change: '+23%' },
    { label: 'Open Issues', value: '18', change: '-3' },
  ];
  const firstTable = blueprint.schema?.[1] || blueprint.schema?.[0];
  const tableHtml = firstTable ? `
    <div style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;margin-top:20px;">
      <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:600;color:#fff;">Recent ${escHtml(firstTable.table)}</span>
        <span style="font-size:11px;padding:2px 10px;border-radius:99px;background:rgba(${accent.rgb},0.15);color:${accent.light};">View all</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06);">${firstTable.columns.slice(0,5).map(c => `<th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">${escHtml(c.name)}</th>`).join('')}</tr></thead>
        <tbody>${mockRows(firstTable, 4)}</tbody>
      </table>
    </div>` : '';

  return `
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin-bottom:20px;">Dashboard</h1>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      ${stats.map(s => `
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:16px;">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${s.label}</div>
          <div style="font-size:24px;font-weight:700;color:#fff;">${s.value}</div>
          <div style="font-size:11px;color:${accent.light};margin-top:2px;">${s.change} vs last month</div>
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
      <div style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:16px;">
        <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:12px;">Activity Overview</div>
        <div style="display:flex;align-items:flex-end;gap:6px;height:80px;">
          ${[40,65,45,80,60,90,70].map((h, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:100%;border-radius:4px 4px 0 0;height:${h}%;background:rgba(${accent.rgb},${i===6?'0.9':'0.35'});transition:.2s;"></div><span style="font-size:9px;color:#4b5563;">${['M','T','W','T','F','S','S'][i]}</span></div>`).join('')}
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:16px;">
        <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:10px;">Quick Actions</div>
        ${(blueprint.features?.core || []).slice(0, 4).map(f => `
          <div style="padding:8px 12px;border-radius:8px;margin-bottom:6px;font-size:12px;color:#d1d5db;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);">+ ${escHtml(f)}</div>`).join('')}
      </div>
    </div>
    ${tableHtml}`;
}

function renderList(blueprint: Blueprint, screen: UiScreen): string {
  const screenName = screen.name.toLowerCase();
  const table = blueprint.schema?.find(t => screenName.includes(t.table.toLowerCase().replace(/s$/, '')))
             || blueprint.schema?.find(t => t.table !== 'users')
             || blueprint.schema?.[0];
  if (!table) return renderGeneric(screen);
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h1 style="font-size:22px;font-weight:700;color:#fff;">${escHtml(screen.name)}</h1>
      <button style="padding:8px 16px;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;">+ Add New</button>
    </div>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.08);padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <span style="color:#6b7280;">🔍</span>
      <span style="font-size:13px;color:#4b5563;">Search ${escHtml(table.table)}...</span>
    </div>
    <div style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06);">${table.columns.slice(0,5).map(c => `<th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">${escHtml(c.name)}</th>`).join('')}<th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Actions</th></tr></thead>
        <tbody>${mockRows(table, 7)}</tbody>
      </table>
    </div>`;
}

function renderForm(screen: UiScreen, blueprint: Blueprint): string {
  const table = blueprint.schema?.find(t => t.table !== 'users') || blueprint.schema?.[0];
  const fields = table?.columns.filter(c => !['id'].includes(c.name) && !c.name.endsWith('_id') && !c.name.includes('created') && !c.name.includes('updated')).slice(0, 5) || [];
  return `
    <div style="max-width:480px;margin:0 auto;">
      <h1 style="font-size:22px;font-weight:700;color:#fff;margin-bottom:6px;">${escHtml(screen.name)}</h1>
      <p style="font-size:13px;color:#6b7280;margin-bottom:20px;">${escHtml(screen.components.split(',')[0] || '')}</p>
      <div style="background:rgba(255,255,255,0.04);border-radius:14px;border:1px solid rgba(255,255,255,0.08);padding:24px;">
        ${fields.map(f => {
          const isTextarea = f.type.toLowerCase().includes('text') || f.name.toLowerCase().includes('desc') || f.name.toLowerCase().includes('note');
          const label = f.name.replace(/_/g, ' ');
          return `<div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">${escHtml(label)}</label>
            ${isTextarea
              ? `<textarea style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:13px;color:#d1d5db;resize:none;height:72px;outline:none;font-family:inherit;" placeholder="Enter ${escHtml(label)}..."></textarea>`
              : `<input style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:13px;color:#d1d5db;outline:none;" type="text" placeholder="Enter ${escHtml(label)}..." />`}
          </div>`;
        }).join('')}
        <div style="display:flex;gap:10px;margin-top:8px;">
          <button style="flex:1;padding:10px;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;">Save</button>
          <button style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);color:#d1d5db;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,0.1);cursor:pointer;">Cancel</button>
        </div>
      </div>
    </div>`;
}

function renderAuth(screen: UiScreen, appName: string, accent: ReturnType<typeof pickAccent>): string {
  const isLogin = screen.name.toLowerCase().includes('login') || screen.name.toLowerCase().includes('sign in');
  return `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100%;padding:40px 0;">
      <div style="width:100%;max-width:360px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="width:52px;height:52px;border-radius:14px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;margin:0 auto 14px;">${escHtml((appName || 'A')[0])}</div>
          <h1 style="font-size:22px;font-weight:700;color:#fff;">${isLogin ? 'Welcome back' : 'Create account'}</h1>
          <p style="font-size:13px;color:#6b7280;margin-top:4px;">${isLogin ? `Sign in to ${escHtml(appName)}` : `Join ${escHtml(appName)} today`}</p>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:14px;border:1px solid rgba(255,255,255,0.08);padding:24px;">
          ${!isLogin ? `<div style="margin-bottom:14px;"><label style="display:block;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Full Name</label><input style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:13px;color:#d1d5db;outline:none;" placeholder="Jane Smith" /></div>` : ''}
          <div style="margin-bottom:14px;"><label style="display:block;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Email</label><input style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:13px;color:#d1d5db;outline:none;" type="email" placeholder="you@example.com" /></div>
          <div style="margin-bottom:20px;"><label style="display:block;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Password</label><input style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:13px;color:#d1d5db;outline:none;" type="password" placeholder="••••••••" /></div>
          <button style="width:100%;padding:10px;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;">${isLogin ? 'Sign in' : 'Create account'}</button>
        </div>
      </div>
    </div>`;
}

function renderSettings(blueprint: Blueprint): string {
  const fields = ['Display Name', 'Email Address', 'Bio', 'Timezone'];
  return `
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin-bottom:20px;">Settings</h1>
    <div style="display:grid;grid-template-columns:180px 1fr;gap:20px;">
      <div>
        ${['Profile', 'Notifications', 'Security', 'Billing'].map((l, i) => `
          <div style="padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;margin-bottom:4px;${i===0?'background:var(--accent-dim);color:#fff;font-weight:600;border-left:2px solid var(--accent);':'color:#9ca3af;'}">${l}</div>`).join('')}
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:14px;border:1px solid rgba(255,255,255,0.08);padding:24px;">
        <h2 style="font-size:15px;font-weight:600;color:#fff;margin-bottom:18px;">Profile Settings</h2>
        ${fields.map(f => `
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">${f}</label>
            <input style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:13px;color:#d1d5db;outline:none;" type="text" placeholder="${f}" />
          </div>`).join('')}
        <button style="padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;margin-top:4px;">Save Changes</button>
      </div>
    </div>`;
}

function renderProfile(): string {
  return `
    <div style="max-width:600px;margin:0 auto;">
      <div style="background:rgba(255,255,255,0.04);border-radius:14px;border:1px solid rgba(255,255,255,0.08);padding:24px;margin-bottom:16px;display:flex;align-items:center;gap:20px;">
        <div style="width:72px;height:72px;border-radius:14px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff;flex-shrink:0;">JS</div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#fff;">Jane Smith</div>
          <div style="font-size:13px;color:#6b7280;">jane@example.com</div>
          <div style="margin-top:8px;display:flex;gap:6px;">
            <span style="font-size:11px;padding:2px 10px;border-radius:99px;background:var(--accent-dim);color:var(--accent-light);border:1px solid var(--accent-border);">Admin</span>
            <span style="font-size:11px;padding:2px 10px;border-radius:99px;background:rgba(16,185,129,0.15);color:#34d399;">Active</span>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        ${['Projects', 'Tasks', 'Activity'].map((l, i) => `
          <div style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#fff;">${[12,47,203][i]}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">${l}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderGeneric(screen: UiScreen): string {
  const items = screen.components.split(',').filter(Boolean).slice(0, 6);
  return `
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin-bottom:6px;">${escHtml(screen.name)}</h1>
    <p style="font-size:13px;color:#6b7280;margin-bottom:20px;">${escHtml(screen.components.split(',')[0] || '')}</p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      ${items.map((item, i) => `
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:20px;">
          <div style="font-size:13px;font-weight:500;color:#fff;margin-bottom:10px;">${escHtml(item.trim())}</div>
          <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="height:100%;border-radius:3px;background:var(--accent);width:${30 + (i * 13) % 60}%;"></div></div>
        </div>`).join('')}
    </div>`;
}

// ─── Main Deterministic Builder ────────────────────────────────────────────────

export function buildDeterministicPreview(blueprint: Blueprint): string {
  const accent = pickAccent(blueprint.appName || 'App');
  const screens = blueprint.screens || [];

  const navItems = screens.map((s, i) => ({
    id: `screen-${i}`,
    label: s.name,
    icon: screenIcon(s.name),
    kind: classifyScreen(s),
    screen: s,
  }));

  const screenContents = navItems.map(item => {
    let content = '';
    switch (item.kind) {
      case 'dashboard': content = renderDashboard(blueprint, accent); break;
      case 'list':      content = renderList(blueprint, item.screen); break;
      case 'form':      content = renderForm(item.screen, blueprint); break;
      case 'auth':      content = renderAuth(item.screen, blueprint.appName, accent); break;
      case 'settings':  content = renderSettings(blueprint); break;
      case 'profile':   content = renderProfile(); break;
      default:          content = renderGeneric(item.screen);
    }
    return `<div id="${item.id}" class="screen" style="display:none;height:100%;">${content}</div>`;
  }).join('\n');

  const apiEndpoints = (blueprint.endpoints || []).slice(0, 10).map(ep => {
    const colours: Record<string, string> = { GET:'#34d399', POST:'#60a5fa', PUT:'#fbbf24', PATCH:'#a78bfa', DELETE:'#f87171' };
    const c = colours[ep.method] || '#9ca3af';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-size:10px;font-weight:700;width:52px;text-align:center;padding:2px 0;border-radius:4px;color:${c};background:${c}22;">${ep.method}</span>
      <span style="font-family:monospace;font-size:12px;color:#d1d5db;">${escHtml(ep.path)}</span>
      <span style="font-size:11px;color:#6b7280;margin-left:auto;">${escHtml(ep.description)}</span>
    </div>`;
  }).join('');

  const sidebarItems = navItems.map(item => `
    <button class="nav-btn" data-target="${item.id}" onclick="activate('${item.id}',this)" style="width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;font-size:13px;color:#9ca3af;background:none;border:none;cursor:pointer;text-align:left;transition:all .15s;">
      <span>${item.icon}</span><span>${escHtml(item.label)}</span>
    </button>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escHtml(blueprint.appName)} — Preview</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
:root{--accent:${accent.hex};--accent-light:${accent.light};--accent-dim:rgba(${accent.rgb},.15);--accent-border:rgba(${accent.rgb},.3);}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0d0f;color:#e5e7eb;height:100vh;overflow:hidden;display:flex;flex-direction:column;}
.nav-btn:hover{background:rgba(255,255,255,.05)!important;color:#fff!important;}
.nav-btn.active{background:var(--accent-dim)!important;color:#fff!important;border-left:2px solid var(--accent);padding-left:10px;}
.screen{animation:fi .2s ease;}
@keyframes fi{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px;}
</style>
</head>
<body>
<header style="background:#111113;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;padding:0 16px;height:48px;gap:10px;flex-shrink:0;z-index:10;">
  <div style="width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;">${escHtml((blueprint.appName||'A')[0])}</div>
  <span style="font-size:14px;font-weight:600;color:#fff;">${escHtml(blueprint.appName)}</span>
  <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--accent-dim);color:var(--accent-light);border:1px solid var(--accent-border);margin-left:2px;">BuildX Preview</span>
  <div style="margin-left:auto;width:28px;height:28px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;">JS</div>
</header>
<div style="display:flex;flex:1;overflow:hidden;">
  <aside style="width:196px;flex-shrink:0;background:#111113;border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;padding:12px 8px;gap:2px;overflow-y:auto;">
    <div style="padding:4px 8px 8px;font-size:10px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:.08em;">Navigation</div>
    ${sidebarItems}
    <div style="margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);">
      <div style="padding:4px 8px 6px;font-size:10px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:.08em;">System</div>
      <button class="nav-btn" data-target="screen-api" onclick="activate('screen-api',this)" style="width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;font-size:13px;color:#9ca3af;background:none;border:none;cursor:pointer;text-align:left;">
        <span>🔌</span><span>API Endpoints</span>
      </button>
    </div>
  </aside>
  <main style="flex:1;overflow-y:auto;padding:24px;background:#0a0a0c;">
    ${screenContents}
    <div id="screen-api" class="screen" style="display:none;">
      <h1 style="font-size:22px;font-weight:700;color:#fff;margin-bottom:6px;">API Endpoints</h1>
      <p style="font-size:13px;color:#6b7280;margin-bottom:20px;">${blueprint.endpoints?.length||0} routes</p>
      <div style="background:rgba(255,255,255,.04);border-radius:12px;border:1px solid rgba(255,255,255,.08);padding:16px;">
        ${apiEndpoints||'<p style="font-size:13px;color:#6b7280;">No endpoints defined</p>'}
      </div>
    </div>
  </main>
</div>
<script>
function activate(id,btn){
  document.querySelectorAll('.screen').forEach(el=>el.style.display='none');
  document.querySelectorAll('.nav-btn').forEach(b=>{b.classList.remove('active');b.style.paddingLeft='12px';});
  var el=document.getElementById(id);
  if(el)el.style.display='block';
  if(btn){btn.classList.add('active');}
}
(function(){var first=document.querySelector('.nav-btn[data-target]');if(first)first.click();})();
</script>
</body>
</html>`;
}

// ─── Dynamic React Application Sandbox Runner ────────────────────────────────

export function buildDynamicRunner(blueprint: Blueprint, files: any[]): string {
  const accent = pickAccent(blueprint.appName || 'App');
  const cleanFiles = files
    .filter(f => f.path !== 'preview.html')
    .map(f => ({ path: f.path, content: f.content }));

  const lucideReactComponentScript = `
    const LucideReact = new Proxy({}, {
      get(target, name) {
        return function IconComponent(props) {
          const lower = name.toLowerCase();
          const iconData = window.lucide?.icons?.[lower] 
                        || window.lucide?.icons?.[name] 
                        || window.lucide?.[name];
          if (!iconData) {
            return React.createElement('span', { style: { display: 'inline-block', width: props.size || '1em', height: props.size || '1em' } }, '▫️');
          }
          const [tag, attrs, children] = iconData;
          const combinedAttrs = {
            ...attrs,
            width: props.size || props.width || 24,
            height: props.size || props.height || 24,
            stroke: props.color || attrs.stroke || 'currentColor',
            strokeWidth: props.strokeWidth || attrs['stroke-width'] || 2,
            className: props.className || '',
            dangerouslySetInnerHTML: {
              __html: children.map(([ctag, cattrs]) => {
                const attrStr = Object.entries(cattrs).map(([k,v]) => \`\${k}="\${v}"\`).join(' ');
                return \`<\${ctag} \${attrStr}></\${ctag}>\`;
              }).join('')
            }
          };
          return React.createElement('svg', combinedAttrs);
        };
      }
    });
    window.LucideReact = LucideReact;
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(blueprint.appName)} — Dynamic Live Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-router-dom@6.21.0/dist/umd/react-router-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js" crossorigin></script>
  <style>
    body { background-color: #0d0d0f; color: #e5e7eb; margin: 0; padding: 0; font-family: sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.__BUILDX_FILES__ = ${JSON.stringify(cleanFiles)};
    ${lucideReactComponentScript}
    Babel.registerPlugin('transform-modules-commonjs', window.Babel.availablePlugins['transform-modules-commonjs']);
  </script>
  <script>
    const modules = {};

    function normalizePath(currentDir, relativePath) {
      if (!relativePath.startsWith('.')) return relativePath;
      const parts = (currentDir + '/' + relativePath).split('/');
      const stack = [];
      for (const part of parts) {
        if (part === '' || part === '.') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
      }
      return stack.join('/');
    }

    function findFile(resolvedPath) {
      const candidates = [
        resolvedPath,
        resolvedPath + '.tsx',
        resolvedPath + '.ts',
        resolvedPath + '.jsx',
        resolvedPath + '.js',
        resolvedPath + '/index.tsx',
        resolvedPath + '/index.ts',
        resolvedPath + '/index.jsx',
        resolvedPath + '/index.js'
      ];
      for (const path of candidates) {
        const file = window.__BUILDX_FILES__.find(f => f.path === path || f.path === 'frontend/' + path || f.path === 'frontend/src/' + path);
        if (file) return file;
      }
      return null;
    }

    function createRequire(currentDir) {
      return function require(name) {
        if (name === 'react') return window.React;
        if (name === 'react-dom') return window.ReactDOM;
        if (name === 'react-dom/client') return {
          createRoot: (el) => ({
            render: (component) => {
              const root = window.ReactDOM.createRoot(el);
              root.render(component);
            }
          })
        };
        if (name === 'react-router-dom') return window.ReactRouterDOM;
        if (name === 'lucide-react') return window.LucideReact;

        const resolvedPath = normalizePath(currentDir, name);
        const file = findFile(resolvedPath);
        if (!file) {
          throw new Error('Could not find file: ' + name + ' (resolved to ' + resolvedPath + ')');
        }

        if (!modules[file.path]) {
          const exports = {};
          const module = { exports };
          modules[file.path] = { exports, loaded: false };

          let js;
          try {
            js = Babel.transform(file.content, {
              filename: file.path,
              presets: ['react', ['typescript', { isTSX: true, allExtensions: true }]],
              plugins: [['transform-modules-commonjs', { loose: true }]]
            }).code;
          } catch (e) {
            console.error('Babel compilation failed for ' + file.path + ':', e);
            throw new Error('Compilation error in ' + file.path + ': ' + e.message);
          }

          const dir = file.path.substring(0, file.path.lastIndexOf('/'));
          const exec = new Function('exports', 'require', 'module', '__filename', '__dirname', js);
          exec(exports, createRequire(dir), module, file.path, dir);

          modules[file.path].exports = module.exports;
          modules[file.path].loaded = true;
        }

        return modules[file.path].exports;
      };
    }

    window.addEventListener('error', function(e) {
      document.getElementById('root').innerHTML = \`
        <div style="padding: 24px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; margin: 20px; font-family: monospace;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 700;">Live Preview Execution Error</h3>
          <p style="font-size: 14px; margin: 10px 0;">\${e.message}</p>
          <pre style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 11px; overflow-x: auto; margin: 0;">\${e.error?.stack || ''}</pre>
        </div>
      \`;
    });

    try {
      const entry = findFile('frontend/src/main') || findFile('frontend/src/App');
      if (entry) {
        console.log('Mounting entry point:', entry.path);
        const dir = entry.path.substring(0, entry.path.lastIndexOf('/'));
        createRequire(dir)('./' + entry.path.substring(entry.path.lastIndexOf('/') + 1));
      } else {
        document.getElementById('root').innerHTML = \`
          <div style="padding: 24px; color: #a78bfa; text-align: center;">
            <p>No React entry point found (expected frontend/src/main.tsx or App.tsx).</p>
          </div>
        \`;
      }
    } catch (e) {
      window.dispatchEvent(new ErrorEvent('error', { error: e, message: e.message }));
    }
  </script>
</body>
</html>`;
}

// ─── AI-Enhanced Preview Prompt ────────────────────────────────────────────────

const PREVIEW_SYSTEM_PROMPT = `You are BuildX Preview Generator — a world-class frontend developer specializing in self-contained HTML previews.

CRITICAL RULES:
1. Output ONLY raw HTML. Start with <!DOCTYPE html> — zero text before it.
2. ZERO markdown fences — no triple backticks anywhere.
3. Use ONLY vanilla JavaScript and inline CSS — NO React, NO JSX, NO Babel.
4. Load Tailwind via: <script src="https://cdn.tailwindcss.com"></script>
5. All navigation/tab-switching must use plain JS onclick handlers.
6. Inject all mock data as inline JS constants — no fetch() calls.
7. Dark theme required: bg body #0d0d0f, card backgrounds rgba(255,255,255,0.04), vibrant accent colour.
8. Build a working sidebar that switches between every screen in the blueprint.
9. Each screen must show rich mock data — real-looking names, dates, numbers, statuses.`;

function buildAiPrompt(blueprint: Blueprint): string {
  return `APPLICATION: ${blueprint.appName}
DESCRIPTION: ${blueprint.description}

SCREENS (build nav + full content for each):
${(blueprint.screens||[]).map(s => `  - ${s.name}: ${s.components}`).join('\n')}

SCHEMA TABLES (use for realistic mock data):
${(blueprint.schema||[]).slice(0,4).map(t => `  - ${t.table}: [${t.columns.slice(0,5).map(c=>c.name).join(', ')}]`).join('\n')}

REQUIREMENTS:
- Pick one vibrant accent colour, use consistently (buttons, active state, badges)
- Dark sidebar #111113, main content #0a0a0c
- Cards with subtle border + border-radius
- Tables with 5+ mock rows, search bar, action buttons
- Smooth CSS transitions on hover/active states

Output the complete single-file <!DOCTYPE html> preview now:`;
}

// ─── Public API ────────────────────────────────────────────────────────────────

function isValidHtml(s: string): boolean {
  const t = s.trim().toLowerCase();
  return (t.startsWith('<!doctype html') || t.startsWith('<html')) && s.length > 500;
}

export async function generatePreviewHtml(
  blueprint: Blueprint,
  model?: string
): Promise<string> {
  const deterministicHtml = buildDeterministicPreview(blueprint);
  try {
    const provider = getLLMProvider(model);
    const maxTokens = Math.max(getAgentMaxTokensForModel(model), 8000);
    let rawText = await provider.complete([
      { role: 'system', content: PREVIEW_SYSTEM_PROMPT },
      { role: 'user',   content: buildAiPrompt(blueprint) },
    ], { temperature: 0.15, maxTokens });

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      const nl = cleaned.indexOf('\n');
      if (nl > -1) cleaned = cleaned.substring(nl + 1).trim();
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.lastIndexOf('```')).trim();
    }
    if (!isValidHtml(cleaned)) {
      console.warn('[Preview] AI output invalid — using deterministic fallback.');
      return deterministicHtml;
    }
    return cleaned;
  } catch (err: any) {
    console.warn('[Preview] AI call failed — using deterministic fallback.', err?.message);
    return deterministicHtml;
  }
}
