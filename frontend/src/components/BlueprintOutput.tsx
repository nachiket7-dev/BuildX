import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Cpu,
  Download,
  Gauge,
  Globe,
  Github,
  Layers,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { Blueprint, TabId, PartialBlueprint } from '../lib/types';
import { TabBar } from './TabBar';
import {
  FeaturesPanel,
  SchemaPanel,
  ApiPanel,
  UiPanel,
  ArchPanel,
  EffortPanel,
} from './BlueprintPanels';
import { DiagramsPanel } from './DiagramsPanel';
import { complexityMetaClass } from '../lib/utils';
import { getAuthHeaders, regenerateBlueprintStream } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useVisibilityMutation } from '../hooks/useBlueprints';
import { useToast } from '../hooks/useToast';
import { AVAILABLE_MODELS, useModel } from '../hooks/useModel';
import { RefinementChat } from './RefinementChat';
import { StreamingView } from './StreamingView';
import type { AgentEvent } from '../hooks/useStreamBlueprint';
import type { ChatMessage } from '../hooks/useRefinement';
import { useCodeGeneration } from '../hooks/useCodeGeneration';

interface BlueprintOutputProps {
  blueprint: Blueprint;
  blueprintId: string | null;
  blueprintContentKey?: string;
  isPublic?: boolean;
  isOwner?: boolean;
  onReset: () => void;
  modelUsed?: string;
  onRefineMessage?: (msg: string) => void;
  isRefining?: boolean;
  onBlueprintUpdate?: (bp: Blueprint) => void;
  refinement?: {
    messages: ChatMessage[];
    isRefining: boolean;
    onSend: (message: string) => void;
    onClear: () => void;
    sidebarOpen: boolean;
  };
}

const META_ICON = 13;

