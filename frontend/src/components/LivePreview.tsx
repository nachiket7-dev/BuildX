import React, { useState, useMemo, useCallback } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
} from '@codesandbox/sandpack-react';
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

const buildxSandpackTheme = {
  colors: {
    surface1: '#13141F',
    surface2: '#181926',
    surface3: '#222338',
    clickable: '#94A3B8',
    base: '#E2E8F0',
    disabled: '#64748B',
    hover: '#FFFFFF',
    accent: '#A855F7',
    error: '#EF4444',
    errorSurface: 'rgba(239, 68, 68, 0.1)',
  },
  syntax: {
    plain: '#E2E8F0',
    comment: { color: '#64748B', fontStyle: 'italic' },
    keyword: '#EC4899',
    tag: '#38BDF8',
    punctuation: '#94A3B8',
    definition: '#A78BFA',
    property: '#E2E8F0',
    static: '#F59E0B',
    string: '#34D399',
  },
  font: {
    body: "'JetBrains Mono', 'Fira Code', 'Geist Mono', monospace",
    mono: "'JetBrains Mono', 'Fira Code', 'Geist Mono', monospace",
    size: '13px',
    lineHeight: '20px',
  },
};

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

  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const handleEnhance = useCallback(async () => {
    if (!blueprintId || vfs.isEnhancingUi) return;
    setEnhanceError(null);
    try {
      await vfs.enhanceUi(blueprintId);
    } catch (err: any) {
      setEnhanceError(err.message || 'AI Enhancement failed. Please try again.');
    }
  }, [blueprintId, vfs]);

  // Construct normalized Sandpack files map from VFS
  const sandpackFiles = useMemo(() => {
    const fileEntries = Object.entries(files).filter(
      ([p]) => p !== 'preview.html' && !p.endsWith('.sql') && !p.endsWith('.md')
    );

    if (fileEntries.length === 0) return null;

    const result: Record<string, string> = {};

    for (const [rawPath, content] of fileEntries) {
      let normalized = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

      // Flatten frontend/ prefix for Sandpack standard structure
      if (normalized.startsWith('/frontend/')) {
        normalized = normalized.replace('/frontend/', '/');
      }

      result[normalized] = content;

      // Also provide root /App.tsx alias if inside /src/App.tsx
      if (normalized === '/src/App.tsx' || normalized === '/src/App.jsx') {
        result['/App.tsx'] = content;
      }
    }

    // Default HTML with Tailwind CSS CDN
    if (!result['/public/index.html'] && !result['/index.html']) {
      result['/public/index.html'] = `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName || blueprint?.appName || 'BuildX App'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { background-color: #09090b; color: #f4f4f5; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
    </style>
  </head>
  <body class="bg-[#09090b] text-zinc-100 min-h-screen">
    <div id="root"></div>
  </body>
</html>`;
    }

    // Default index.css
    if (!result['/src/index.css'] && !result['/index.css']) {
      result['/index.css'] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { background-color: #09090b; color: #f4f4f5; }`;
    }

    // Ensure entry App.tsx exists
    if (!result['/App.tsx'] && !result['/src/App.tsx']) {
      const candidateKey = Object.keys(result).find(
        (k) => (k.endsWith('.tsx') || k.endsWith('.jsx')) && !k.includes('index')
      );
      if (candidateKey) {
        result['/App.tsx'] = result[candidateKey];
      } else {
        result['/App.tsx'] = `import React from 'react';
export default function App() {
  return (
    <div className="p-8 text-center text-white bg-[#09090b] min-h-screen">
      <h1 className="text-xl font-bold mb-2">${appName || 'BuildX Workspace'}</h1>
      <p className="text-zinc-400 text-sm">Application ready. Select or modify components in Code tab.</p>
    </div>
  );
}`;
      }
    }

    return result;
  }, [files, appName, blueprint]);

  const activeViewport = VIEWPORTS.find((v) => v.id === selectedViewport) || VIEWPORTS[0];

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
            <span>
              {vfs.isEnhancingUi
                ? '✨ Upgrading VFS UI Code...'
                : `Sandpack Hot-Reload (${layoutParadigm})`}
            </span>
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
            className="relative h-full transition-all duration-300 ease-in-out flex flex-col min-h-0"
            style={{ width: activeViewport.width, maxWidth: '100%' }}
          >
            {sandpackFiles ? (
              <SandpackProvider
                template="react-ts"
                theme={buildxSandpackTheme as any}
                files={sandpackFiles}
                customSetup={{
                  dependencies: {
                    react: '^18.2.0',
                    'react-dom': '^18.2.0',
                    'lucide-react': '^0.294.0',
                    'framer-motion': '^11.0.0',
                    clsx: '^2.1.1',
                    'tailwind-merge': '^2.3.0',
                  },
                }}
                options={{
                  recompileMode: 'immediate',
                  recompileDelay: 300,
                  activeFile: activeFilePath
                    ? activeFilePath.startsWith('/')
                      ? activeFilePath
                      : `/${activeFilePath}`
                    : '/App.tsx',
                }}
                className="h-full flex-1 min-h-0"
              >
                <SandpackLayout
                  style={{
                    height: '100%',
                    border: 'none',
                    borderRadius: 0,
                    backgroundColor: 'transparent',
                  }}
                >
                  <SandpackPreview
                    showOpenInCodeSandbox={false}
                    showRefreshButton={true}
                    showRestartButton={true}
                    style={{ height: '100%', width: '100%' }}
                  />
                </SandpackLayout>
              </SandpackProvider>
            ) : blueprint && (blueprint.screens?.length || blueprint.schema?.length) ? (
              <div className="w-full h-full overflow-auto bg-[#09090b]">
                <SchemaUISynthesizer
                  blueprint={blueprint}
                  activeScreenId={primaryLandingScreenId || 'default'}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6 text-zinc-400 font-mono text-xs bg-[#09090b]">
                <Loader2 size={24} className="text-indigo-400 animate-spin" />
                <p className="animate-pulse">Initializing preview workspace...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LivePreview;
