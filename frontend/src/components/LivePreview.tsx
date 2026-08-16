import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useVFS } from '../context/VFSContext';
import { AlertCircle, Loader2, Wand2 } from 'lucide-react';
import { SchemaUISynthesizer } from './preview/SchemaUISynthesizer';
import type { LayoutParadigm, ProductArchetype, Blueprint } from '../lib/types';

type Viewport = 'desktop' | 'tablet' | 'mobile';

interface LivePreviewProps {
  files?: Record<string, string>;
  activeFilePath?: string | null;
  blueprintId?: string;
  appName?: string;
  viewport?: Viewport;
  layoutParadigm?: LayoutParadigm;
  productArchetype?: ProductArchetype;
  primaryLandingScreenId?: string;
  blueprint?: Partial<Blueprint> | null;
}

const VIEWPORTS = [
  { id: 'desktop' as Viewport, label: 'Desktop', width: '100%' },
  { id: 'tablet' as Viewport, label: 'Tablet', width: '768px' },
  { id: 'mobile' as Viewport, label: 'Mobile', width: '390px' },
];

/**
 * Infer layout paradigm from app name or file structure if not explicitly provided
 */
function inferLayoutParadigm(appName?: string, files?: Record<string, string>): LayoutParadigm {
  const text = `${appName || ''} ${Object.keys(files || {}).join(' ')}`.toLowerCase();

  if (/(food|swift|delivery|store|shop|ecom|social|fit|restaurant|market|grocery|cart|menu|dish)/i.test(text)) {
    return 'TOP_NAV_STOREFRONT';
  }
  if (/(mobile|app|ios|android|fitness|fitpal|workout|feed|chat|photo|pal|media|story|reel)/i.test(text)) {
    return 'MOBILE_EMULATOR_SHELL';
  }
  if (/(dev|console|api|infra|terminal|cluster|codepro|devconnect|telemetry|monitor|database|query)/i.test(text)) {
    return 'SPLIT_CONSOLE';
  }
  return 'LEFT_SIDEBAR_DASHBOARD';
}

/**
 * Sanitizes and transforms React TSX/JSX code for in-browser Babel compilation
 */
function prepareCodeForBabel(code: string): string {
  if (!code || typeof code !== 'string') return '';

  let cleaned = code;

  // 1. Remove ES Module import statements
  cleaned = cleaned.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
  cleaned = cleaned.replace(/^import\s+['"][^'"]+['"];?/gm, '');

  // 2. Remove export statements while keeping function/const definitions
  cleaned = cleaned.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1');
  cleaned = cleaned.replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)/g, 'class $1');
  cleaned = cleaned.replace(/export\s+default\s+const\s+([A-Za-z0-9_]+)/g, 'const $1');
  cleaned = cleaned.replace(/export\s+default\s+/g, '');
  cleaned = cleaned.replace(/export\s+function\s+([A-Za-z0-9_]+)/g, 'function $1');
  cleaned = cleaned.replace(/export\s+const\s+([A-Za-z0-9_]+)/g, 'const $1');
  cleaned = cleaned.replace(/export\s+class\s+([A-Za-z0-9_]+)/g, 'class $1');

  return cleaned;
}

/**
 * Generates dynamic srcDoc HTML string with adaptive shell based on layoutParadigm
 */
function buildSrcDocPayload(
  sourceCode: string,
  appTitle: string = 'App',
  paradigm: LayoutParadigm = 'LEFT_SIDEBAR_DASHBOARD'
): string {
  const sanitizedCode = prepareCodeForBabel(sourceCode);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appTitle} Preview</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            border: 'rgba(255, 255, 255, 0.1)',
            background: '#09090b',
            foreground: '#f4f4f5',
            zinc: {
              950: '#09090b',
              900: '#121216',
              850: '#15151a',
              800: '#18181b',
              700: '#27272a',
            }
          }
        }
      }
    }
  </script>

  <!-- React 18 UMD & Babel Standalone -->
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <style>
    body {
      background-color: #09090b;
      color: #f4f4f5;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
    
    /* Device frame styling */
    .mobile-frame-wrapper {
      background: radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.1) 0%, transparent 70%), #09090b;
    }
  </style>
