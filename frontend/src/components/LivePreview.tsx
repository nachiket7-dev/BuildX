import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useVFS, type RuntimeErrorPayload } from '../context/VFSContext';
import { AlertCircle, AlertTriangle, Loader2, Wand2, Zap, X, Target } from 'lucide-react';
import { SchemaUISynthesizer } from './preview/SchemaUISynthesizer';
import { BuildXLiveEngine } from './preview/BuildXLiveEngine';
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

export const LivePreview: React.FC<LivePreviewProps> = ({
  files: propFiles,
  blueprintId,
  appName,
  viewport: initialViewport = 'desktop',
  layoutParadigm: propLayoutParadigm,
  primaryLandingScreenId,
  blueprint,
  onPromptAgent,
}: LivePreviewProps) => {
  const vfs = useVFS();
  const files = propFiles || vfs.previewFiles || vfs.files || {};

  const [runtimeError, setRuntimeError] = useState<RuntimeErrorPayload | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);

  // Clear runtime error whenever VFS files update
  useEffect(() => {
    setRuntimeError((prev) => (prev ? null : prev));
    vfs.clearRuntimeError?.();
  }, [files, vfs.clearRuntimeError]);

  const handleRuntimeErrorChange = useCallback((err: RuntimeErrorPayload | null) => {
    setRuntimeError((prev) => {
      if (!prev && !err) return prev;
      if (
        prev &&
        err &&
        prev.message === err.message &&
        prev.title === err.title &&
        prev.path === err.path &&
        prev.line === err.line &&
        prev.column === err.column
      ) {
        return prev;
      }
      return err;
    });

    vfs.setRuntimeError?.(err);
  }, [vfs.setRuntimeError]);

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

  const [isAutoFixing, setIsAutoFixing] = useState(false);

  const handleAutoFix = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!runtimeError || isAutoFixing) return;
    setIsAutoFixing(true);

    const errorContext = `Fix runtime preview error in file ${runtimeError.path}:\n${runtimeError.title}: ${runtimeError.message}\n${
      runtimeError.line ? `at line ${runtimeError.line}` : ''
    }`;

    if (onPromptAgent) {
      onPromptAgent(errorContext);
    }

    setTimeout(() => {
      setIsAutoFixing(false);
      setRuntimeError(null);
      vfs.clearRuntimeError?.();
    }, 2000);
  }, [runtimeError, isAutoFixing, onPromptAgent, vfs]);

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
                ? 'Upgrading VFS UI Code...'
                : `Live React Preview (${layoutParadigm})`}
            </span>
          </div>

          {/* Enhance with AI Button */}
          {blueprintId && (
            <button
              type="button"
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
              <span>{vfs.isEnhancingUi ? 'Enhancing...' : 'Enhance with AI'}</span>
            </button>
          )}
        </div>

        {/* Right Action Rail: Inspect Toggle & Viewport Switcher */}
        <div className="flex items-center gap-2">
          {/* Visual Inspect Toggle Button */}
          <button
            type="button"
            id="preview-inspect-btn"
            onClick={() => setIsInspecting((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
              isInspecting
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-400/40 animate-pulse'
                : 'bg-[#121216] text-zinc-400 border-white/10 hover:text-white hover:bg-white/5'
            }`}
            title="Click any element in preview to jump to its source code in Code Studio"
          >
            <Target size={13} className={isInspecting ? 'text-indigo-400' : 'text-zinc-400'} />
            <span>Inspect</span>
          </button>

          {/* Viewport Switcher */}
          <div className="flex items-center gap-1 bg-[#121216] rounded-xl p-1 border border-white/10">
            {VIEWPORTS.map(({ id, label }) => (
              <button
                type="button"
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
      <div
        className={`w-full flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-[#0e0e14] shadow-2xl relative transition-all duration-200 ${
          isInspecting ? 'ring-2 ring-indigo-500/50 shadow-indigo-500/10' : ''
        }`}
      >
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
          <div className="flex items-center justify-end w-[110px]">
            {isInspecting && (
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 animate-pulse flex items-center gap-1">
                <Target size={10} />
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
            {Object.keys(files || {}).length > 0 ? (
              <BuildXLiveEngine
                files={files}
                appName={appName || blueprint?.appName}
                onErrorStateChange={handleRuntimeErrorChange}
                isInspecting={isInspecting}
              />
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

          {/* Surgical Auto-Heal Error Overlay */}
          {runtimeError && (
            <div className="absolute bottom-4 left-4 right-4 z-40 p-4 bg-red-950/90 border border-red-500/40 rounded-xl backdrop-blur-md shadow-2xl flex flex-col gap-3 max-w-xl mx-auto text-white animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-red-200 font-mono tracking-tight flex items-center gap-1.5 truncate">
                      {runtimeError.title || 'Runtime Preview Error'}
                      {runtimeError.path && (
                        <span className="text-[10px] text-red-400/80 font-normal px-1.5 py-0.5 rounded bg-red-950/60 border border-red-500/20">
                          {runtimeError.path}:{runtimeError.line || 1}
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-red-300/90 font-mono mt-1 break-words line-clamp-3">
                      {runtimeError.message}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRuntimeError(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-red-300 hover:text-white transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-500/20">
                <button
                  type="button"
                  onClick={handleAutoFix}
                  disabled={isAutoFixing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold font-mono transition-all shadow-md shadow-red-500/20"
                >
                  <Zap size={13} className={isAutoFixing ? 'animate-spin' : ''} />
                  <span>{isAutoFixing ? 'Prompting Agent...' : 'Auto-Heal with Agent'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
