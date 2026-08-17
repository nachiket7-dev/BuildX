import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVFS } from '../context/VFSContext';
import { AlertCircle, AlertTriangle, Loader2, Wand2, Zap, X, Crosshair } from 'lucide-react';
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
  onPromptAgent?: (prompt: string) => void;
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

/**
 * Sandpack Error Bridge: Listens to Sandpack runtime build/execution errors
 * and posts window events to sync with Cortex Agent / Refinement Chat.
 */
function SandpackErrorBridge({
  onErrorStateChange,
}: {
  onErrorStateChange: (err: string | null) => void;
}) {
  const { sandpack } = useSandpack();
  const error = sandpack.error?.message || null;

  useEffect(() => {
    onErrorStateChange(error);
    if (error) {
      window.postMessage(
        {
          type: 'BUILDX_SANDBOX_ERROR',
          error: { message: error },
        },
        '*'
      );
    }
  }, [error, onErrorStateChange]);

  return null;
}

/**
 * Resolves source file & matching line number by scanning VFS files for JSX tags,
 * text snippets, IDs, classes, or attributes.
 */
function resolveSourceLocation(
  files: Record<string, string>,
  element: {
    tagName?: string;
    textContent?: string;
    id?: string;
    className?: string;
    placeholder?: string;
    title?: string;
    ariaLabel?: string;
  }
): { targetFile: string; targetLine: number } | null {
  const text = element.textContent?.trim();
  const candidates: string[] = [];

  if (text && text.length >= 2) {
    candidates.push(text);
  }
  if (element.placeholder) {
    candidates.push(`placeholder="${element.placeholder}"`);
    candidates.push(`placeholder='${element.placeholder}'`);
    candidates.push(element.placeholder);
  }
  if (element.ariaLabel) {
    candidates.push(`aria-label="${element.ariaLabel}"`);
    candidates.push(element.ariaLabel);
  }
  if (element.title) {
    candidates.push(`title="${element.title}"`);
  }
  if (element.id) {
    candidates.push(`id="${element.id}"`);
    candidates.push(`id='${element.id}'`);
  }
  if (element.className && typeof element.className === 'string') {
    const classTokens = element.className
      .split(/\s+/)
      .filter((c) => c.length > 5 && !c.includes(':') && !c.startsWith('hover:'));
    if (classTokens.length > 0) {
      candidates.push(classTokens[0]);
    }
  }
  if (element.tagName && element.tagName !== 'div' && element.tagName !== 'span') {
    candidates.push(`<${element.tagName}`);
  }

  // Filter code files in VFS
  const codeEntries = Object.entries(files).filter(
    ([p]) =>
      !p.endsWith('.sql') &&
      !p.endsWith('.md') &&
      !p.endsWith('.json') &&
      p !== 'preview.html'
  );

  for (const cand of candidates) {
    if (!cand || cand.length < 2) continue;
    for (const [filePath, content] of codeEntries) {
      const idx = content.indexOf(cand);
      if (idx !== -1) {
        const line = content.substring(0, idx).split('\n').length;
        return { targetFile: filePath, targetLine: line };
      }
    }
  }

  return null;
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
  onPromptAgent,
}: LivePreviewProps) {
  const vfs = useVFS();
  const files = propFiles || vfs.files || {};
  const activeFilePath = propActiveFilePath || vfs.activeFilePath;

  const [activeError, setActiveError] = useState<string | null>(null);
  const [isInspectMode, setIsInspectMode] = useState<boolean>(false);

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

  const handleAutoFix = useCallback(() => {
    if (!activeError) return;
    const errorMsg = activeError;

    // 1. Trigger prop function if provided
    if (onPromptAgent) {
      onPromptAgent(`Fix this runtime error: ${errorMsg}`);
    }

    // 2. Post window messages for RefinementChat and iframe bridges
    window.postMessage(
      {
        type: 'BUILDX_SANDBOX_ERROR',
        error: { message: errorMsg },
      },
      '*'
    );
    window.postMessage(
      {
        type: 'BUILDX_TRIGGER_AUTO_FIX',
        error: { message: errorMsg },
      },
      '*'
    );

    // 3. Dispatch global browser events for any listening panels
    window.dispatchEvent(
      new CustomEvent('buildx:autofix', {
        detail: { error: errorMsg, message: `Fix this runtime error: ${errorMsg}` },
      })
    );
    window.dispatchEvent(
      new CustomEvent('buildx:agent_prompt', {
        detail: { message: `Fix this runtime error: ${errorMsg}` },
      })
    );
  }, [activeError, onPromptAgent]);

  // Sync inspect mode to preview iframes
  useEffect(() => {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((ifr) => {
      try {
        ifr.contentWindow?.postMessage(
          {
            type: 'BUILDX_SET_INSPECT_MODE',
            active: isInspectMode,
          },
          '*'
        );
      } catch (err) {
        // ignore cross-origin if any
      }
    });
  }, [isInspectMode]);

  // Listen for inspected element clicks from preview iframe
  useEffect(() => {
    const handleElementClick = (event: MessageEvent) => {
      if (event.data?.type === 'BUILDX_PREVIEW_ELEMENT_CLICK' && event.data.element) {
        const el = event.data.element;
        setIsInspectMode(false);

        // Resolve source location by scanning files
        const resolved = resolveSourceLocation(files, el);
        if (resolved) {
          // Switch active file in VFS if needed
          vfs.setActiveFile?.(resolved.targetFile);

          // Broadcast target file & line to CodeStudio
          window.postMessage(
            {
              type: 'BUILDX_INSPECT_CODE_TARGET',
              targetFile: resolved.targetFile,
              targetLine: resolved.targetLine,
              element: el,
            },
            '*'
          );
          window.dispatchEvent(
            new CustomEvent('buildx:inspect_target', {
              detail: {
                targetFile: resolved.targetFile,
                targetLine: resolved.targetLine,
                element: el,
              },
            })
          );
        } else {
          // Fallback: dispatch element click event
          window.postMessage(
            {
              type: 'buildx:preview-element-click',
              element: el,
            },
            '*'
          );
        }
      }
    };

    window.addEventListener('message', handleElementClick);
    return () => window.removeEventListener('message', handleElementClick);
  }, [files, vfs]);

  // Convert the VFS files dictionary into Sandpack's required structure
  const sandpackFiles = useMemo(() => {
    const fileEntries = Object.entries(files || {}).filter(
      ([p]) => p !== 'preview.html' && !p.endsWith('.sql') && !p.endsWith('.md')
    );

    if (fileEntries.length === 0) return null;

    const acc = fileEntries.reduce<Record<string, { code: string }>>((res, [path, content]) => {
      const cleanPath = path.startsWith('frontend/')
        ? path.replace('frontend/', '/')
        : path.startsWith('/')
          ? path
          : `/${path}`;
      res[cleanPath] = { code: content };
      return res;
    }, {});

    // Ensure Sandpack react-ts entry point /App.tsx is present
    if (acc['/src/App.tsx'] && !acc['/App.tsx']) {
      acc['/App.tsx'] = { code: acc['/src/App.tsx'].code };
    } else if (acc['/src/App.jsx'] && !acc['/App.tsx']) {
      acc['/App.tsx'] = { code: acc['/src/App.jsx'].code };
    }

    const inspectorScript = `
    <script>
      (function() {
        let isInspectActive = false;
        let hoveredEl = null;

        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'BUILDX_SET_INSPECT_MODE') {
            isInspectActive = Boolean(e.data.active);
            if (!isInspectActive && hoveredEl) {
              hoveredEl.style.outline = '';
              hoveredEl.style.outlineOffset = '';
              hoveredEl.style.cursor = '';
              hoveredEl = null;
            }
          }
        });

        document.addEventListener('mouseover', function(e) {
          if (!isInspectActive) return;
          const target = e.target;
          if (!target || target === document.body || target === document.documentElement) return;
          if (hoveredEl && hoveredEl !== target) {
            hoveredEl.style.outline = '';
            hoveredEl.style.outlineOffset = '';
            hoveredEl.style.cursor = '';
          }
          hoveredEl = target;
          hoveredEl.style.outline = '2px solid #38BDF8';
          hoveredEl.style.outlineOffset = '1px';
          hoveredEl.style.cursor = 'crosshair';
        }, true);

        document.addEventListener('mouseout', function(e) {
          if (!isInspectActive) return;
          const target = e.target;
          if (target && target.style) {
            target.style.outline = '';
            target.style.outlineOffset = '';
            target.style.cursor = '';
          }
        }, true);

        document.addEventListener('click', function(e) {
          if (!isInspectActive) return;
          e.preventDefault();
          e.stopPropagation();
          const target = e.target;
          if (!target) return;

          if (target.style) {
            target.style.outline = '';
            target.style.outlineOffset = '';
            target.style.cursor = '';
          }

          const payload = {
            tagName: target.tagName ? target.tagName.toLowerCase() : '',
            textContent: (target.textContent || '').trim().slice(0, 80),
            id: target.id || '',
            className: typeof target.className === 'string' ? target.className : '',
            placeholder: target.getAttribute ? target.getAttribute('placeholder') || '' : '',
            title: target.getAttribute ? target.getAttribute('title') || '' : '',
            ariaLabel: target.getAttribute ? target.getAttribute('aria-label') || '' : '',
            name: target.getAttribute ? target.getAttribute('name') || '' : '',
            href: target.getAttribute ? target.getAttribute('href') || '' : '',
          };

          window.parent.postMessage({
            type: 'BUILDX_PREVIEW_ELEMENT_CLICK',
            element: payload
          }, '*');
        }, true);
      })();
    </script>
    `;

    // Default HTML with Tailwind CSS CDN for instant styling + Click-to-Code inspector
    if (!acc['/public/index.html'] && !acc['/index.html']) {
      acc['/public/index.html'] = {
        code: `<!DOCTYPE html>
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
    ${inspectorScript}
  </body>
</html>`,
      };
    }

    // Ensure entry App.tsx exists
    if (!acc['/App.tsx'] && !acc['/src/App.tsx']) {
      const candidateKey = Object.keys(acc).find(
        (k) => (k.endsWith('.tsx') || k.endsWith('.jsx')) && !k.includes('index') && !k.includes('main')
      );
      if (candidateKey) {
        acc['/App.tsx'] = { code: candidateKey ? acc[candidateKey].code : '' };
      } else {
        acc['/App.tsx'] = {
          code: `import React from 'react';
export default function App() {
  return (
    <div className="p-8 text-center text-white bg-[#09090b] min-h-screen">
      <h1 className="text-xl font-bold mb-2">${appName || 'BuildX Workspace'}</h1>
      <p className="text-zinc-400 text-sm">Application ready. Select or modify components in Code tab.</p>
    </div>
  );
}`,
        };
      }
    }

    return acc;
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

        {/* Right Action Rail: Inspect Toggle & Viewport Switcher */}
        <div className="flex items-center gap-2">
          {/* Visual Inspect Toggle Button */}
          <button
            type="button"
            onClick={() => setIsInspectMode((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
              isInspectMode
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/20 ring-1 ring-sky-400/40 animate-pulse'
                : 'bg-[#121216] text-zinc-400 border-white/10 hover:text-white hover:bg-white/5'
            }`}
            title="Click any element in preview to jump to its source code in Code Studio"
          >
            <Crosshair size={13} className={isInspectMode ? 'text-sky-400' : 'text-zinc-400'} />
            <span>[ 🎯 Inspect ]</span>
          </button>

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
      </div>

      {/* Enhance Error Banner */}
      {enhanceError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{enhanceError}</span>
        </div>
      )}

      {/* Frame Container */}
      <div className="w-full flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-[#0e0e14] shadow-2xl relative">
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
          <div className="flex items-center justify-end w-[90px]">
            {isInspectMode && (
              <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 animate-pulse">
                Click element
              </span>
            )}
          </div>
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
                    'lucide-react': 'latest',
                    'tailwind-merge': 'latest',
                    clsx: 'latest',
                    'framer-motion': 'latest',
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
                <SandpackErrorBridge onErrorStateChange={setActiveError} />
                <SandpackPreview
                  showNavigator={false}
                  showRefreshButton={false}
                  showOpenInCodeSandbox={false}
                  style={{ height: '100%', width: '100%' }}
                />
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

          {/* Floating Error Bar at bottom of Canvas */}
          <AnimatePresence>
            {activeError && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-3 inset-x-3 z-30 flex items-center justify-between gap-3 p-3 bg-red-950/90 border border-red-500/30 rounded-xl backdrop-blur-xl shadow-2xl text-xs font-mono text-red-200"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <AlertTriangle size={15} className="text-red-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-red-300">Runtime Error: </span>
                    <span className="text-red-200/90 truncate">{activeError}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoFix}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Zap size={13} className="fill-current" />
                    <span>⚡ Auto-Fix with Cortex</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveError(null)}
                    className="p-1 text-neutral-400 hover:text-white rounded-lg transition-colors"
                    title="Dismiss error"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default LivePreview;