</head>
<body class="bg-[#09090b] text-zinc-100 min-h-screen">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo } = React;

    // Comprehensive Lucide Icon React Proxy for in-browser preview environment
    const createLucideIcon = (name) => (props = {}) => {
      const size = props.size || 18;
      const className = props.className || '';
      return (
        <span 
          className={\`inline-flex items-center justify-center \${className}\`}
          style={{ width: size, height: size, verticalAlign: 'middle', ...props.style }}
        >
          <svg 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </span>
      );
    };

    const lucideIcons = [
      'Activity', 'ArrowUpRight', 'ArrowDownRight', 'DollarSign', 'Users', 
      'BarChart3', 'TrendingUp', 'Check', 'X', 'Plus', 'Search', 'Filter', 
      'Calendar', 'Clock', 'ChevronDown', 'ChevronRight', 'ChevronLeft', 'MoreVertical', 
      'Settings', 'Shield', 'Zap', 'Bell', 'Mail', 'Trash', 'Edit', 'Eye', 
      'Download', 'Share', 'Copy', 'ExternalLink', 'Folder', 'FileText', 
      'Sparkles', 'Cpu', 'Layers', 'LayoutDashboard', 'UserCheck', 'LayoutGrid',
      'Database', 'Code2', 'Monitor', 'Tablet', 'Smartphone', 'LogOut',
      'ShoppingCart', 'ShoppingBag', 'Heart', 'Compass', 'Home', 'MessageSquare',
      'Wifi', 'Battery', 'MapPin', 'Terminal', 'Server', 'Sliders', 'Globe', 'Star', 'Grid'
    ];

    lucideIcons.forEach(iconName => {
      window[iconName] = createLucideIcon(iconName);
    });

    // --- Adaptive Shell Wrapper Components ---

    function StorefrontTopNavShell({ children, title }) {
      const [showAuthModal, setShowAuthModal] = useState(false);

      return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
          {/* Top Consumer Navbar */}
          <header className="sticky top-0 z-50 bg-[#0e0e14]/90 backdrop-blur-xl border-b border-white/10 px-4 lg:px-8 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              {/* Brand */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20 text-sm">
                  {title ? title.charAt(0) : 'A'}
                </div>
                <span className="font-bold text-base tracking-tight text-white">{title || 'App'}</span>
              </div>

              {/* Center Search */}
              <div className="flex-1 max-w-md hidden md:block">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">🔍</span>
                  <input
                    type="text"
                    placeholder={\`Search \${title || 'App'}...\`}
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-8 pr-12 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">⌘K</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => setShowAuthModal(!showAuthModal)} 
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold border border-white/20 ml-1 cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all"
                  title="Account"
                >
                  {title ? title.charAt(0) : 'A'}
                </button>
              </div>
            </div>
          </header>

          {/* Auth Modal on Profile Click */}
          {showAuthModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-[#121218] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="absolute right-4 top-4 text-zinc-400 hover:text-white text-sm"
                >
                  ✕
                </button>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold text-lg flex items-center justify-center mx-auto mb-3">
                    {title ? title.charAt(0) : 'A'}
                  </div>
                  <h3 className="text-lg font-bold text-white">Sign In to {title || 'App'}</h3>
                  <p className="text-xs text-zinc-400 mt-1">Sign in to your account</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Email</label>
                    <input type="email" placeholder="you@example.com" className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Password</label>
                    <input type="password" placeholder="••••••••" className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500" />
                  </div>
                  <button 
                    onClick={() => setShowAuthModal(false)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-xs shadow-lg shadow-orange-500/20 hover:opacity-95 mt-2"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Canvas Content */}
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      );
    }

    function MobileEmulatorShell({ children, title }) {
      const [activeTab, setActiveTab] = useState('Home');
      const tabs = [
        { id: 'Home', icon: '🏠', label: 'Home' },
        { id: 'Explore', icon: '🧭', label: 'Explore' },
        { id: 'Activity', icon: '⚡', label: 'Activity' },
        { id: 'Profile', icon: '👤', label: 'Profile' },
      ];

      return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center p-2 sm:p-6 mobile-frame-wrapper">
          {/* Centered Phone Shell */}
          <div className="w-full max-w-[390px] h-[810px] max-h-[92vh] bg-[#0c0c12] rounded-[48px] border-[8px] border-[#22222e] shadow-2xl shadow-purple-950/40 flex flex-col overflow-hidden relative">
            
            {/* Top Speaker & Dynamic Island Status Bar */}
            <div className="bg-[#0c0c12] px-6 pt-3 pb-2 flex items-center justify-between text-zinc-300 text-[11px] font-mono shrink-0 select-none border-b border-white/5">
              <span>9:41</span>
              {/* Dynamic Island */}
              <div className="w-24 h-4 bg-black rounded-full border border-white/10 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-zinc-400 truncate max-w-[60px]">{title || 'App'}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <span>5G</span>
                <span>📶</span>
                <span>🔋 100%</span>
              </div>
            </div>

            {/* Scrollable Mobile Screen Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 bg-[#09090b] text-zinc-100">
              {children}
            </div>

            {/* Bottom Mobile Tab Bar */}
            <div className="bg-[#101018]/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-around shrink-0">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={\`flex flex-col items-center gap-0.5 text-xs transition-all \${
                    activeTab === tab.id
                      ? 'text-purple-400 font-semibold scale-105'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }\`}
                >
                  <span className="text-sm">{tab.icon}</span>
                  <span className="text-[10px]">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* iOS Home Indicator Bar */}
            <div className="w-full bg-[#101018] flex justify-center pb-1.5 shrink-0">
              <div className="w-32 h-1 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      );
    }

    function SplitConsoleShell({ children, title }) {
      return (
        <div className="min-h-screen bg-[#07070a] text-zinc-100 flex flex-col font-sans">
          {/* Terminal Console Header */}
          <header className="bg-[#0e0e16] border-b border-white/10 px-4 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">● PRODUCTION</span>
              </div>
              <span className="text-zinc-600">|</span>
              <span className="text-xs font-mono text-zinc-300 font-semibold">{title || 'DevTool Console'}</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-400">us-east-1a</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="hidden sm:flex items-center gap-2 text-zinc-400">
                <span>⚡ Latency: <strong className="text-emerald-400">14ms</strong></span>
                <span className="text-zinc-700">·</span>
                <span>SLA: <strong className="text-zinc-200">99.99%</strong></span>
                <span className="text-zinc-700">·</span>
                <span>RPS: <strong className="text-indigo-400">1.8k</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 text-[11px] text-zinc-400">
                <span>CLI v2.4.1</span>
              </div>
            </div>
          </header>

          {/* Main Console Canvas */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>
        </div>
      );
    }

    // Dynamic Shell Dispatcher
    function AdaptiveShell({ children, paradigm, title }) {
      if (paradigm === 'TOP_NAV_STOREFRONT') {
        return <StorefrontTopNavShell title={title}>{children}</StorefrontTopNavShell>;
      }
      if (paradigm === 'MOBILE_EMULATOR_SHELL') {
        return <MobileEmulatorShell title={title}>{children}</MobileEmulatorShell>;
      }
      if (paradigm === 'SPLIT_CONSOLE' || paradigm === 'FULLSCREEN_CANVAS') {
        return <SplitConsoleShell title={title}>{children}</SplitConsoleShell>;
      }
      // Default: B2B Workspace Layout
      return <div className="min-h-screen bg-[#09090b] text-zinc-100">{children}</div>;
    }

    // Injected VFS Source Code
    ${sanitizedCode}

    // Dynamic Mount Logic with Adaptive Shell
    try {
      let TargetComponent = null;
      if (typeof App !== 'undefined') TargetComponent = App;
      else if (typeof Dashboard !== 'undefined') TargetComponent = Dashboard;
      else if (typeof Component !== 'undefined') TargetComponent = Component;
      else {
        const globalKeys = Object.keys(window).filter(k => 
          typeof window[k] === 'function' && 
          /^[A-Z]/.test(k) && 
          !['React', 'ReactDOM', 'Babel', 'AdaptiveShell', 'StorefrontTopNavShell', 'MobileEmulatorShell', 'SplitConsoleShell'].includes(k)
        );
        if (globalKeys.length > 0) TargetComponent = window[globalKeys[globalKeys.length - 1]];
      }

      if (TargetComponent) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(
          <AdaptiveShell paradigm="${paradigm}" title="${appTitle}">
            <TargetComponent />
          </AdaptiveShell>
        );
      } else {
        document.getElementById('root').innerHTML = \`
          <div style="padding: 32px; text-align: center; color: #a1a1aa; font-family: monospace;">
            <h3 style="color: #f4f4f5; font-size: 16px; margin-bottom: 8px;">No Renderable Component Found</h3>
            <p style="font-size: 12px;">Define an <code>App</code> or default exported component to see live preview.</p>
          </div>
        \`;
      }
    } catch (err) {
      console.error('[LivePreview Runtime Error]', err);
      const errMsg = err ? (err.message || String(err)) : 'Unknown render error';
      const errStack = err && err.stack ? err.stack : '';
      
      window.parent.postMessage({
        type: 'buildx:runtime-error',
        error: { message: errMsg, stack: errStack }
      }, '*');

      document.getElementById('root').innerHTML = \`
        <div style="min-h-screen; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #09090b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
          <div style="max-width: 680px; width: 100%; background: #121218; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 16px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 10px #ef4444;"></span>
                <span style="font-size: 13px; font-weight: 700; color: #f87171; text-transform: uppercase; letter-spacing: 0.05em;">Live Preview Runtime Error</span>
              </div>
              <button id="autofix-btn" style="padding: 6px 14px; background: linear-gradient(135deg, #7c3aed, #4f46e5); border: 1px solid rgba(167, 139, 250, 0.4); border-radius: 8px; color: #fff; font-size: 11px; cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                <span>⚡ Auto-Fix with Cortex</span>
              </button>
            </div>
            
            <div style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 14px; overflow-x: auto;">
              <div style="color: #fca5a5; font-weight: 600; font-size: 12px; margin-bottom: 8px;">\${errMsg}</div>
              <pre style="color: #9ca3af; font-size: 11px; line-height: 1.5; margin: 0; white-space: pre-wrap;">\${errStack || 'No stack trace available'}</pre>
            </div>
          </div>
        </div>
      \`;

      var btn = document.getElementById('autofix-btn');
      if (btn) {
        btn.onclick = function() {
          window.parent.postMessage({
            type: 'buildx:trigger-autofix',
            error: { message: errMsg, stack: errStack }
          }, '*');
        };
      }
    }
  </script>

  <!-- Global Error & Promise Rejection Handlers -->
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      window.parent.postMessage({
        type: 'buildx:runtime-error',
        error: {
          message: message ? String(message) : 'Runtime Error',
          stack: error && error.stack ? error.stack : String(message || ''),
          source: source,
          lineno: lineno,
          colno: colno
        }
      }, '*');
    };

    window.onunhandledrejection = function(event) {
      var reason = event.reason || {};
      window.parent.postMessage({
        type: 'buildx:runtime-error',
        error: {
          message: reason.message || String(reason) || 'Unhandled Promise Rejection',
          stack: reason.stack || String(reason)
        }
      }, '*');
    };
  </script>

  <!-- Bidirectional Element-to-Code Selection Inspector -->
  <script>
    window.addEventListener('click', function(e) {
      var target = e.target;
      if (!target) return;
      
      var tagName = (target.tagName || '').toLowerCase();
      var textContent = '';
      for (var i = 0; i < target.childNodes.length; i++) {
        if (target.childNodes[i].nodeType === 3) {
          var t = target.childNodes[i].textContent.trim();
          if (t) { textContent = t; break; }
        }
      }
      if (!textContent) {
        textContent = (target.textContent || '').trim().slice(0, 60);
      }
      
      var className = typeof target.className === 'string' ? target.className : '';
      var id = target.id || '';
      var placeholder = target.getAttribute ? (target.getAttribute('placeholder') || '') : '';
      var ariaLabel = target.getAttribute ? (target.getAttribute('aria-label') || '') : '';
      var title = target.getAttribute ? (target.getAttribute('title') || '') : '';

      window.parent.postMessage({
        type: 'buildx:preview-element-click',
        element: {
          tagName: tagName,
          textContent: textContent,
          className: className,
          id: id,
          placeholder: placeholder,
          ariaLabel: ariaLabel,
          title: title
        }
      }, '*');
    }, true);
  </script>
</body>
</html>`;
}

export function LivePreview({
  files: propFiles,
  activeFilePath: propActiveFilePath,
  blueprintId,
  appName,
  viewport: initialViewport = 'desktop',
  layoutParadigm: propLayoutParadigm,
  productArchetype: propProductArchetype,
  primaryLandingScreenId,
  blueprint,
}: LivePreviewProps) {
  const vfs = useVFS();
  const files = propFiles || vfs.files || {};
  const activeFilePath = propActiveFilePath || vfs.activeFilePath;

  // Resolve layout paradigm (explicit prop, blueprint property, or inferred)
  const layoutParadigm = useMemo(() => {
    return (
      propLayoutParadigm ||
      blueprint?.layoutParadigm ||
      inferLayoutParadigm(appName || blueprint?.appName || blueprint?.title, files)
    );
  }, [propLayoutParadigm, blueprint, appName, files]);

  const [selectedViewport, setSelectedViewport] = useState<Viewport>(() => {
    if (layoutParadigm === 'MOBILE_EMULATOR_SHELL') return 'mobile';
    return initialViewport;
  });

  const [compileError, setCompileError] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleEnhance = useCallback(async () => {
    if (!blueprintId || vfs.isEnhancingUi) return;
    setEnhanceError(null);
    try {
      await vfs.enhanceUi(blueprintId);
    } catch (err: any) {
      setEnhanceError(err.message || 'AI Enhancement failed. Please try again.');
    }
  }, [blueprintId, vfs]);

  // Determine active primary source code from VFS file map using Intelligent Screen Router
  const activeScreenInfo = useMemo(() => {
    if (!files || Object.keys(files).length === 0) {
      return { path: '', code: '' };
    }

    const fileKeys = Object.keys(files);
    // 1. Standard app root entry points (App.tsx executes the complete AI-generated application)
    const priorityPaths = [
      'frontend/src/App.tsx',
      'src/App.tsx',
      'App.tsx',
      'frontend/src/App.jsx',
      'src/App.jsx',
      'App.jsx',
      'frontend/src/components/Dashboard.tsx',
      'src/components/Dashboard.tsx',
    ];

    for (const path of priorityPaths) {
      if (files[path] && files[path].trim().length > 0) {
        return { path, code: files[path] };
      }
    }

    // 2. Currently active selected file in editor if it's TSX/JSX
    if (activeFilePath && files[activeFilePath] && (activeFilePath.endsWith('.tsx') || activeFilePath.endsWith('.jsx'))) {
      return { path: activeFilePath, code: files[activeFilePath] };
    }

    let targetLandingId = primaryLandingScreenId || blueprint?.primaryLandingScreenId;

    // Auto-infer primary landing screen from blueprint screens/uiScreens if missing on older blueprints
    if (!targetLandingId && blueprint) {
      const blueprintScreens = ((blueprint as any).screens || (blueprint as any).uiScreens || []) as Array<{ name?: string; title?: string; label?: string }>;
      const targetKeywords = ['discovery', 'home', 'explore', 'feed', 'catalog', 'dashboard', 'pipeline', 'deals', 'overview', 'console', 'storefront'];
      const authKeywords = ['login', 'signup', 'sign-up', 'register', 'auth', 'onboarding', 'forgotpassword'];

      for (const kw of targetKeywords) {
        const found = blueprintScreens.find(s => {
          const name = (s.name || s.title || s.label || '').toLowerCase();
          return name.includes(kw) && !authKeywords.some(a => name.includes(a));
        });
        if (found) {
          targetLandingId = found.name || found.title || found.label;
          break;
        }
      }
    }

    // 3. If explicit or inferred targetLandingId is specified, search for matching file
    if (targetLandingId) {
      const cleanTarget = targetLandingId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matchedKey = fileKeys.find(key => {
        const cleanKey = key.split('/').pop()?.replace(/\.(tsx|jsx|ts|js)$/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || '';
        return cleanKey.includes(cleanTarget) || cleanTarget.includes(cleanKey);
      });
      if (matchedKey && files[matchedKey]?.trim()) {
        return { path: matchedKey, code: files[matchedKey] };
      }
    }

    // 4. High-priority landing keywords in file paths (excluding Auth/Onboarding)
    const landingKeywords = ['discovery', 'home', 'explore', 'feed', 'catalog', 'dashboard', 'pipeline', 'deals', 'overview', 'console', 'storefront'];
    const authKeywords = ['login', 'signup', 'sign-up', 'register', 'auth', 'onboarding', 'forgotpassword'];

    const isAuthFile = (path: string) => authKeywords.some(k => path.toLowerCase().includes(k));

    for (const kw of landingKeywords) {
      const match = fileKeys.find(
        key =>
          (key.endsWith('.tsx') || key.endsWith('.jsx')) &&
          key.toLowerCase().includes(kw) &&
          !isAuthFile(key) &&
          files[key]?.trim().length > 0
      );
      if (match) {
        return { path: match, code: files[match] };
      }
    }

    // 5. First non-auth TSX/JSX file found in files map
    const firstNonAuthTsx = fileKeys.find(
      key => (key.endsWith('.tsx') || key.endsWith('.jsx')) && !isAuthFile(key) && files[key].trim().length > 0
    );
    if (firstNonAuthTsx) {
      return { path: firstNonAuthTsx, code: files[firstNonAuthTsx] };
    }

    // 6. First TSX/JSX file found
    const firstTsxKey = fileKeys.find(
      key => (key.endsWith('.tsx') || key.endsWith('.jsx')) && files[key].trim().length > 0
    );
    if (firstTsxKey) {
      return { path: firstTsxKey, code: files[firstTsxKey] };
    }

    // 7. Fallback to index.html
    const htmlKey = files['index.html'] ? 'index.html' : files['frontend/index.html'] ? 'frontend/index.html' : '';
    if (htmlKey) {
      return { path: htmlKey, code: files[htmlKey] };
    }

    return { path: '', code: '' };
  }, [files, activeFilePath, primaryLandingScreenId, blueprint]);

  const activeSourceCode = activeScreenInfo.code;
  const activeScreenId = activeScreenInfo.path || primaryLandingScreenId || blueprint?.primaryLandingScreenId || 'default';

  // Pipeline debug logging requested in task
  console.log('[LivePreview Render]', {
    title: blueprint?.title || blueprint?.appName || appName,
    layoutParadigm: blueprint?.layoutParadigm || layoutParadigm,
    activeScreenId,
  });

  // Construct iframe srcDoc dynamically
  const srcDocPayload = useMemo(() => {
    if (!activeSourceCode) {
      return '';
    }
    try {
      setCompileError(null);
      return buildSrcDocPayload(activeSourceCode, appName || blueprint?.appName || blueprint?.title || 'BuildX', layoutParadigm);
    } catch (err: any) {
      setCompileError(err.message || 'Failed to compile VFS code for preview.');
      return '';
    }
  }, [activeSourceCode, appName, blueprint, layoutParadigm]);

  const activeViewport = VIEWPORTS.find(v => v.id === selectedViewport) || VIEWPORTS[0];

  return (
    <div className="flex flex-col w-full h-full min-h-[500px] gap-3">
      {/* Top Header & Viewport Controls */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          {/* VFS Status Badge & Archetype indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
            {vfs.isEnhancingUi ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span>{vfs.isEnhancingUi ? '✨ Upgrading VFS UI Code...' : `VFS Live Compiler (${layoutParadigm})`}</span>
          </div>

          {/* Enhance with AI Button */}
          {blueprintId && (
            <button
              id="enhance-ui-btn"
              onClick={handleEnhance}
              disabled={vfs.isEnhancingUi}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
                vfs.isEnhancingUi
                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 cursor-not-allowed animate-pulse'
                  : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-white shadow-sm shadow-purple-500/10'
              }`}
              title="Upgrade this blueprint's VFS UI to a high-fidelity dark glassmorphic interface"
            >
              {vfs.isEnhancingUi ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Wand2 size={12} />
              )}
              <span>{vfs.isEnhancingUi ? 'Enhancing...' : '✨ Enhance with AI'}</span>
            </button>
          )}
        </div>

        {/* Viewport Switcher */}
        <div className="flex items-center gap-1 bg-[#121216] rounded-xl p-1 border border-white/10">
          {VIEWPORTS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedViewport(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                selectedViewport === id
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Enhance Error Banner */}
      {enhanceError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{enhanceError}</span>
        </div>
      )}

      {/* Frame Container */}
      <div className="w-full flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-[#0e0e14] shadow-2xl">
        {/* Browser Chrome Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#121216] border-b border-white/10 select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-black/40 rounded-lg px-4 py-1 text-xs font-mono text-zinc-400 flex items-center gap-2 min-w-[220px] max-w-sm border border-white/5">
              <span className="text-emerald-400">●</span>
              <span className="truncate">{appName || 'buildx-app'}.local.dev</span>
            </div>
          </div>
          <div className="w-[56px]" />
        </div>

        {/* Canvas Display */}
        <div className="w-full flex-1 min-h-0 bg-[#09090b] flex justify-center overflow-hidden relative">
          <div
            className="relative h-full transition-all duration-300 ease-in-out"
            style={{ width: activeViewport.width, maxWidth: '100%' }}
          >
            {compileError ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#09090b]">
                <AlertCircle size={32} className="text-red-400" />
                <h4 className="text-sm font-bold text-white">VFS Preview Compile Error</h4>
                <p className="text-xs text-zinc-400 font-mono max-w-md">{compileError}</p>
              </div>
            ) : srcDocPayload ? (
              <iframe
                ref={iframeRef}
                srcDoc={srcDocPayload}
                title={`${appName || 'App'} Live Preview`}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
            ) : blueprint && (blueprint.screens?.length || blueprint.schema?.length) ? (
              <div className="w-full h-full overflow-auto bg-[#09090b]">
                <SchemaUISynthesizer
                  blueprint={blueprint}
                  activeScreenId={activeScreenId}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6 text-zinc-400 font-mono text-xs bg-[#09090b]">
                <Loader2 size={24} className="text-indigo-400 animate-spin" />
                <p className="animate-pulse">Generating preview...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LivePreview;
