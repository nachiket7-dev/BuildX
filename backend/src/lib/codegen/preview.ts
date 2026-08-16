import * as ts from 'typescript';
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
(function(){
  var landingName = "${escHtml(blueprint.primaryLandingScreenId || '')}".toLowerCase();
  var targetBtn = null;
  var allBtns = Array.from(document.querySelectorAll('.nav-btn[data-target]'));
  
  if (landingName) {
    targetBtn = allBtns.find(function(b) {
      return b.textContent && b.textContent.toLowerCase().includes(landingName);
    });
  }
  if (!targetBtn) {
    targetBtn = allBtns.find(function(b) {
      var t = (b.textContent || '').toLowerCase();
      return !t.includes('login') && !t.includes('auth') && !t.includes('sign') && !t.includes('register') && !t.includes('api');
    });
  }
  if (!targetBtn && allBtns.length > 0) {
    targetBtn = allBtns[0];
  }
  if (targetBtn) {
    targetBtn.click();
  }
})();
</script>
</body>
</html>`;
}

// ─── Dynamic React Application Sandbox Runner ────────────────────────────────

export function buildDynamicRunner(blueprint: Blueprint, files: any[]): string {
  const accent = pickAccent(blueprint.appName || 'App');
  const cleanFiles = files
    .filter(f => f.path !== 'preview.html')
    .map(f => {
      let code = f.content;
      if (f.path.endsWith('.tsx') || f.path.endsWith('.ts') || f.path.endsWith('.jsx') || f.path.endsWith('.js')) {
        try {
          // Replace Vite/ESM environment variables prior to transpilation
          const preprocessed = f.content
            .replace(/import\.meta\.env\.VITE_API_URL/g, '"http://localhost:3001"')
            .replace(/import\.meta\.env\.VITE_\w+/g, '""')
            .replace(/import\.meta\.env/g, '{}')
            .replace(/import\.meta\.\w+/g, 'undefined')
            .replace(/process\.env\.\w+/g, '""');

          const transpiled = ts.transpileModule(preprocessed, {
            compilerOptions: {
              jsx: ts.JsxEmit.React,
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2020,
              esModuleInterop: true,
              allowSyntheticDefaultImports: true
            }
          });
          code = transpiled.outputText;
        } catch (e: any) {
          console.warn(`[Preview Transpile] Warning transpiling ${f.path}:`, e?.message);
        }
      }
      return { path: f.path, content: code };
    });

  const lucideReactComponentScript = `
    const LucideReact = new Proxy({}, {
      get(target, name) {
        return function IconComponent(props) {
          const lower = name.toLowerCase();
          const iconData = window.lucide?.icons?.[lower]
                        || window.lucide?.icons?.[name]
                        || window.lucide?.[name];
          if (!iconData) {
            return React.createElement('span', { style: { display: 'inline-block', width: props.size || '1em', height: props.size || '1em' } });
          }
          const arr = Array.isArray(iconData) ? iconData : [iconData.tag || 'svg', iconData.attrs || {}, iconData.children || []];
          const tag = arr[0]; const attrs = arr[1]; const children = arr[2] || [];
          const svgInner = children.map(function(child) {
            const ctag = Array.isArray(child) ? child[0] : (child.tag || 'path');
            const cattrs = Array.isArray(child) ? (child[1] || {}) : (child.attrs || {});
            const attrStr = Object.entries(cattrs).map(function(e) { return e[0] + '=' + '"' + e[1] + '"'; }).join(' ');
            return '<' + ctag + (attrStr ? ' ' + attrStr : '') + '><' + '/' + ctag + '>';
          }).join('');
          return React.createElement('svg', {
            width: props.size || props.width || 24,
            height: props.size || props.height || 24,
            viewBox: (attrs && attrs.viewBox) || '0 0 24 24',
            fill: 'none',
            stroke: props.color || (attrs && attrs.stroke) || 'currentColor',
            strokeWidth: props.strokeWidth || (attrs && attrs['stroke-width']) || 2,
            strokeLinecap: 'round', strokeLinejoin: 'round',
            className: props.className || '',
            dangerouslySetInnerHTML: { __html: svgInner }
          });
        };
      }
    });
    window.LucideReact = LucideReact;
  `;

  // Encode the clean files in base64 to avoid HTML parsing issues like early script close tags
  // and any unicode encoding or quote/escaping bugs in the generated code
  const filesJson = JSON.stringify(cleanFiles);
  const base64Files = Buffer.from(filesJson, 'utf-8').toString('base64');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(blueprint.appName)} — Dynamic Live Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@remix-run/router@1.6.2/dist/router.umd.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-router@6.11.2/dist/umd/react-router.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-router-dom@6.11.2/dist/umd/react-router-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js" crossorigin></script>
  <script>
    // Prevent double <Router> nesting crashes (UNSAFE_invariant)
    if (window.ReactRouterDOM) {
      (function() {
        function isInsideRouter() {
          try {
            var NavCtx = (window.ReactRouter && window.ReactRouter.UNSAFE_NavigationContext)
                      || (window.ReactRouterDOM && window.ReactRouterDOM.UNSAFE_NavigationContext);
            if (NavCtx && window.React && window.React.useContext) {
              var ctx = window.React.useContext(NavCtx);
              return ctx !== null && ctx !== undefined;
            }
          } catch (e) {}
          return false;
        }

        function createSafeRouterComponent(Original) {
          if (!Original) return Original;
          return function SafeRouter(props) {
            if (isInsideRouter()) {
              return props.children || null;
            }
            return window.React.createElement(Original, props);
          };
        }

        var SafeBrowserRouter = createSafeRouterComponent(window.ReactRouterDOM.BrowserRouter);
        var SafeHashRouter = createSafeRouterComponent(window.ReactRouterDOM.HashRouter);
        var SafeMemoryRouter = createSafeRouterComponent(window.ReactRouterDOM.MemoryRouter);
        var SafeRouter = createSafeRouterComponent(window.ReactRouterDOM.Router || (window.ReactRouter && window.ReactRouter.Router));

        window.ReactRouterDOM.BrowserRouter = SafeBrowserRouter;
        window.ReactRouterDOM.HashRouter = SafeHashRouter;
        window.ReactRouterDOM.MemoryRouter = SafeMemoryRouter;
        if (window.ReactRouterDOM.Router) window.ReactRouterDOM.Router = SafeRouter;
        if (window.ReactRouter) {
          window.ReactRouter.BrowserRouter = SafeBrowserRouter;
          window.ReactRouter.Router = SafeRouter;
        }
      })();
    }
  </script>
  <script>
    // Global error handlers — registered first so they catch everything
    window.addEventListener('error', function(e) {
      var rootEl = document.getElementById('root') || document.body;
      rootEl.innerHTML = '<div style="padding: 24px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; margin: 20px; font-family: monospace;"><h3 style="margin-top: 0; font-size: 16px; font-weight: 700;">Live Preview Execution Error</h3><p style="font-size: 14px; margin: 10px 0;">' + (e.message || '') + '</p><pre style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 11px; overflow-x: auto; margin: 0;">' + (e.error && e.error.stack || '') + '</pre></div>';
    });
    window.addEventListener('unhandledrejection', function(e) {
      var msg = (e.reason && e.reason.message) || String(e.reason) || 'Unhandled rejection';
      var stk = (e.reason && e.reason.stack) || '';
      var rootEl = document.getElementById('root') || document.body;
      rootEl.innerHTML = '<div style="padding: 24px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; margin: 20px; font-family: monospace;"><h3 style="margin-top: 0; font-size: 16px; font-weight: 700;">Live Preview Runtime Error</h3><p style="font-size: 14px; margin: 10px 0;">' + msg + '</p><pre style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 11px; overflow-x: auto; margin: 0;">' + stk + '</pre></div>';
    });
  </script>
  <style>
    body { background-color: #0d0d0f; color: #e5e7eb; margin: 0; padding: 0; font-family: sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Decode base64 to correct UTF-8 string, handling non-English/UTF-8 characters
    const decodedJson = decodeURIComponent(escape(atob("${base64Files}")));
    window.__BUILDX_FILES__ = JSON.parse(decodedJson);
    if (window.Babel) {
      Babel.registerPlugin('transform-modules-commonjs', window.Babel.availablePlugins['transform-modules-commonjs']);
    }
  </script>
  <script>
    ${lucideReactComponentScript}
  </script>
  <script>
    var modules = {};

    function deduplicateImports(code) {
      var lines = code.split(String.fromCharCode(10));
      var seenImports = {};
      var result = [];

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        if (trimmed.startsWith('import ') && (trimmed.endsWith(';') || trimmed.includes('from '))) {
          if (seenImports[trimmed]) {
            continue; // Skip exact duplicate import statement
          }
          seenImports[trimmed] = true;
        }
        result.push(line);
      }
      return result.join(String.fromCharCode(10));
    }

    function normalizePath(currentDir, relativePath) {
      if (relativePath.startsWith('@/')) {
        return 'frontend/src/' + relativePath.slice(2);
      }
      if (!relativePath.startsWith('.')) return relativePath;
      var parts = (currentDir + '/' + relativePath).split('/');
      var stack = [];
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part === '' || part === '.') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
      }
      return stack.join('/');
    }

    function findFile(resolvedPath) {
      var clean = resolvedPath;
      if (clean.indexOf('@/') === 0) clean = clean.substring(2);
      if (clean.indexOf('frontend/src/') === 0) clean = clean.substring(13);
      else if (clean.indexOf('frontend/') === 0) clean = clean.substring(9);
      var candidates = [
        resolvedPath,
        clean,
        'frontend/' + clean,
        'frontend/src/' + clean,
        resolvedPath + '.tsx', resolvedPath + '.ts', resolvedPath + '.jsx', resolvedPath + '.js',
        clean + '.tsx', clean + '.ts', clean + '.jsx', clean + '.js',
        'frontend/src/' + clean + '.tsx', 'frontend/src/' + clean + '.ts', 'frontend/src/' + clean + '.jsx', 'frontend/src/' + clean + '.js',
        resolvedPath + '/index.tsx', resolvedPath + '/index.ts',
        clean + '/index.tsx', clean + '/index.ts',
        'frontend/src/' + clean + '/index.tsx', 'frontend/src/' + clean + '/index.ts'
      ];
      for (var i = 0; i < candidates.length; i++) {
        var p = candidates[i];
        var file = window.__BUILDX_FILES__.find(function(f) { return f.path === p; });
        if (file) return file;
      }
      // Fallback: search by basename
      var base = resolvedPath.split('/').pop();
      if (base) {
        var f2 = window.__BUILDX_FILES__.find(function(f) {
          return f.path === 'frontend/src/' + base + '.tsx' || f.path === 'frontend/src/' + base + '.ts' || f.path.endsWith('/' + base + '.tsx') || f.path.endsWith('/' + base + '.ts');
        });
        if (f2) return f2;
      }
      return null;
    }

    function createRequire(currentDir) {
      return function require(name) {
        // ── Core React ──────────────────────────────────────────────────────
        if (name === 'react') return window.React;
        if (name === 'react-dom') return window.ReactDOM;
        if (name === 'react-dom/client') return {
          createRoot: function(el) {
            return { render: function(c) { var r = window.ReactDOM.createRoot(el); r.render(c); } };
          }
        };
        if (name === 'react-router-dom') return window.ReactRouterDOM;
        if (name === 'react-router') return window.ReactRouter || window.ReactRouterDOM;
        if (name === '@remix-run/router') return window.RemixRouter;
        if (name === 'lucide-react') return window.LucideReact;

        // ── Axios shim ──────────────────────────────────────────────────────
        if (name === 'axios') {
          var mockDataForUrl = function(u) {
            var lower = String(u).toLowerCase();
            if (lower.includes('doctor')) return [
              { id: 'd1', name: 'Dr. Sarah Jenkins', specialty: 'Cardiology', bio: 'Senior Cardiologist with 15+ years experience.', rating: 4.9 },
              { id: 'd2', name: 'Dr. Michael Chen', specialty: 'Neurology', bio: 'Specialist in neurological disorders and brain health.', rating: 4.8 },
              { id: 'd3', name: 'Dr. Emily Rodriguez', specialty: 'Pediatrics', bio: 'Dedicated pediatrician providing compassionate care.', rating: 4.95 }
            ];
            if (lower.includes('appointment')) return [
              { id: 'a1', doctorId: 'd1', doctor_id: 'd1', patientId: 'p1', patient_id: 'p1', date: '2026-08-01', time: '10:00:00', status: 'CONFIRMED' }
            ];
            if (lower.includes('prescription')) return [
              { id: 'pr1', doctorId: 'd1', doctor_id: 'd1', medication: 'Amoxicillin 500mg', dosage: 'Take 1 tablet every 8 hours for 7 days' }
            ];
            if (lower.includes('user') || lower.includes('auth/me') || lower.includes('me')) return { id: 'u1', email: 'demo@buildx.dev', name: 'Demo Patient', role: 'PATIENT' };
            return [];
          };
          var makeRequest = function(cfg) {
            var url = cfg.url || '/', method = (cfg.method || 'GET').toUpperCase(), data = cfg.data, hdrs = cfg.headers || {}, params = cfg.params;
            if (params) { var qs = new URLSearchParams(params).toString(); url = url + (url.includes('?') ? '&' : '?') + qs; }
            return fetch(url, { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, hdrs), body: data ? JSON.stringify(data) : undefined })
              .then(function(res) {
                if (!res.ok) throw new Error('Status ' + res.status);
                return res.json().then(function(d) { return { data: d, status: res.status, headers: {} }; });
              })
              .catch(function() {
                return { data: mockDataForUrl(url), status: 200, headers: {} };
              });
          };
          var ax = function(c) { return makeRequest(c); };
          ax.get = function(u,c){ return makeRequest(Object.assign({},c,{method:'GET',url:u})); };
          ax.post = function(u,d,c){ return makeRequest(Object.assign({},c,{method:'POST',url:u,data:d})); };
          ax.put = function(u,d,c){ return makeRequest(Object.assign({},c,{method:'PUT',url:u,data:d})); };
          ax.patch = function(u,d,c){ return makeRequest(Object.assign({},c,{method:'PATCH',url:u,data:d})); };
          ax.delete = function(u,c){ return makeRequest(Object.assign({},c,{method:'DELETE',url:u})); };
          ax.create = function(def){ def=def||{}; var i=function(c){return makeRequest(Object.assign({},def,c));}; i.get=function(u,c){return makeRequest(Object.assign({},def,c,{method:'GET',url:(def.baseURL||'')+u}));}; i.post=function(u,d,c){return makeRequest(Object.assign({},def,c,{method:'POST',url:(def.baseURL||'')+u,data:d}));}; i.interceptors={request:{use:function(){}},response:{use:function(){}}}; return i; };
          ax.interceptors = { request: { use: function(){} }, response: { use: function(){} } };
          ax.defaults = {};
          return ax;
        }

        // ── @tanstack/react-query ────────────────────────────────────────────
        if (name === '@tanstack/react-query') {
          return {
            useQuery: function() {
              var args = Array.prototype.slice.call(arguments);
              var queryKey, queryFn, opt = {};
              if (Array.isArray(args[0])) { queryKey = args[0]; queryFn = args[1]; opt = args[2] || {}; }
              else if (args[0] && typeof args[0] === 'object') { opt = args[0]; queryKey = opt.queryKey; queryFn = opt.queryFn; }
              else { queryFn = args[0]; }
              var enabled = opt.enabled !== false;
              var s1 = window.React.useState(opt.initialData || null); var data = s1[0]; var setData = s1[1];
              var s2 = window.React.useState(enabled && !opt.initialData); var isLoading = s2[0]; var setIsLoading = s2[1];
              var s3 = window.React.useState(null); var error = s3[0]; var setError = s3[1];
              window.React.useEffect(function() {
                if (!queryFn || !enabled) return;
                var active = true; setIsLoading(true);
                Promise.resolve(queryFn({ queryKey: queryKey }))
                  .then(function(res) { if (active) { setData(res); setIsLoading(false); } })
                  .catch(function(err) { if (active) { setError(err); setIsLoading(false); } });
                return function() { active = false; };
              }, [JSON.stringify(queryKey), enabled]);
              return { data: data, isLoading: isLoading, isPending: isLoading, isFetching: isLoading, isError: !!error, error: error, isSuccess: !isLoading && !error && data !== null, refetch: function(){} };
            },
            useMutation: function() {
              var args = Array.prototype.slice.call(arguments);
              var mutFn, opt = {};
              if (typeof args[0] === 'function') { mutFn = args[0]; opt = args[1] || {}; }
              else { opt = args[0] || {}; mutFn = opt.mutationFn; }
              var s1 = window.React.useState(false); var isLoading = s1[0]; var setIsLoading = s1[1];
              var s2 = window.React.useState(false); var isSuccess = s2[0]; var setIsSuccess = s2[1];
              var s3 = window.React.useState(null); var error = s3[0]; var setError = s3[1];
              var s4 = window.React.useState(null); var data = s4[0]; var setData = s4[1];
              var mutate = function(variables) {
                setIsLoading(true); setError(null); setIsSuccess(false);
                return Promise.resolve((mutFn || opt.mutationFn)(variables))
                  .then(function(res) { setData(res); setIsSuccess(true); if (opt.onSuccess) opt.onSuccess(res, variables); return res; })
                  .catch(function(err) { setError(err); if (opt.onError) opt.onError(err, variables); throw err; })
                  .finally(function() { setIsLoading(false); });
              };
              return { mutate: mutate, mutateAsync: mutate, isLoading: isLoading, isPending: isLoading, isSuccess: isSuccess, isError: !!error, error: error, data: data };
            },
            useQueryClient: function() { return { invalidateQueries: function(){}, setQueryData: function(){}, getQueryData: function(){ return null; }, prefetchQuery: function(){ return Promise.resolve(); } }; },
            QueryClient: (function() { function QC() {} QC.prototype.clear = function(){}; QC.prototype.setDefaultOptions = function(){}; QC.prototype.invalidateQueries = function(){}; QC.prototype.setQueryData = function(){}; QC.prototype.getQueryData = function(){ return null; }; return QC; })(),
            QueryClientProvider: function(props) { return props.children; },
            useInfiniteQuery: function() { return { data: null, isLoading: false, error: null, fetchNextPage: function(){}, hasNextPage: false }; },
          };
        }
        if (name === '@tanstack/react-query-devtools') return { ReactQueryDevtools: function(){ return null; } };

        // ── CSS / style files — silently ignored ─────────────────────────
        if (name.endsWith('.css') || name.endsWith('.scss') || name.endsWith('.less') || name.endsWith('.module.css')) return {};

        // ── Common utility stubs ─────────────────────────────────────────
        if (name === 'date-fns' || name.startsWith('date-fns/')) return { format: function(d){ return d ? d.toString() : ''; }, parseISO: function(s){ return new Date(s); }, isValid: function(){ return true; }, addDays: function(d,n){ return new Date(+d+n*86400000); }, formatDistanceToNow: function(){ return 'just now'; } };
        if (name === 'lodash' || name === 'lodash-es' || name.startsWith('lodash/')) return new Proxy({}, { get: function(_,k){ return typeof k==='string' ? function(a){ return a; } : undefined; } });
        if (name === 'uuid') return { v4: function(){ return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ var r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }); } };
        if (name === 'clsx' || name === 'classnames') { var cf = function(){ return Array.prototype.slice.call(arguments).flat(Infinity).filter(function(x){ return typeof x==='string'&&x; }).join(' '); }; return { default: cf, clsx: cf }; }
        if (name === 'zod') return { z: new Proxy({}, { get: function(){ return function(){ return { parse: function(x){ return x; }, safeParse: function(x){ return { success:true, data:x }; }, optional: function(){ return {}; } }; }; } }), default: {} };
        if (name === 'react-hot-toast' || name === 'sonner') { var tf = Object.assign(function(){}, { success:function(){}, error:function(){}, loading:function(){}, dismiss:function(){}, promise:function(p){return p;} }); return { default:tf, toast:tf, Toaster:function(){return null;} }; }
        if (name === 'framer-motion') return { motion: new Proxy({}, { get: function(_,tag){ return function(p){ return window.React.createElement(tag, p.style||p.className ? { style:p.style, className:p.className, onClick:p.onClick } : null, p.children); }; } }), AnimatePresence: function(p){ return p.children; } };
        if (name.startsWith('@heroicons/react') || name.startsWith('react-icons')) return new Proxy({}, { get: function(){ return function(){ return null; }; } });
        if (name === 'recharts') return new Proxy({}, { get: function(_,k){ return k==='__esModule'?true:function(){return null;}; } });
        if (name === 'react-hook-form') return { useForm: function(){ return { register:function(){return{};}, handleSubmit:function(fn){ return function(e){if(e&&e.preventDefault)e.preventDefault();fn({});};}, formState:{errors:{},isSubmitting:false}, watch:function(){return undefined;}, setValue:function(){}, reset:function(){}, control:{} }; } };
        if (name === '@hookform/resolvers' || name.startsWith('@hookform/')) return { zodResolver: function(){ return function(){ return {values:{},errors:{}}; }; } };
        if (name.startsWith('@radix-ui/')) return new Proxy({}, { get: function(){ return function(p){ return window.React.createElement(window.React.Fragment, null, p && p.children); }; } });
        if (name === 'next/router' || name === 'next/navigation') return { useRouter: function(){ return { push:function(){},replace:function(){},pathname:'/',query:{} }; }, usePathname: function(){ return '/'; }, useSearchParams: function(){ return new URLSearchParams(); } };
        if (name === 'next/link') return { default: function(p){ return window.React.createElement('a', { href:p.href, className:p.className }, p.children); } };
        if (name === 'next/image') return { default: function(p){ return window.React.createElement('img', { src:p.src, alt:p.alt, width:p.width, height:p.height, className:p.className }); } };

        // ── Local file resolution ─────────────────────────────────────────
        var resolvedPath = normalizePath(currentDir, name);
        var file = findFile(resolvedPath);
        if (!file) {
          throw new Error('Could not find file: ' + name + ' (resolved to ' + resolvedPath + ')');
        }

        if (!modules[file.path]) {
          var exports = {};
          var module = { exports: exports };
          modules[file.path] = { exports: exports, loaded: false };

          var js = file.content;
          try {
            // Skip CSS files — return empty module
            if (file.path.endsWith('.css') || file.path.endsWith('.scss') || file.path.endsWith('.less')) {
              modules[file.path].exports = {};
              modules[file.path].loaded = true;
              return modules[file.path].exports;
            }
          } catch (e) {
            console.warn('⚠️ Skipping broken file ' + file.path + ':', e.message);
            // Return a stub so dependent files don't hard-crash the entire preview.
            // The broken file will render nothing; other pages still work.
            var errMsg = e.message || String(e);
            modules[file.path].exports = {
              default: function BrokenComponent() {
                return window.React.createElement('div', {
                  style: { padding: '12px', color: '#fca5a5', background: 'rgba(239,68,68,0.08)',
                           border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
                           margin: '8px', fontFamily: 'monospace', fontSize: '11px' }
                }, '⚠️ ' + file.path + ': ' + errMsg);
              }
            };
            modules[file.path].loaded = true;
            return modules[file.path].exports;
          }

          var dir = file.path.substring(0, file.path.lastIndexOf('/'));
          var exec = new Function('exports', 'require', 'module', '__filename', '__dirname', js);
          exec(exports, createRequire(dir), module, file.path, dir);

          modules[file.path].exports = module.exports;
          modules[file.path].loaded = true;
        }

        var exp = modules[file.path].exports;
        if (typeof exp === 'object' && exp !== null && typeof Proxy !== 'undefined') {
          return new Proxy(exp, {
            get: function(target, prop) {
              if (prop in target) return target[prop];
              if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
              var p = String(prop);
              if (p.startsWith('use')) {
                return function useMockHook() {
                  return {
                    user: { id: 'demo-1', email: 'demo@buildx.dev', name: 'Demo User', role: 'ADMIN' },
                    loading: false,
                    isLoading: false,
                    login: function() { return Promise.resolve(); },
                    logout: function() {},
                    isAuthenticated: true,
                    token: 'demo-token'
                  };
                };
              }
              if (/^[A-Z]/.test(p)) {
                return function StubComponent(props) {
                  return props && props.children ? props.children : null;
                };
              }
              return undefined;
            }
          });
        }
        return exp;
      };
    }

    // ── React ErrorBoundary for sandbox ─────────────────────────────────
    function PreviewErrorBoundary(props) {
      this.props = props;
      this.state = { hasError: false, error: null };
    }
    PreviewErrorBoundary.prototype = Object.create(window.React.Component.prototype);
    PreviewErrorBoundary.prototype.constructor = PreviewErrorBoundary;
    PreviewErrorBoundary.getDerivedStateFromError = function(error) {
      return { hasError: true, error: error };
    };
    PreviewErrorBoundary.prototype.componentDidCatch = function(error, info) {
      console.error('Preview React ErrorBoundary caught:', error, info);
    };
    PreviewErrorBoundary.prototype.render = function() {
      if (this.state && this.state.hasError) {
        var err = this.state.error;
        var msg = (err && err.message) || String(err);
        var stack = (err && err.stack) || '';
        return window.React.createElement('div', {
          style: { padding: '24px', color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', margin: '20px', fontFamily: 'monospace' }
        },
          window.React.createElement('h3', { style: { marginTop: 0, fontSize: '16px', fontWeight: '700' } }, 'Live Preview Component Error'),
          window.React.createElement('p', { style: { fontSize: '14px', margin: '10px 0' } }, msg),
          window.React.createElement('pre', { style: { background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '11px', overflowX: 'auto', margin: 0 } }, stack)
        );
      }
      return this.props.children;
    };

    // Monkey-patch createRoot to wrap rendered components in PreviewErrorBoundary
    var _rootAlreadyMounted = false;
    var _origCreateRoot = window.ReactDOM.createRoot.bind(window.ReactDOM);
    window.ReactDOM.createRoot = function(el) {
      var r = _origCreateRoot(el);
      var _origRender = r.render.bind(r);
      r.render = function(component) {
        _rootAlreadyMounted = true;
        return _origRender(window.React.createElement(PreviewErrorBoundary, null, component));
      };
      return r;
    };

    try {
      var entry = findFile('frontend/src/main') || findFile('frontend/src/App');
      if (entry) {
        console.log('Mounting entry point:', entry.path);
        var dir = entry.path.substring(0, entry.path.lastIndexOf('/'));
        var entryModule = createRequire(dir)('./' + entry.path.substring(entry.path.lastIndexOf('/') + 1));
        // Auto-mount only if main.tsx did not already call createRoot().render()
        if (!_rootAlreadyMounted) {
          var AppComponent = entryModule.default || entryModule.App || entryModule;
          if (typeof AppComponent === 'function' || (AppComponent && (AppComponent.$$typeof || typeof AppComponent.render === 'function'))) {
            console.log('Auto-mounting App to #root with BrowserRouter...');
            var BrowserRouter = (window.ReactRouterDOM && window.ReactRouterDOM.BrowserRouter) || function(p) { return p.children; };
            _origCreateRoot(document.getElementById('root')).render(
              window.React.createElement(PreviewErrorBoundary, null,
                window.React.createElement(BrowserRouter, null, window.React.createElement(AppComponent))
              )
            );
          }
        }
      } else {
        document.getElementById('root').innerHTML = '<div style="padding:24px;color:#a78bfa;text-align:center"><p>No React entry point found.</p></div>';
      }
    } catch (e) {
      console.error('Mount failed:', e);
      document.getElementById('root').innerHTML = '<div style="padding: 24px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; margin: 20px; font-family: monospace;"><h3 style="margin-top: 0; font-size: 16px; font-weight: 700;">Live Preview Execution Error</h3><p style="font-size: 14px; margin: 10px 0;">' + (e.message || e) + '</p><pre style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 11px; overflow-x: auto; margin: 0;">' + (e.stack || '') + '</pre></div>';
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
