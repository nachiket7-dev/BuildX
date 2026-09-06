import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { complexityColor } from '../lib/utils';
import { useBlueprintList } from '../hooks/useBlueprints';
import { SpotlightCard } from './SpotlightCard';
import { BlueprintCardSkeleton } from './BlueprintCardSkeleton';
import { PageHead } from './PageHead';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Eye, Code2, Database, Shield, ArrowRight, Layers, Sparkles, Globe, Lock, Clock, Layout } from 'lucide-react';

import { ScrollReveal } from './animations/ScrollReveal';
import { StaggerGridContainer, StaggerGridItem } from './animations/StaggerGrid';
import { SegmentedControl } from './ui/primitives';
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

export function classifyBlueprintCategory(item: { appName?: string; description?: string; idea?: string }): 'Full-Stack' | 'AI Agents' | 'Dashboards' {
  const text = `${item?.appName || ''} ${item?.description || ''} ${item?.idea || ''}`.toLowerCase();

  if (/\b(ai|agent|agents|llm|gpt|assistant|bot|rag|cortex|neural|prompt|copilot|automation|ml|model)\b/i.test(text)) {
    return 'AI Agents';
  }
  if (/\b(dashboard|dashboards|admin|analytics|metrics|monitoring|tracker|crm|portal|visualizer|booking|calendar|management)\b/i.test(text)) {
    return 'Dashboards';
  }
  return 'Full-Stack';
}

interface GalleryPageProps {
  defaultScope?: 'mine' | 'public';
}

