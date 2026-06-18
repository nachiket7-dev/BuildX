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
import type { Blueprint, TabId } from '../lib/types';
import { TabBar } from './TabBar';
import {
  FeaturesPanel,
  SchemaPanel,
  ApiPanel,
  UiPanel,
  ArchPanel,
  CodePanel,
  EffortPanel,
} from './BlueprintPanels';
import { DiagramsPanel } from './DiagramsPanel';
import { complexityMetaClass } from '../lib/utils';
import { getAuthHeaders } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useVisibilityMutation } from '../hooks/useBlueprints';
import { useToast } from '../hooks/useToast';
import { AVAILABLE_MODELS } from '../hooks/useModel';
import { RefinementChat } from './RefinementChat';
import type { ChatMessage } from '../hooks/useRefinement';

interface BlueprintOutputProps {
  blueprint: Blueprint;
  blueprintId: string | null;
  isPublic?: boolean;
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
  isPublic = false,
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
  const { user } = useAuth();
  const { toast } = useToast();
  const visibility = useVisibilityMutation(blueprintId);
  const [publicState, setPublicState] = useState(isPublic);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPublicState(isPublic);
  }, [isPublic, blueprintId]);

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

      if (!response.ok) throw new Error('GitHub export failed');

      const data = await response.json();
      if (data.success && data.repoUrl) {
        toast(`Exported! Repository created at ${data.repoUrl}`, 'success');
        window.open(data.repoUrl, '_blank');
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      toast('GitHub export failed — try again', 'error');
    } finally {
      setExportingGithub(false);
    }
  }

  async function handleRegenerate() {
    if (!blueprintId) return;
    setRegenerating(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const response = await fetch(`${BASE_URL}/api/blueprint/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ id: blueprintId, model: modelUsed }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Regeneration failed');
      }

      const data = await response.json();
      if (data.success && data.data) {
        toast('Blueprint regenerated successfully!', 'success');
        if (onBlueprintUpdate) {
          onBlueprintUpdate(data.data);
        } else {
          window.location.reload();
        }
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      toast((err as Error).message || 'Regeneration failed — try again', 'error');
    } finally {
      setRegenerating(false);
    }
  }

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

  const modelLabel = modelUsed
    ? AVAILABLE_MODELS.find((m) => m.id === modelUsed)?.label || modelUsed
    : null;

  return (
    <section
      ref={sectionRef}
      className="px-4 sm:px-6 pb-28 max-w-5xl mx-auto animate-fade-slide-up"
      aria-labelledby="blueprint-title"
    >
      <div className="flex flex-col gap-4 sm:gap-6 py-5 sm:py-8">
        <div className="flex-1 min-w-0">
          <h2
            id="blueprint-title"
            className="font-display font-extrabold tracking-tight mb-2 bg-gradient-to-r from-white via-slate-100 to-purple-400 bg-clip-text text-transparent"
            style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-1.5px' }}
          >
            {blueprint.appName}
          </h2>
          <p className="text-sm leading-relaxed mb-3 max-w-2xl" style={{ color: 'var(--text2)' }}>
            {blueprint.description}
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2" role="list" aria-label="Blueprint metadata">
            <span className="bp-meta bp-meta--audience" role="listitem">
              <Users size={META_ICON} strokeWidth={2} aria-hidden />
              {blueprint.targetUsers}
            </span>
            <span className={complexityMetaClass(blueprint.complexity)} role="listitem">
              <Gauge size={META_ICON} strokeWidth={2} aria-hidden />
              {blueprint.complexity} complexity
            </span>
            <span className="bp-meta bp-meta--stats" role="listitem">
              <Layers size={META_ICON} strokeWidth={2} aria-hidden />
              {blueprint.schema.length} tables
              <span className="bp-meta__sep" aria-hidden>
                ·
              </span>
              {blueprint.endpoints.length} endpoints
              <span className="bp-meta__sep" aria-hidden>
                ·
              </span>
              {blueprint.screens.length} screens
            </span>
            {modelLabel && (
              <span className="bp-meta bp-meta--model" role="listitem">
                <Cpu size={META_ICON} strokeWidth={2} aria-hidden />
                {modelLabel}
              </span>
            )}
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
              className={`bp-action ${copied ? 'bp-action--success' : 'bp-action--accent'}`}
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

          {blueprintId && user && (
            <button
              type="button"
              onClick={handleToggleVisibility}
              disabled={visibility.isPending}
              aria-pressed={publicState}
              aria-label={publicState ? 'Make blueprint private' : 'Make blueprint public'}
              className={`bp-action ${
                publicState ? 'bp-action--visibility-public' : 'bp-action--visibility-private'
              }`}
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
            className="bp-action bp-action--mint"
          >
            <Download size={15} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">{downloading ? 'Exporting…' : 'Download'}</span>
            <span className="sm:hidden">{downloading ? '…' : ''}</span>
          </button>

          {blueprintId && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              aria-busy={regenerating}
              className="bp-action bp-action--ghost"
              title="Re-generate this blueprint from scratch using its original idea"
            >
              <RefreshCw size={15} strokeWidth={2} aria-hidden className={regenerating ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{regenerating ? 'Regenerating…' : 'Regenerate'}</span>
            </button>
          )}

          <button type="button" onClick={onReset} className="bp-action bp-action--ghost">
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
      {activeTab === 'code' && (
        <CodePanel blueprint={blueprint} onRefineMessage={onRefineMessage} isRefining={isRefining} />
      )}
      {activeTab === 'effort' && <EffortPanel blueprint={blueprint} />}

      {refinement && (
        <RefinementChat
          anchorRef={sectionRef}
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
