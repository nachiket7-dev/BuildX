import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Cpu,
  Download,
  Gauge,
  Globe,
  Layers,
  Link2,
  Lock,
  Plus,
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
  refinement,
}: BlueprintOutputProps) {
  const [activeTab, setActiveTab] = useState<TabId>('features');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 py-6 sm:py-8">
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
          className="bp-actions -order-1 sm:order-none"
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
                  Share
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
                  Public
                </>
              ) : (
                <>
                  <Lock size={15} strokeWidth={2} aria-hidden />
                  Private
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
            {downloading ? 'Exporting…' : 'Download'}
          </button>

          <button type="button" onClick={onReset} className="bp-action bp-action--ghost">
            <Plus size={15} strokeWidth={2} aria-hidden />
            New
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