export function GalleryPage({ defaultScope }: GalleryPageProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [complexityFilter, setComplexityFilter] = useState<'All' | 'Low' | 'Medium' | 'High'>('All');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  // Compute active scope from searchParam (?scope=mine) or defaultScope prop
  const queryScope = searchParams.get('scope') as 'mine' | 'public' | null;
  const requestedScope = queryScope === 'mine' ? 'mine' : (defaultScope ?? 'public');
  const isPersonal = Boolean(user && requestedScope === 'mine');
  const scope: 'mine' | 'public' = (requestedScope === 'mine' && user) ? 'mine' : 'public';
  const isViewingMineUnauthenticated = requestedScope === 'mine' && !user;

  const { data: items = [], isLoading, isError, refetch } = useBlueprintList(
    scope,
    scope === 'mine' ? Boolean(user) : true
  );

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      All: items.length,
      'Full-Stack': 0,
      'AI Agents': 0,
      Dashboards: 0,
    };
    items.forEach((item: any) => {
      const cat = classifyBlueprintCategory(item);
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      }
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item: any) => {
      // 1. Search Query Match
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item?.appName ?? '').toLowerCase().includes(q) ||
        (item?.description ?? item?.idea ?? '').toLowerCase().includes(q) ||
        (item?.id ?? '').toLowerCase().includes(q);

      // 2. Complexity Filter Match (case-insensitive)
      const itemComplexity = (item?.complexity ?? 'Medium').toLowerCase();
      const matchesComplexity =
        complexityFilter === 'All' || itemComplexity === complexityFilter.toLowerCase();

      // 3. Archetype / Category Tab Filter Match
      const category = classifyBlueprintCategory(item);
      const matchesCategory =
        activeFilter === 'All' || category === activeFilter;

      return matchesSearch && matchesComplexity && matchesCategory;
    });
  }, [items, searchQuery, complexityFilter, activeFilter]);

  const handleScopeChange = (newScope: 'mine' | 'public') => {
    if (newScope === 'mine') {
      setSearchParams({ scope: 'mine' });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <PageHead
        title={isPersonal ? 'My Blueprints — BuildX' : 'Architecture Library — BuildX'}
        description={
          isPersonal
            ? 'Your generated full-stack app blueprints and database schemas.'
            : 'Browse production-grade community blueprints built with BuildX multi-model AI.'
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">

        {/* ── Page Header ──────────────────────────────────────── */}
        <ScrollReveal direction="down" delay={0.05}>
          <div className="mb-10">
            {/* Top Breadcrumb & Switcher Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 font-sans text-xs text-zinc-400">
                <span className="text-indigo-400 font-semibold">02 / ARCHITECTURE REPOSITORY</span>
                <span>•</span>
                <span className="text-zinc-500">{isPersonal ? 'PERSONAL WORKSPACE' : 'COMMUNITY SHOWCASE'}</span>
              </div>

              {/* Scope Switcher */}
              <SegmentedControl
                ariaLabel="Gallery scope"
                className="self-start sm:self-auto"
                value={requestedScope}
                onChange={handleScopeChange}
                options={[
                  {
                    value: 'mine',
                    label: (
                      <>
                        My Blueprints
                        {user && items.length > 0 && requestedScope === 'mine' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#7C7CF4]/20 text-[#B8B8FA] font-mono">
                            {items.length}
                          </span>
                        )}
                      </>
                    ),
                    icon: <Sparkles size={12} />,
                  },
                  { value: 'public', label: 'Community Gallery', icon: <Globe size={12} /> },
                ]}
              />
            </div>

            {/* Title & Primary CTA */}
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight leading-tight mb-2.5">
                  {isPersonal ? 'My architectures' : 'Architecture gallery'}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-xl leading-relaxed">
                  {isPersonal
                    ? 'Inspect your production-grade database DDL schemas, Express/Next.js API routes, UI wireframes, and launch directly into Code Studio IDE.'
                    : 'Explore battle-tested full-stack architectures and monorepos synthesized across frontier AI models.'}
                </p>
              </div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/create"
                  className="px-5 py-2.5 rounded-lg bg-[#7C7CF4] hover:bg-[#8F8FF7] text-[#0A0A0B] shadow-sm font-semibold text-xs flex items-center gap-2 transition-colors"
                >
                  <span>+ Create Blueprint</span>
                  <ArrowRight size={14} />
                </Link>
              </motion.div>
            </div>
          </div>
        </ScrollReveal>

        {/* ── Sticky Glass Filter Bar ───────────────────────────── */}
        <ScrollReveal direction="up" delay={0.1}>
          <div className="sticky top-14 z-30 mb-8">
            <div className="p-3 rounded-2xl border border-white/[0.07] bg-[#0A0A0B]/90 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blueprints…"
                  className="w-full pl-10 pr-8 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500/40 font-sans transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Gliding Filter Tabs */}
              <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs font-sans relative overflow-x-auto max-w-full">
                {FILTER_TABS.map((tab) => {
                  const count = tabCounts[tab] ?? 0;
                  const isSelected = activeFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveFilter(tab)}
                      className={`relative px-3 py-1.5 rounded-lg transition-all z-10 flex items-center gap-1.5 whitespace-nowrap ${
                        isSelected ? 'text-white font-semibold' : 'text-neutral-500 hover:text-white'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="galleryActiveTab"
                          className="absolute inset-0 rounded-lg bg-indigo-500/20 border border-indigo-500/40 shadow-sm"
                          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10">{tab}</span>
                      <span
                        className={`relative z-10 text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
                          isSelected
                            ? 'bg-indigo-500/30 text-indigo-200 border-indigo-500/40'
                            : 'bg-white/[0.04] text-neutral-500 border-white/[0.06]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Complexity Dropdown / Quick Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-sans text-zinc-500 hidden lg:inline uppercase tracking-wider">
                  COMPLEXITY:
                </span>
                <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs font-sans relative">
                  {(['All', 'Low', 'Medium', 'High'] as const).map((lvl) => {
                    const isSelected = complexityFilter === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setComplexityFilter(lvl)}
                        className={`relative px-2.5 py-1 rounded-lg transition-colors z-10 ${
                          isSelected
                            ? 'text-indigo-200 font-semibold'
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="galleryComplexityActiveTab"
                            className="absolute inset-0 rounded-lg bg-indigo-500/20 border border-indigo-500/30"
                            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                          />
                        )}
                        <span className="relative z-10">{lvl}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* ── Unauthenticated "My Blueprints" State ─────────────── */}
        {isViewingMineUnauthenticated ? (
          <div className="rounded-3xl p-12 text-center border border-white/[0.07] bg-[#111113]/60 backdrop-blur-xl max-w-lg mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
              <Lock size={22} />
            </div>
            <h2 className="font-display font-bold text-lg text-white mb-2">
              Sign in to view your blueprints
            </h2>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6 leading-relaxed">
              Your generated architectures, database schemas, and Code Studio monorepos are securely synced to your account.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/login"
                state={{ from: '/gallery?scope=mine' }}
                className="px-5 py-2.5 rounded-lg bg-[#7C7CF4] hover:bg-[#8F8FF7] text-[#0A0A0B] shadow-sm font-semibold text-xs transition-colors"
              >
                Sign In
              </Link>
              <button
                type="button"
                onClick={() => handleScopeChange('public')}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-neutral-400 hover:text-white border border-white/10 transition-colors"
              >
                Browse Community
              </button>
            </div>
          </div>
        ) : (
          <>
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
                <p className="text-sm font-sans text-red-400 mb-4">Failed to load blueprints.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-sans text-white border border-white/10 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* ── Empty State ───────────────────────────────────────── */}
            {!isLoading && !isError && filteredItems.length === 0 && (
              <div className="rounded-3xl p-12 text-center border border-white/[0.07] bg-[#111113]/60 backdrop-blur-xl">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
                  <Layers size={22} />
                </div>
                <h2 className="font-display font-bold text-lg text-white mb-2">
                  {searchQuery || activeFilter !== 'All' || complexityFilter !== 'All'
                    ? 'No matching blueprints'
                    : isPersonal
                    ? 'No blueprints yet'
                    : 'No public blueprints'}
                </h2>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4 leading-relaxed">
                  {searchQuery || activeFilter !== 'All' || complexityFilter !== 'All'
                    ? `No architectures matched the current search or filter criteria.`
                    : isPersonal
                    ? 'Generate your first full-stack application blueprint with our unified agent pipeline.'
                    : 'No public community blueprints are currently available.'}
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {(searchQuery || activeFilter !== 'All' || complexityFilter !== 'All') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveFilter('All');
                        setComplexityFilter('All');
                      }}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-indigo-300 hover:text-white border border-indigo-500/30 transition-colors flex items-center gap-1.5"
                    >
                      <X size={13} />
                      <span>Reset Filters</span>
                    </button>
                  )}
                  <Link
                    to="/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7C7CF4] hover:bg-[#8F8FF7] text-[#0A0A0B] shadow-sm font-semibold text-xs transition-colors"
                  >
                    <span>+ Create Blueprint</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}

        {/* ── Blueprint Grid ────────────────────────────────────── */}
        {!isLoading && filteredItems.length > 0 && (
          <StaggerGridContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item: any, idx: number) => {
              const num = String(idx + 1).padStart(2, '0');
              const name = item?.appName ?? 'Untitled App';
              const category = classifyBlueprintCategory(item);
              const endpointsCount = item?.endpointsCount ?? 0;
              const schemaCount = item?.schemaCount ?? 0;
              const screensCount = item?.screensCount ?? 0;
              const complexity = item?.complexity ?? 'Medium';

              const categoryBadgeStyle =
                category === 'AI Agents'
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                  : category === 'Dashboards'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';

              return (
                <StaggerGridItem key={item?.id ?? idx} className="h-full">
                  <SpotlightCard
                    fillHeight
                    spotlightColor="rgba(124, 124, 244, 0.16)"
                    className="h-full p-5 rounded-2xl bg-[#111113]/90 border border-white/[0.08] hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between group cursor-pointer shadow-xl shadow-black/40 hover:shadow-indigo-950/30 hover:-translate-y-1"
                    onClick={() => navigate(`/blueprint/${item?.id}`)}
                  >
                    {/* Top Section */}
                    <div>
                      {/* Top Header Row: Index Number + App Title + Category Badge + Complexity Badge */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">{num} /</span>
                        <h3 className="font-display text-sm font-bold text-white group-hover:text-indigo-200 transition-colors truncate flex-1 tracking-tight">
                          {name}
                        </h3>
                        <span className={`text-[9px] font-sans px-2 py-0.5 rounded-full border shrink-0 font-medium ${categoryBadgeStyle}`}>
                          {category}
                        </span>
                        <span className={`font-sans text-[9px] px-2 py-0.5 rounded-full border shrink-0 font-medium ${complexityColor(complexity)}`}>
                          {complexity}
                        </span>
                      </div>

                      {/* Description Snippet */}
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-4 font-sans">
                        {item?.description ?? item?.idea ?? 'Full-stack application blueprint with complete database schema, REST API endpoints, and live preview.'}
                      </p>

                      {/* Architecture Specs 3-Chip Row */}
                      <div className="grid grid-cols-3 gap-2 mb-4 py-2 px-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <div className="flex items-center gap-1.5 min-w-0" title={`${endpointsCount} REST Endpoints`}>
                          <Code2 size={12} className="text-indigo-400 shrink-0" />
                          <span className="text-[10px] font-sans text-zinc-300 truncate">
                            <strong className="text-white font-semibold">{endpointsCount}</strong> API{endpointsCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0" title={`${schemaCount} Database Tables`}>
                          <Database size={12} className="text-emerald-400 shrink-0" />
                          <span className="text-[10px] font-sans text-zinc-300 truncate">
                            <strong className="text-white font-semibold">{schemaCount}</strong> DB{schemaCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0" title={`${screensCount} UI Screens`}>
                          <Layout size={12} className="text-purple-400 shrink-0" />
                          <span className="text-[10px] font-sans text-zinc-300 truncate">
                            <strong className="text-white font-semibold">{screensCount}</strong> View{screensCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Multi-Model Pipeline Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-4">
                        <span className="text-[8px] font-sans text-zinc-500 uppercase tracking-wider mr-0.5">PIPELINE:</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                          Gemini 3.5 Flash
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300">
                          Gemini Flash
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300">
                          Kimi K2.6 fallback
                        </span>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between font-sans text-[10px]">
                      <div className="flex items-center gap-1.5 text-zinc-500 font-mono">
                        <Clock size={11} className="text-zinc-600" />
                        <span>{timeAgo(item?.createdAt ?? '')}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewItem(item);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.10] text-zinc-400 hover:text-white transition-colors flex items-center gap-1 border border-white/[0.06] hover:border-white/20"
                          title="Quick Spec Preview"
                        >
                          <Eye size={11} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/blueprint/${item?.id}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white transition-all flex items-center gap-1 border border-indigo-500/30 font-semibold group-hover:border-indigo-400/50"
                        >
                          <span>Inspect</span>
                          <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </SpotlightCard>
                </StaggerGridItem>
              );
            })}
          </StaggerGridContainer>
        )}
        </>
      )}
      </div>

      {/* ── Slide-over Preview Drawer ─────────────────────────── */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            variants={modalBackdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-md"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              variants={modalPanel}
              initial="hidden"
              animate="show"
              exit="exit"
              className="w-full max-w-xl bg-[#0e0e12] border-l border-white/[0.07] h-full p-6 flex flex-col justify-between overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-sans text-neutral-500 uppercase tracking-widest">
                        ARCHITECTURE PREVIEW
                      </span>
                      <span className={`font-sans text-[10px] px-2 py-0.5 rounded-full border ${complexityColor(previewItem?.complexity)}`}>
                        {previewItem?.complexity ?? 'Medium'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold font-display text-white">{previewItem?.appName}</h2>
                    <p className="text-xs font-mono text-neutral-500 mt-1">{timeAgo(previewItem?.createdAt ?? '')}</p>
                  </div>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.10] text-neutral-500 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-[10px] font-sans text-indigo-400 uppercase tracking-widest mb-2">Spec Overview</h4>
                  <p className="text-xs text-neutral-300 leading-relaxed">{previewItem?.description ?? previewItem?.idea ?? ''}</p>
                </div>

                {/* Quick Spec */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white font-sans mb-1">
                      <Code2 size={12} className="text-indigo-400" />
                      Endpoints
                    </div>
                    <div className="text-2xl font-bold font-mono text-indigo-300">{previewItem?.endpointsCount ?? 8}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white font-sans mb-1">
                      <Database size={12} className="text-emerald-400" />
                      DB Schemas
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-300">{previewItem?.schemaCount ?? 4}</div>
                  </div>
                </div>

                {/* Model Router Telemetry */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/15 font-sans text-xs space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold text-[11px]">
                    <Shield size={12} className="text-emerald-400" />
                    Multi-Model Router Telemetry
                  </div>
                  <div className="text-[10px] text-neutral-500 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Planning: Gemini 3.5 Flash → Nemotron fallback
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      Code Diffing: Gemini 3.5 Flash → Kimi fallback
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Auto-Fix: Gemini 3.5 Flash → Kimi fallback
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="pt-6 border-t border-white/[0.07] flex items-center justify-between gap-3">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-sans text-neutral-400 hover:text-white transition-colors"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
