import { useState, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { complexityColor } from '../lib/utils';
import { useBlueprintList } from '../hooks/useBlueprints';
import { SpotlightCard } from './SpotlightCard';
import { BlueprintCardSkeleton } from './BlueprintCardSkeleton';
import { PageHead } from './PageHead';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Eye, Code2, Database, Shield, ArrowRight, Layers, ChevronRight } from 'lucide-react';

import { ScrollReveal } from './animations/ScrollReveal';
import { StaggerGridContainer, StaggerGridItem } from './animations/StaggerGrid';
import { modalBackdrop, modalPanel } from '../lib/motion';

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const FILTER_TABS = ['All', 'Full-Stack', 'AI Agents', 'Dashboards'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

export function GalleryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [complexityFilter, setComplexityFilter] = useState<'All' | 'Low' | 'Medium' | 'High'>('All');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  const scope = (user && searchParams.get('scope') === 'mine') ? 'mine' : 'public';
  const isPersonal = scope === 'mine';

  const { data: items = [], isLoading, isError, refetch } = useBlueprintList(
    scope,
    scope === 'mine' ? Boolean(user) : true
  );

  const filteredItems = useMemo(() => {
    return items.filter((item: any) => {
      const matchesSearch =
        (item?.appName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item?.description ?? item?.idea ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesComplexity =
        complexityFilter === 'All' || item?.complexity === complexityFilter;
      return matchesSearch && matchesComplexity;
    });
  }, [items, searchQuery, complexityFilter]);

  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <PageHead
        title={isPersonal ? 'My Blueprints — BuildX' : 'Architecture Library — BuildX'}
        description={
          isPersonal
            ? 'Your generated full-stack app blueprints'
            : 'Browse production-grade community blueprints built with BuildX multi-model AI.'
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-24">

        {/* ── Page Header ──────────────────────────────────────── */}
        <ScrollReveal direction="down" delay={0.05}>
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono tracking-widest text-norvin-muted uppercase">
                02 / ARCHITECTURE LIBRARY
              </span>
              {isPersonal && (
                <>
                  <ChevronRight size={11} className="text-neutral-700" />
                  <span className="text-[10px] font-mono text-sylven-light bg-sylven-glow px-1.5 py-0.5 rounded border border-sylven/30">
                    MY WORKSPACE
                  </span>
                </>
              )}
            </div>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-white tracking-tight leading-none mb-3">
                  {isPersonal ? 'My Blueprints' : 'Community Gallery'}
                </h1>
                <p className="text-sm text-norvin-muted max-w-xl leading-relaxed">
                  {isPersonal
                    ? 'Your saved application blueprints. Click any card to inspect DDL schemas, endpoints, or open in Studio IDE.'
                    : 'Explore production-grade full-stack architectures built by the community.'}
                </p>
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/create" className="landing-btn landing-btn--primary">
                  <span>New Blueprint</span>
                  <ArrowRight size={14} className="landing-btn__icon" />
                </Link>
              </motion.div>
            </div>
          </div>
        </ScrollReveal>

        {/* ── Sticky Glass Filter Bar ───────────────────────────── */}
        <ScrollReveal direction="up" delay={0.1}>
          <div className="sticky top-14 z-30 mb-8">
            <div className="p-3 rounded-2xl border border-obsidian-border bg-obsidian-surface/90 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-norvin-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blueprints…"
                  className="w-full pl-10 pr-8 py-2 rounded-xl bg-obsidian-bg border border-obsidian-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sylven/50 font-mono transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Gliding Filter Tabs */}
              <div className="flex items-center p-1 rounded-xl bg-obsidian-panel border border-obsidian-border text-xs font-mono relative">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`relative px-3 py-1 rounded-lg transition-colors z-10 ${
                      activeFilter === tab ? 'text-white' : 'text-norvin-muted hover:text-white'
                    }`}
                  >
                    {activeFilter === tab && (
                      <motion.div
                        layoutId="galleryActiveTab"
                        className="absolute inset-0 rounded-lg bg-sylven/20 border border-sylven/40"
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10">{tab}</span>
                  </button>
                ))}
              </div>

              {/* Scope Switch (if logged in) */}
              {user && (
                <div className="flex items-center p-1 rounded-xl bg-obsidian-panel border border-obsidian-border text-xs font-mono shrink-0">
                  {(['public', 'mine'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSearchParams({ scope: s })}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        scope === s
                          ? 'bg-sylven/20 text-sylven-light border border-sylven/40'
                          : 'text-norvin-muted hover:text-white'
                      }`}
                    >
                      {s === 'public' ? 'Community' : `Mine (${items.length})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>

        {/* ── Loading Skeleton ──────────────────────────────────── */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <BlueprintCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Error State ───────────────────────────────────────── */}
        {isError && (
          <div className="rounded-2xl p-8 text-center bg-red-950/20 border border-red-500/20">
            <p className="text-sm font-mono text-red-400 mb-4">Failed to load blueprints.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono text-white border border-white/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────── */}
        {!isLoading && !isError && filteredItems.length === 0 && (
          <div className="rounded-3xl p-12 text-center border border-white/[0.07] bg-[#111116]/60 backdrop-blur-xl">
            <div className="w-12 h-12 rounded-2xl bg-sylven/10 border border-sylven/20 flex items-center justify-center mx-auto mb-4 text-sylven-light">
              <Layers size={22} />
            </div>
            <h2 className="font-display font-bold text-lg text-white mb-2">
              {searchQuery ? 'No matching blueprints' : isPersonal ? 'No blueprints yet' : 'No public blueprints'}
            </h2>
            <p className="text-xs text-norvin-muted max-w-sm mx-auto mb-6 leading-relaxed">
              {searchQuery
                ? `Try adjusting your search query or reset filters.`
                : 'Generate your first full-stack application blueprint.'}
            </p>
            <Link to="/create" className="landing-btn landing-btn--primary">
              <span>Create Blueprint</span>
              <ArrowRight size={14} className="landing-btn__icon" />
            </Link>
          </div>
        )}

        {/* ── Blueprint Grid ────────────────────────────────────── */}
        {!isLoading && filteredItems.length > 0 && (
          <StaggerGridContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item: any, idx: number) => {
              const num = String(idx + 1).padStart(2, '0');
              const name = (item?.appName ?? 'Untitled').toUpperCase();
              return (
                <StaggerGridItem key={item?.id ?? idx}>
                  <SpotlightCard
                    className="h-full p-5 flex flex-col justify-between group cursor-pointer relative bg-obsidian-surface border border-obsidian-border rounded-2xl"
                    spotlightColor="rgba(16, 185, 129, 0.15)"
                    onClick={() => navigate(`/blueprint/${item?.id}`)}
                  >
                    {/* Numbered Header */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-mono text-norvin-muted">{num} /</span>
                        <h3 className="font-mono text-xs font-semibold text-neutral-300 group-hover:text-white transition-colors truncate flex-1 tracking-wide">
                          {name}
                        </h3>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${complexityColor(item?.complexity)}`}>
                          {item?.complexity ?? 'Medium'}
                        </span>
                      </div>
                      <p className="text-xs text-norvin-muted leading-relaxed line-clamp-2 font-sans">
                        {item?.description ?? item?.idea ?? ''}
                      </p>
                    </div>

                    {/* Model Pipeline Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4 font-mono">
                      {['Nemotron', 'Gemini', 'Kimi K2'].map((model) => (
                        <span key={model} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-obsidian-panel border border-obsidian-border text-norvin-muted">
                          {model}
                        </span>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between font-mono text-[10px]">
                      <span className="text-norvin-muted">{timeAgo(item?.createdAt ?? '')}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                          className="px-2 py-1 rounded bg-obsidian-panel hover:bg-obsidian-surface text-norvin-muted hover:text-white transition-colors flex items-center gap-1 border border-obsidian-border"
                          title="Quick Preview"
                        >
                          <Eye size={10} />
                          <span>Preview</span>
                        </button>
                        <span className="text-sylven-light group-hover:text-white group-hover:translate-x-0.5 transition-all">
                          Inspect →
                        </span>
                      </div>
                    </div>
                  </SpotlightCard>
                </StaggerGridItem>
              );
            })}
          </StaggerGridContainer>
        )}
      </div>

      {/* ── Slide-over Quick Inspector Drawer ─────────────────── */}
      <AnimatePresence>
        {previewItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewItem(null)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-obsidian-surface border-l border-obsidian-border p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
            >
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-obsidian-borderSubtle">
                  <div>
                    <span className="text-[10px] font-mono text-sylven-light uppercase tracking-widest block mb-1">
                      Quick Inspection
                    </span>
                    <h3 className="font-display font-bold text-lg text-white">
                      {previewItem?.appName ?? 'Untitled'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-1.5 rounded-lg bg-obsidian-panel hover:bg-obsidian-surface text-norvin-muted hover:text-white transition-colors border border-obsidian-border"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-[10px] font-mono text-sylven-light uppercase tracking-widest mb-2">Spec Overview</h4>
                  <p className="text-xs text-neutral-300 leading-relaxed font-sans">{previewItem?.description ?? previewItem?.idea ?? ''}</p>
                </div>

                {/* Quick Spec */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-3 rounded-xl bg-obsidian-panel border border-obsidian-border">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white font-mono mb-1">
                      <Code2 size={12} className="text-cyan-400" />
                      Endpoints
                    </div>
                    <div className="text-2xl font-bold font-mono text-cyan-300">{previewItem?.endpointsCount ?? 8}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-obsidian-panel border border-obsidian-border">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white font-mono mb-1">
                      <Database size={12} className="text-sylven-light" />
                      DB Schemas
                    </div>
                    <div className="text-2xl font-bold font-mono text-sylven-light">{previewItem?.schemaCount ?? 4}</div>
                  </div>
                </div>

                {/* Model Router Telemetry */}
                <div className="p-4 rounded-xl bg-obsidian-panel border border-obsidian-border font-mono text-xs space-y-2">
                  <div className="flex items-center gap-2 text-sylven-light font-semibold text-[11px]">
                    <Shield size={12} className="text-sylven-light" />
                    Multi-Model Router Telemetry
                  </div>
                  <div className="text-[10px] text-norvin-muted space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sylven" />
                      Planning: Nemotron 3 Ultra 550B
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Code Diffing: Z-AI GLM-5.2
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Auto-Fix: Gemini Flash
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="pt-6 border-t border-obsidian-borderSubtle flex items-center justify-between gap-3">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2 rounded-xl bg-obsidian-panel hover:bg-obsidian-surface text-xs font-mono text-norvin-muted hover:text-white transition-colors border border-obsidian-border"
                >
                  Close
                </button>
                <button
                  onClick={() => { navigate(`/blueprint/${previewItem?.id}`); setPreviewItem(null); }}
                  className="landing-btn landing-btn--primary"
                >
                  <span>Open Full Blueprint</span>
                  <ArrowRight size={14} className="landing-btn__icon" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
