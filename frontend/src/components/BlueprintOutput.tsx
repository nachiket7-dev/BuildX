import React, { useState } from 'react';
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
import { complexityColor } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { AVAILABLE_MODELS } from '../hooks/useModel';

interface BlueprintOutputProps {
  blueprint: Blueprint;
  blueprintId: string | null;
  onReset: () => void;
  modelUsed?: string;
}

export function BlueprintOutput({ blueprint, blueprintId, onReset, modelUsed }: BlueprintOutputProps) {
  const [activeTab, setActiveTab] = useState<TabId>('features');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { user, token } = useAuth();
  const [isPublic, setIsPublic] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const url = blueprintId
        ? `${BASE_URL}/api/blueprint/export?id=${blueprintId}`
        : `${BASE_URL}/api/blueprint/export`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }

  function handleShare() {
    if (!blueprintId) return;
    const url = `${window.location.origin}/blueprint/${blueprintId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: show the URL in a prompt
      window.prompt('Copy this link:', url);
    });
  }

  async function handleToggleVisibility() {
    if (!blueprintId || !token) return;
    setTogglingVisibility(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE_URL}/api/blueprint/${blueprintId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_public: !isPublic }),
      });
      if (res.ok) {
        setIsPublic(!isPublic);
      }
    } catch {
      // silent
    } finally {
      setTogglingVisibility(false);
    }
  }

  return (
    <section className="px-4 sm:px-6 pb-24 max-w-5xl mx-auto animate-fade-slide-up">
      {/* Output header */}
      <div className="flex items-start justify-between gap-6 py-8 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2
            className="font-display font-extrabold tracking-tight mb-2"
            style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-1px', color: 'var(--text)' }}
          >
            {blueprint.appName}
          </h2>
          <p
            className="text-sm leading-relaxed mb-3 max-w-2xl"
            style={{ color: 'var(--text2)' }}
          >
            {blueprint.description}
          </p>
          <div className="flex flex-wrap gap-2">
            <span
              className="font-mono-custom text-xs px-3 py-1 rounded-full border"
              style={{
                color: 'var(--blue)',
                borderColor: 'rgba(96,165,250,0.3)',
                background: 'var(--blue-dim)',
              }}
            >
              👥 {blueprint.targetUsers}
            </span>
            <span
              className={`font-mono-custom text-xs px-3 py-1 rounded-full border ${complexityColor(blueprint.complexity)}`}
            >
              ⚡ {blueprint.complexity} Complexity
            </span>
            <span
              className="font-mono-custom text-xs px-3 py-1 rounded-full border"
              style={{
                color: 'var(--green)',
                borderColor: 'rgba(34,211,165,0.3)',
                background: 'var(--green-dim)',
              }}
            >
              {blueprint.schema.length} tables · {blueprint.endpoints.length} endpoints · {blueprint.screens.length} screens
            </span>
            {modelUsed && (
              <span
                className="font-mono-custom text-xs px-3 py-1 rounded-full border"
                style={{
                  color: 'var(--accent2)',
                  borderColor: 'rgba(124,106,255,0.3)',
                  background: 'var(--accent-glow)',
                }}
              >
                🧠 {AVAILABLE_MODELS.find(m => m.id === modelUsed)?.label || modelUsed}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {/* Share button */}
          {blueprintId && (
            <button
              onClick={handleShare}
              title="Share blueprint link"
              className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-[10px] border text-xs sm:text-sm transition-all duration-150"
              style={{
                background: copied ? 'var(--green-dim)' : 'var(--accent-glow)',
                borderColor: copied ? 'rgba(34,211,165,0.3)' : 'rgba(124,106,255,0.3)',
                color: copied ? 'var(--green)' : 'var(--accent2)',
              }}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          )}

          {/* Visibility toggle — only for blueprint owners */}
          {blueprintId && user && (
            <button
              onClick={handleToggleVisibility}
              disabled={togglingVisibility}
              title={isPublic ? 'Make blueprint private' : 'Make blueprint public'}
              className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-[10px] border text-xs sm:text-sm transition-all duration-150 disabled:opacity-50"
              style={{
                background: isPublic ? 'var(--green-dim)' : 'var(--surface2)',
                borderColor: isPublic ? 'rgba(34,211,165,0.3)' : 'var(--border2)',
                color: isPublic ? 'var(--green)' : 'var(--text3)',
              }}
            >
              {isPublic ? '🌐' : '🔒'}
              <span className="hidden sm:inline">{isPublic ? 'Public' : 'Private'}</span>
            </button>
          )}

          {/* Download project button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            title="Download project scaffold"
            className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-[10px] border text-xs sm:text-sm transition-all duration-150 disabled:opacity-50"
            style={{
              background: 'var(--green-dim)',
              borderColor: 'rgba(34,211,165,0.3)',
              color: 'var(--green)',
            }}
          >
            {downloading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin-slow" />
                <span className="hidden sm:inline">Exporting...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span className="hidden sm:inline">Download</span>
              </>
            )}
          </button>

          {/* New blueprint button */}
          <button
            onClick={onReset}
            title="Start new blueprint"
            className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-[10px] border text-xs sm:text-sm transition-all duration-150"
            style={{
              background: 'var(--surface2)',
              borderColor: 'var(--border2)',
              color: 'var(--text2)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = 'var(--text)';
              el.style.borderColor = 'var(--border)';
              el.style.background = 'var(--surface3)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = 'var(--text2)';
              el.style.borderColor = 'var(--border2)';
              el.style.background = 'var(--surface2)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab panels */}
      {activeTab === 'features' && <FeaturesPanel blueprint={blueprint} />}
      {activeTab === 'schema' && <SchemaPanel blueprint={blueprint} />}
      {activeTab === 'api' && <ApiPanel blueprint={blueprint} />}
      {activeTab === 'ui' && <UiPanel blueprint={blueprint} />}
      {activeTab === 'architecture' && <ArchPanel blueprint={blueprint} />}
      {activeTab === 'diagrams' && <DiagramsPanel blueprint={blueprint} />}
      {activeTab === 'code' && <CodePanel blueprint={blueprint} />}
      {activeTab === 'effort' && <EffortPanel blueprint={blueprint} />}
    </section>
  );
}
