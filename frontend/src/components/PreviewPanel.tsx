import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { fetchBlueprintPreviewHtml, regenerateBlueprintPreview } from '../lib/api';
import { useModel } from '../hooks/useModel';
import { useToast } from '../hooks/useToast';
import { useVFS } from '../context/VFSContext';
import { LivePreview } from './LivePreview';
import type { LayoutParadigm, ProductArchetype } from '../lib/types';

type Viewport = 'desktop' | 'tablet' | 'mobile';
type PreviewSource = 'deterministic' | 'ai' | 'framework' | null;

interface ViewportConfig {
  id: Viewport;
  label: string;
  icon: LucideIcon;
  width: string;
  frameWidth: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { id: 'desktop', label: 'Desktop',  icon: Monitor,    width: '100%',   frameWidth: 1280 },
  { id: 'tablet',  label: 'Tablet',   icon: Tablet,     width: '768px',  frameWidth: 768  },
  { id: 'mobile',  label: 'Mobile',   icon: Smartphone, width: '390px',  frameWidth: 390  },
];

interface PreviewPanelProps {
  blueprintId: string;
  appName?: string;
  layoutParadigm?: LayoutParadigm;
  productArchetype?: ProductArchetype;
  primaryLandingScreenId?: string;
}

export function PreviewPanel({
  blueprintId,
  appName,
  layoutParadigm,
  productArchetype,
  primaryLandingScreenId,
}: PreviewPanelProps) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSource, setPreviewSource] = useState<PreviewSource>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const { selectedModel } = useModel();
  const { toast } = useToast();
  const vfs = useVFS();

  const hasVfsFiles = Object.keys(vfs.files || {}).length > 0;

  if (hasVfsFiles) {
    return (
      <LivePreview
        blueprintId={blueprintId}
        appName={appName}
        viewport={viewport}
        files={vfs.files}
        activeFilePath={vfs.activeFilePath}
        layoutParadigm={layoutParadigm}
        productArchetype={productArchetype}
        primaryLandingScreenId={primaryLandingScreenId}
      />
    );
  }

  const activeViewport = VIEWPORTS.find(v => v.id === viewport)!;

  const loadPreview = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await fetchBlueprintPreviewHtml(blueprintId);
      setPreviewHtml(result.html);
      setPreviewSource(result.source);
    } catch (err) {
      setPreviewHtml('');
      setPreviewSource(null);
      setLoadError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setIsLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview, previewKey]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleReload = useCallback(() => {
    setPreviewKey(k => k + 1);
  }, []);

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      await regenerateBlueprintPreview(blueprintId, selectedModel);
      toast('AI-enhanced preview generated — refreshing…', 'success');
      setPreviewKey(k => k + 1);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Regeneration failed', 'error');
    } finally {
      setIsRegenerating(false);
    }
  }, [blueprintId, selectedModel, toast]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (!previewHtml) return;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blob = new Blob([previewHtml], { type: 'text/html' });
    blobUrlRef.current = URL.createObjectURL(blob);
    window.open(blobUrlRef.current, '_blank', 'noopener,noreferrer');
  }, [previewHtml]);

  return (
    <div className="flex flex-col gap-3 w-full h-full min-h-[500px]">
      {/* Source banner — shown when deterministic preview is active */}
      {previewSource === 'deterministic' && !isLoading && !loadError && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs"
          style={{
            background: 'rgba(124,58,237,0.08)',
            borderColor: 'rgba(124,58,237,0.25)',
          }}
        >
          <Sparkles size={13} className="text-purple-400 shrink-0" />
          <span className="text-purple-300 flex-1">
            <span className="font-semibold">Blueprint Preview</span>
            <span className="text-purple-400/70 ml-1.5">— built instantly from your blueprint data. Hit <strong>Enhance</strong> to generate a rich AI-designed version.</span>
          </span>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 transition-all disabled:opacity-50 shrink-0"
          >
            {isRegenerating ? (
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Wand2 size={11} />
            )}
            {isRegenerating ? 'Generating…' : 'Enhance with AI'}
          </button>
        </div>
      )}

      {/* AI-generated badge */}
      {previewSource === 'ai' && !isLoading && !loadError && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs w-fit"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderColor: 'rgba(16,185,129,0.25)',
          }}
        >
          <Sparkles size={11} className="text-emerald-400" />
          <span className="text-emerald-300 font-medium">AI-Enhanced Preview</span>
        </div>
      )}

      {/* Framework sandbox live compiled badge */}
      {previewSource === 'framework' && !isLoading && !loadError && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs w-fit"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderColor: 'rgba(16,185,129,0.25)',
          }}
        >
          <Sparkles size={11} className="text-emerald-400" />
          <span className="text-emerald-300 font-semibold">⚡ React Framework Live Sandbox (Compiled from Codebase)</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Viewport switcher */}
        <div className="flex items-center gap-1 bg-bg-surface2 rounded-xl p-1 border border-white/5">
          {VIEWPORTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewport(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewport === id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenExternal}
            disabled={!previewHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-all border border-white/5 disabled:opacity-40"
          >
            <ExternalLink size={13} />
            <span>Open</span>
          </button>

          <button
            onClick={handleReload}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-all border border-white/5 disabled:opacity-40"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Reload</span>
          </button>

          {previewSource === 'ai' && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-all disabled:opacity-40"
            >
              {isRegenerating ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <Sparkles size={13} />
              )}
              <span>{isRegenerating ? 'Generating…' : 'Regenerate'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Browser chrome frame */}
      <div className="w-full flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-bg-surface2 shadow-2xl shadow-black/40">
        {/* Address bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-surface border-b border-white/5 select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white/5 rounded-md px-4 py-1 text-xs font-mono-custom text-muted-foreground/60 flex items-center gap-2 min-w-[220px] max-w-sm border border-white/5">
              <span className="text-emerald-500/60">●</span>
              <span className="truncate">{appName || 'app'}.buildx.dev</span>
            </div>
          </div>
          <div className="w-[56px]" />
        </div>

        {/* Iframe stage */}
        <div className="w-full flex-1 min-h-0 bg-[#0d0d0f] flex justify-center overflow-hidden relative">
          <div
            className="relative h-full transition-all duration-300 ease-in-out"
            style={{ width: activeViewport.width, maxWidth: '100%' }}
          >
            {/* Loading skeleton */}
            {isLoading && !loadError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0d0d0f]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-[3px] border-purple-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-muted-foreground font-mono-custom animate-pulse">
                    Loading preview…
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {loadError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0d0d0f] text-center p-8">
                <AlertTriangle size={32} className="text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Preview Failed to Load</p>
                  <p className="text-xs text-muted-foreground mb-4 max-w-sm">{loadError}</p>
                  <button
                    onClick={handleReload}
                    className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs rounded-lg border border-purple-500/30 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {previewHtml && !loadError && (
              <iframe
                ref={iframeRef}
                key={previewKey}
                srcDoc={previewHtml}
                title={`${appName || 'App'} Live Preview`}
                onLoad={handleIframeLoad}
                className={`w-full h-full border-none transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </div>
        </div>
      </div>

      {/* Viewport label */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/50 font-mono-custom select-none">
        <activeViewport.icon size={11} />
        <span>{activeViewport.label} · {activeViewport.frameWidth}px</span>
      </div>
    </div>
  );
}
