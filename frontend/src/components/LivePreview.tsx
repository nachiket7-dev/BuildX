import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useVFS } from '../context/VFSContext';
import { AlertCircle, Sparkles, Loader2, Wand2 } from 'lucide-react';

type Viewport = 'desktop' | 'tablet' | 'mobile';

interface LivePreviewProps {
  files?: Record<string, string>;
  activeFilePath?: string | null;
  blueprintId?: string;
  appName?: string;
  viewport?: Viewport;
}

const VIEWPORTS = [
  { id: 'desktop' as Viewport, label: 'Desktop', width: '100%' },
  { id: 'tablet' as Viewport, label: 'Tablet', width: '768px' },
  { id: 'mobile' as Viewport, label: 'Mobile', width: '390px' },
];

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
 * Generates dynamic srcDoc HTML string with CDNs for Tailwind, React 18, Babel Standalone, and Lucide icons
 */
function buildSrcDocPayload(sourceCode: string, appTitle: string = 'App'): string {
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
              800: '#18181b',
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
  </style>
</head>
<body class="bg-[#09090b] text-zinc-100 min-h-screen">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo } = React;

    // Lightweight Lucide Icon React Proxy for browser preview environment
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
      'Calendar', 'Clock', 'ChevronDown', 'ChevronRight', 'MoreVertical', 
      'Settings', 'Shield', 'Zap', 'Bell', 'Mail', 'Trash', 'Edit', 'Eye', 
      'Download', 'Share', 'Copy', 'ExternalLink', 'Folder', 'FileText', 
      'Sparkles', 'Cpu', 'Layers', 'LayoutDashboard', 'UserCheck', 'LayoutGrid',
      'Database', 'Code2', 'Monitor', 'Tablet', 'Smartphone', 'LogOut'
    ];

    lucideIcons.forEach(iconName => {
      window[iconName] = createLucideIcon(iconName);
    });

    // Injected VFS Source Code
    ${sanitizedCode}

    // Dynamic Mount Logic
    try {
      let TargetComponent = null;
      if (typeof App !== 'undefined') TargetComponent = App;
      else if (typeof Dashboard !== 'undefined') TargetComponent = Dashboard;
      else if (typeof Component !== 'undefined') TargetComponent = Component;
      else {
        const globalKeys = Object.keys(window).filter(k => 
          typeof window[k] === 'function' && 
          /^[A-Z]/.test(k) && 
          !['React', 'ReactDOM', 'Babel'].includes(k)
        );
        if (globalKeys.length > 0) TargetComponent = window[globalKeys[globalKeys.length - 1]];
      }

      if (TargetComponent) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(TargetComponent));
      } else {
        document.getElementById('root').innerHTML = \`
          <div style="padding: 32px; text-align: center; color: #a1a1aa; font-family: monospace;">
            <h3 style="color: #f4f4f5; font-size: 16px; margin-bottom: 8px;">No Renderable Component Found</h3>
            <p style="font-size: 12px;">Define an <code>App</code> or default exported component to see live preview.</p>
          </div>
        \`;
      }
    } catch (err) {
      document.getElementById('root').innerHTML = \`
        <div style="padding: 24px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; margin: 24px; color: #f87171; font-family: monospace; font-size: 12px;">
          <strong style="display: block; margin-bottom: 8px; font-size: 14px;">Runtime Render Error:</strong>
          <pre style="white-space: pre-wrap; margin: 0;">\${err.message}</pre>
        </div>
      \`;
    }
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
}: LivePreviewProps) {
  const vfs = useVFS();
  const files = propFiles || vfs.files || {};
  const activeFilePath = propActiveFilePath || vfs.activeFilePath;

  const [selectedViewport, setSelectedViewport] = useState<Viewport>(initialViewport);
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

  // Determine active primary source code from VFS file map
  const activeSourceCode = useMemo(() => {
    if (!files || Object.keys(files).length === 0) {
      return '';
    }

    // Priority 1: Check standard app entry points
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
        return files[path];
      }
    }

    // Priority 2: Use currently active selected file if it's TSX/JSX
    if (activeFilePath && files[activeFilePath] && (activeFilePath.endsWith('.tsx') || activeFilePath.endsWith('.jsx'))) {
      return files[activeFilePath];
    }

    // Priority 3: First TSX/JSX file found in files map
    const firstTsxKey = Object.keys(files).find(
      key => (key.endsWith('.tsx') || key.endsWith('.jsx')) && files[key].trim().length > 0
    );
    if (firstTsxKey) {
      return files[firstTsxKey];
    }

    // Priority 4: Fallback to index.html if present
    if (files['index.html'] || files['frontend/index.html']) {
      return files['index.html'] || files['frontend/index.html'];
    }

    return '';
  }, [files, activeFilePath]);

  // Construct iframe srcDoc dynamically
  const srcDocPayload = useMemo(() => {
    if (!activeSourceCode) {
      return '';
    }
    try {
      setCompileError(null);
      return buildSrcDocPayload(activeSourceCode, appName || 'BuildX');
    } catch (err: any) {
      setCompileError(err.message || 'Failed to compile VFS code for preview.');
      return '';
    }
  }, [activeSourceCode, appName]);

  const activeViewport = VIEWPORTS.find(v => v.id === selectedViewport)!;

  return (
    <div className="flex flex-col w-full h-full min-h-[500px] gap-3">
      {/* Top Header & Viewport Controls */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          {/* VFS Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
            {vfs.isEnhancingUi ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span>{vfs.isEnhancingUi ? '✨ Upgrading VFS UI Code...' : 'VFS Real-Time Live Compiler'}</span>
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
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6 text-zinc-400 font-mono text-xs bg-[#09090b]">
                <Loader2 size={24} className="text-indigo-400 animate-spin" />
                <p className="animate-pulse">Compiling VFS code for Live Preview...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LivePreview;