export function BlueprintOutput({
  blueprint,
  blueprintId,
  blueprintContentKey,
  isPublic = false,
  isOwner = false,
  onReset,
  modelUsed,
  onRefineMessage,
  isRefining,
  onBlueprintUpdate,
  refinement,
}: BlueprintOutputProps) {
  const [activeTab, setActiveTab] = useState<TabId>('features');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [exportingGithub, setExportingGithub] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenStreaming, setRegenStreaming] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [regenPartial, setRegenPartial] = useState<PartialBlueprint>({});
  const [regenAgentEvents, setRegenAgentEvents] = useState<AgentEvent[]>([]);
  const regenAbortRef = useRef<AbortController | null>(null);
  const { selectedModel } = useModel();
  const effectiveModel = modelUsed ?? selectedModel;
  const { user } = useAuth();
  const { toast } = useToast();
  const codegen = useCodeGeneration();
  const visibility = useVisibilityMutation(blueprintId);
  const [publicState, setPublicState] = useState(isPublic);
  const sectionRef = useRef<HTMLElement>(null);
  const [repoExists, setRepoExists] = useState<boolean | null>(null);
  const [checkingRepo, setCheckingRepo] = useState(false);

  useEffect(() => {
    setPublicState(isPublic);
  }, [isPublic, blueprintId]);

  useEffect(() => {
    if (!user) {
      setRepoExists(null);
      return;
    }

    let isMounted = true;
    async function checkRepo() {
      setCheckingRepo(true);
      try {
        const BASE_URL = import.meta.env.VITE_API_URL ?? '';
        const response = await fetch(`${BASE_URL}/api/blueprint/check-github-repo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            githubUrl: blueprint.githubUrl,
            appName: blueprint.appName,
            id: blueprintId,
          }),
        });
        if (!response.ok) throw new Error('Check failed');
        const data = await response.json();
        if (isMounted) {
          setRepoExists(data.exists);
          if (data.exists && data.repoUrl && blueprint.githubUrl !== data.repoUrl) {
            if (onBlueprintUpdate) {
              onBlueprintUpdate({ ...blueprint, githubUrl: data.repoUrl });
            }
          }
        }
      } catch (err) {
        console.error('Error checking github repo existence:', err);
        if (isMounted) {
          setRepoExists(null);
        }
      } finally {
        if (isMounted) {
          setCheckingRepo(false);
        }
      }
    }

    checkRepo();
    return () => {
      isMounted = false;
    };
  }, [blueprintId, blueprint, user]);

  const hasRepo = blueprint.githubUrl && repoExists !== false;

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const url = blueprintId
        ? `${BASE_URL}/api/blueprint/export?id=${blueprintId}`
        : `${BASE_URL}/api/blueprint/export`;

      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: blueprintId ? undefined : JSON.stringify(blueprint),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${blueprint.appName.toLowerCase().replace(/\s+/g, '-')}-scaffold.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Scaffold ZIP downloaded', 'success');
    } catch {
      setDownloadError('Download failed. Try again.');
      toast('Export failed — try again', 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleGithubExport() {
    if (!user) {
      toast('Please log in and connect your GitHub account to export repositories.', 'error');
      return;
    }
    if (!user.githubLinked) {
      toast('Please connect your GitHub account before exporting repositories.', 'error');
      return;
    }
    setExportingGithub(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const response = await fetch(`${BASE_URL}/api/blueprint/export-github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ blueprint, id: blueprintId }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch (e) {
        // Fallback for non-JSON error pages (like 502 Bad Gateway)
      }

      if (!response.ok) {
        throw new Error(data.error || `GitHub export failed (Status: ${response.status})`);
      }

      if (data.success && data.repoUrl) {
        toast(data.message || 'Successfully exported blueprint to GitHub!', 'success');
        window.open(data.repoUrl, '_blank');
        if (onBlueprintUpdate) {
          onBlueprintUpdate({ ...blueprint, githubUrl: data.repoUrl });
        }
        setRepoExists(true);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'GitHub export failed — try again', 'error');
    } finally {
      setExportingGithub(false);
    }
  }

  async function handleRegenerate() {
    if (!blueprintId) return;

    regenAbortRef.current?.abort();
    const controller = new AbortController();
    regenAbortRef.current = controller;

    setRegenerating(true);
    setRegenStreaming(true);
    setRegenProgress(0);
    setRegenPartial({});
    setRegenAgentEvents([]);

    let gotComplete = false;
    let resultBlueprint: Blueprint | null = null;

    try {
      const stream = regenerateBlueprintStream(blueprintId, effectiveModel, controller.signal);

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        switch (event.event) {
          case 'progress': {
            const data = event.data as { percent?: number };
            if (data.percent !== undefined) setRegenProgress(data.percent);
            break;
          }
          case 'agent_event': {
            const data = event.data as AgentEvent;
            setRegenAgentEvents((prev) => [
              ...prev,
              { ...data, timestamp: new Date().toLocaleTimeString() },
            ]);
            break;
          }
          case 'section': {
            const data = event.data as { key: string; value: unknown };
            setRegenPartial((prev) => ({ ...prev, [data.key]: data.value }));
            break;
          }
          case 'complete': {
            resultBlueprint = event.data as Blueprint;
            gotComplete = true;
            setRegenProgress(95);
            break;
          }
          case 'saved': {
            setRegenProgress(100);
            break;
          }
          case 'error': {
            const data = event.data as { message: string };
            throw new Error(data.message);
          }
          default:
            break;
        }
      }

      if (!controller.signal.aborted && gotComplete && resultBlueprint) {
        const withModel: Blueprint = {
          ...resultBlueprint,
          modelUsed: effectiveModel,
          ...(blueprint.githubUrl ? { githubUrl: blueprint.githubUrl } : {}),
        };
        toast('Blueprint regenerated successfully!', 'success');
        codegen.clearFiles();
        if (onBlueprintUpdate) {
          onBlueprintUpdate(withModel);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      toast((err as Error).message || 'Regeneration failed — try again', 'error');
    } finally {
      setRegenerating(false);
      setRegenStreaming(false);
      regenAbortRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      regenAbortRef.current?.abort();
    };
  }, []);

  function handleShare() {
    if (!blueprintId) return;
    const url = `${window.location.origin}/blueprint/${blueprintId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast('Share link copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      window.prompt('Copy this link:', url);
    });
  }

  function handleToggleVisibility() {
    if (!blueprintId || !user) return;
    const next = !publicState;
    visibility.mutate(next, {
      onSuccess: () => {
        setPublicState(next);
        toast(next ? 'Blueprint is now public in Gallery' : 'Blueprint is now private', 'success');
      },
      onError: () => toast('Could not update visibility', 'error'),
    });
  }

  const modelLabel = effectiveModel
    ? AVAILABLE_MODELS.find((m) => m.id === effectiveModel)?.label || effectiveModel
    : null;

  if (regenStreaming) {
    return (
      <StreamingView
        progress={regenProgress}
        partialBlueprint={regenPartial}
        agentEvents={regenAgentEvents}
      />
    );
  }

  return (
    <section
      ref={sectionRef}
      className="flex-1 min-h-0 overflow-y-auto pb-44 px-4 sm:px-6 max-w-5xl mx-auto animate-fade-slide-up custom-scrollbar"
      style={{ paddingBottom: '11rem' }}
      aria-labelledby="blueprint-title"
    >
      <div className="flex flex-col gap-4 sm:gap-6 py-5 sm:py-8">
        <div className="flex-1 min-w-0 border border-white/10 rounded-xl bg-black/45 p-5 font-mono-custom text-xs relative overflow-hidden">
          <div className="absolute right-4 top-4 text-[10px] text-white/20 select-none font-bold">
            COMMIT: {blueprintId ? blueprintId.substring(0, 7) : 'draft'}
          </div>
          
          <div className="flex items-start gap-3 mb-4">
            <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-300 font-bold select-none text-[10px]">
              λ
            </div>
            <div>
              <h2
                id="blueprint-title"
                className="text-sm font-semibold text-purple-300 leading-tight"
              >
                feat({blueprint.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}): initialize project architecture specification
              </h2>
              <div className="text-white/40 text-[10px] mt-1 select-none">
                committed by <span className="text-white/60 font-semibold">BuildX Agentic Pipeline</span> via <span className="text-purple-400 font-semibold">{modelLabel || 'AI Studio'}</span>
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-4 text-white/70 leading-relaxed mb-4 whitespace-pre-wrap">
            {blueprint.description}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] border-t border-white/5 pt-4">
            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded border border-white/[0.06] text-emerald-400 font-mono font-bold">
              + {blueprint.schema?.length ?? 0} {(blueprint.architecture?.database || '').toLowerCase().includes('mongo') ? 'collections' : 'tables'}
            </span>
            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded border border-white/[0.06] text-sky-400 font-mono font-bold">
              + {blueprint.endpoints?.length ?? 0} endpoints
            </span>
            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded border border-white/[0.06] text-purple-400 font-mono font-bold">
              + {blueprint.screens?.length ?? 0} screens
            </span>
            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded border border-white/[0.06] text-amber-400 font-mono font-bold">
              # {blueprint.complexity} complexity
            </span>
            <span className="flex items-center gap-1 bg-zinc-900/90 px-2.5 py-1 rounded border border-white/15 ml-auto text-zinc-200 font-mono text-[10px] font-medium shadow-sm">
              Audience: <span className="text-white font-semibold">{blueprint.targetUsers}</span>
            </span>
          </div>
        </div>

        <div
          className="bp-actions"
          role="toolbar"
          aria-label="Blueprint actions"
        >
          {blueprintId && (
            <button
              type="button"
              onClick={handleShare}
              aria-label={copied ? 'Link copied' : 'Copy share link'}
              className={`bp-action ${
                copied
                  ? 'bg-emerald-900/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-900/80 border-white/10 hover:border-white/25 text-zinc-300 hover:text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check size={15} strokeWidth={2} aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Link2 size={15} strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          )}

          {blueprintId && isOwner && (
            <button
              type="button"
              onClick={handleToggleVisibility}
              disabled={visibility.isPending}
              aria-pressed={publicState}
              aria-label={publicState ? 'Make blueprint private' : 'Make blueprint public'}
              className="bp-action bg-zinc-900/80 border-white/10 hover:border-white/25 text-zinc-300 hover:text-white"
            >
              {publicState ? (
                <>
                  <Globe size={15} strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">Public</span>
                </>
              ) : (
                <>
                  <Lock size={15} strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">Private</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-busy={downloading}
            className="bp-action bg-zinc-900/80 border-white/10 hover:border-white/25 text-zinc-300 hover:text-white"
          >
            <Download size={15} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">{downloading ? 'Exporting…' : 'Download'}</span>
            <span className="sm:hidden">{downloading ? '…' : ''}</span>
          </button>

          {isOwner && (
            <>
              <button
                type="button"
                onClick={handleGithubExport}
                disabled={exportingGithub || checkingRepo}
                aria-busy={exportingGithub}
                className="bp-action bg-zinc-900/80 border-white/10 hover:border-white/25 text-zinc-300 hover:text-white"
                title={hasRepo ? 'Push updated scaffold files to your existing GitHub repository' : 'Export this project scaffold to a new repository on your GitHub account'}
              >
                <Github size={15} strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">
                  {exportingGithub ? 'Pushing…' : checkingRepo ? 'Checking…' : hasRepo ? 'Update on GitHub' : 'Export to GitHub'}
                </span>
                <span className="sm:hidden">{exportingGithub || checkingRepo ? '…' : ''}</span>
              </button>

              {hasRepo && (
                <a
                  href={blueprint.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bp-action bg-zinc-900/80 border-white/10 hover:border-white/25 text-zinc-300 hover:text-white animate-fade-in"
                  title="Visit the generated repository on GitHub"
                >
                  <Github size={15} strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">View on GitHub</span>
                  <span className="sm:hidden">View</span>
                </a>
              )}

              {blueprintId && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  aria-busy={regenerating}
                  className="bp-action bg-zinc-900/80 border-white/10 hover:border-white/25 text-zinc-300 hover:text-white"
                  title="Re-generate this blueprint from scratch using its original idea"
                >
                  <RefreshCw size={15} strokeWidth={2} aria-hidden className={regenerating ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">{regenerating ? 'Regenerating…' : 'Regenerate'}</span>
                </button>
              )}
            </>
          )}

          <button type="button" onClick={onReset} className="bp-action bg-zinc-900/80 border-white/10 hover:border-white/25 text-zinc-300 hover:text-white">
            <Plus size={15} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      {downloadError && (
        <p className="text-xs mb-4 font-mono-custom" style={{ color: 'var(--coral)' }} role="alert">
          {downloadError}
        </p>
      )}

      {visibility.isError && (
        <p className="text-xs mb-4 font-mono-custom" style={{ color: 'var(--coral)' }} role="alert">
          Could not update visibility. Try again.
        </p>
      )}

      <div className="tab-bar-sticky">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'features' && <FeaturesPanel blueprint={blueprint} />}
      {activeTab === 'schema' && <SchemaPanel blueprint={blueprint} />}
      {activeTab === 'api' && <ApiPanel blueprint={blueprint} />}
      {activeTab === 'ui' && <UiPanel blueprint={blueprint} />}
      {activeTab === 'architecture' && <ArchPanel blueprint={blueprint} />}
      {activeTab === 'diagrams' && <DiagramsPanel blueprint={blueprint} />}

      {activeTab === 'effort' && <EffortPanel blueprint={blueprint} />}

      {refinement && (
        <RefinementChat
          anchorRef={sectionRef}
          blueprint={blueprint}
          layoutSyncKey={refinement.sidebarOpen}
          messages={refinement.messages}
          isRefining={refinement.isRefining}
          onSend={refinement.onSend}
          onClear={refinement.onClear}
        />
      )}
    </section>
  );
}
