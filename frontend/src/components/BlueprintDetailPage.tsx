import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Database,
  Code2,
  Monitor,
  Layers,
  ArrowLeft,
  Check,
  Cpu,
  GitCompare,
  Wrench,
  Brain,
  Github,
  Download,
  ChevronUp,
  ChevronDown,
  Loader2,
  Zap,
} from 'lucide-react';
import { PageHead } from './PageHead';
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
import { BlueprintLoadingSkeleton } from './BlueprintLoadingSkeleton';
import type { Blueprint, TabId } from '../lib/types';
import { refineByIdBlueprint, fetchBlueprint } from '../lib/api';

interface BlueprintDetailPageProps {
  blueprint?: Blueprint;
  blueprintId?: string;
}

export function BlueprintDetailPage({ blueprint: inputBp, blueprintId: inputId }: BlueprintDetailPageProps) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = inputId || routeId || '';

  const [blueprintData, setBlueprintData] = useState<Blueprint | null>(inputBp || null);
  const [isLoading, setIsLoading] = useState<boolean>(!inputBp && Boolean(id));
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('features');
  const [isExpanded, setIsExpanded] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    { role: 'assistant', content: 'Cortex Agent ready. How can I refine this architecture blueprint?' },
  ]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputBp) {
      setBlueprintData(inputBp);
      setIsLoading(false);
      return;
    }

    if (!id) {
      setFetchError('No blueprint ID provided.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    fetchBlueprint(id)
      .then((saved) => {
        setBlueprintData((saved as any).parsedBlueprint || saved);
      })
      .catch((err: any) => {
        console.error('[BlueprintDetailPage] Fetch error:', err);
        setFetchError(err.message || 'Failed to load blueprint details.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, inputBp]);

  // Auto-focus textarea when drawer opens
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [isExpanded]);

  const PRESET_CHIPS = [
    { label: '+ Add Payments', text: 'Add Stripe payment webhooks with idempotency keys and retry logic' },
    { label: '+ Add OAuth',    text: 'Add OAuth 2.0 authentication with Google and GitHub providers' },
    { label: '+ Add Analytics', text: 'Add analytics event tracking with Mixpanel and session replay' },
    { label: '+ Add Role Auth', text: 'Add role-based access control (RBAC) with admin and user roles' },
  ];

  const handleSendRefinement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refinePrompt.trim() || isRefining) return;

    const userMsg = refinePrompt.trim();
    setRefinePrompt('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsRefining(true);

    try {
      const refined = await refineByIdBlueprint(id, userMsg);
      setBlueprintData(refined);

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `✓ Blueprint refined: ${refined.appName} updated successfully.`,
        },
      ]);
      // Collapse drawer on success
      setTimeout(() => setIsExpanded(false), 800);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message ?? 'Refinement failed. Please try again.'}` },
      ]);
    } finally {
      setIsRefining(false);
    }
  };

  if (isLoading) {
    return <BlueprintLoadingSkeleton />;
  }

  if (fetchError || !blueprintData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#08080c] text-white p-6">
        <PageHead title="Blueprint Not Found — BuildX" description="The requested blueprint could not be found." />
        <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/80 border border-white/10 text-center space-y-4 shadow-2xl backdrop-blur-xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400 font-mono text-lg font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-white">Blueprint Not Found</h2>
          <p className="text-xs text-zinc-400 leading-relaxed font-mono">
            {fetchError || 'The architecture spec you requested does not exist or has been deleted.'}
          </p>
          <Link
            to="/blueprints"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sylven hover:bg-sylven-light text-obsidian-bg font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 font-mono"
          >
            <ArrowLeft size={14} />
            <span>Return to Blueprint Library</span>
          </Link>
        </div>
      </div>
    );
  }

  const bp = blueprintData;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-obsidian-bg text-white relative font-sans">
      <PageHead
        title={`${bp.appName} Architecture — BuildX`}
        description={bp.description}
      />

      {/* Top Ambient Radial Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-sylven/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-36 right-10 w-[500px] h-[300px] bg-emerald-500/10 blur-[160px] pointer-events-none rounded-full" />

      {/* Lower Split Container: Independent Panel Scrolling */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden relative z-10">
        {/* Left Sidebar Section Navigator */}
        <aside className="w-64 h-full border-r border-obsidian-border bg-obsidian-surface p-4 flex flex-col justify-between shrink-0 font-mono text-xs hidden md:flex">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-zinc-500 px-3 py-2 uppercase tracking-wider">
              Sections
            </div>
            {[
              { id: 'features', label: '01 Features' },
              { id: 'schema', label: '02 Data Schema' },
              { id: 'api', label: '03 API Endpoints' },
              { id: 'ui', label: '04 UI Screens' },
              { id: 'architecture', label: '05 Architecture' },
              { id: 'effort', label: '06 Effort Matrix' },
              { id: 'diagrams', label: '07 Diagrams' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id as TabId)}
                className={`w-full text-left px-3 py-2 rounded-xl transition-all ${
                  activeTab === s.id
                    ? 'bg-sylven/20 text-sylven-light border border-sylven/40 font-semibold shadow-sm shadow-emerald-500/10'
                    : 'text-norvin-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar p-6 relative space-y-6 bg-obsidian-bg">

        <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 font-mono text-xs relative overflow-hidden shadow-2xl space-y-4">
          <div className="absolute right-6 top-6 text-[10px] text-zinc-500 select-none font-bold">
            COMMIT: {id.substring(0, 7)}
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-sylven/20 border border-sylven/30 flex items-center justify-center shrink-0 text-sylven-light font-bold text-[11px]">
              λ
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-sylven-light leading-snug">
                feat({bp.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}): initialize project architecture specification
              </h1>
              <div className="text-norvin-muted text-[11px] mt-1 font-mono">
                committed by <span className="text-white font-semibold">BuildX Agentic Pipeline</span> via <span className="text-sylven-light font-semibold">Cortex Architecture Engine</span>
              </div>
            </div>
          </div>

          <p className="text-zinc-300 leading-relaxed font-sans text-xs pt-2 border-t border-obsidian-borderSubtle">
            {bp.description}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px]">
            <span className="flex items-center gap-1.5 bg-brand-bg border border-brand-border px-3 py-1 rounded-lg text-brand-green font-mono font-bold">
              + {bp.schema?.length ?? 0} Tables
            </span>
            <span className="flex items-center gap-1.5 bg-brand-bg border border-brand-border px-3 py-1 rounded-lg text-brand-cyan font-mono font-bold">
              + {bp.endpoints?.length ?? 0} Endpoints
            </span>
            <span className="flex items-center gap-1.5 bg-brand-bg border border-brand-border px-3 py-1 rounded-lg text-brand-glow font-mono font-bold">
              + {bp.screens?.length ?? 0} Screens
            </span>
            <span className="flex items-center gap-1.5 bg-brand-bg border border-brand-border px-3 py-1 rounded-lg text-brand-amber font-mono font-bold">
              # {bp.complexity} Complexity
            </span>
            <span className="flex items-center gap-1.5 bg-brand-bg border border-brand-border px-3 py-1 rounded-lg ml-auto text-zinc-300 font-mono text-[11px]">
              Target Audience: <span className="text-white font-semibold">{bp.targetUsers}</span>
            </span>
          </div>
        </div>

        <div className="w-full bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 md:p-8 flex flex-col justify-between gap-5 relative overflow-hidden backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sylven/10 border border-sylven/20 inline-flex items-center justify-center shrink-0 text-sylven-light">
                <Github size={16} />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight font-mono">
                GitHub Sync &amp; ZIP Export
              </h3>
            </div>
            <p className="text-xs text-norvin-muted leading-relaxed max-w-xl mt-2.5 font-sans">
              Push production monorepos directly to GitHub or export a self-contained ZIP archive ready for immediate deployment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 my-3 font-mono">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sylven-glow border border-sylven/20 text-sylven-light text-[11px]">
              <Check size={11} /> OAuth 2.0
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sylven/10 border border-sylven/20 text-sylven-light text-[11px]">
              20+ files
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px]">
              JWT secured
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-obsidian-borderSubtle mt-1 font-mono">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors shadow-lg shadow-white/5"
            >
              <Github size={14} />
              <span>Push to GitHub</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-obsidian-panel hover:bg-obsidian-surface border border-obsidian-border text-white font-medium text-xs transition-colors"
            >
              <Download size={14} />
              <span>Download ZIP</span>
            </motion.button>
          </div>
        </div>

        <div className="flex items-start mb-6 overflow-x-auto custom-scrollbar">
          <TabBar activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-obsidian-borderSubtle font-mono text-xs">
            <span className="text-sylven-light font-semibold">01 / FEATURE BREAKDOWN</span>
            <span className="text-zinc-500 uppercase">{activeTab} VIEW</span>
          </div>

          {activeTab === 'features' && <FeaturesPanel blueprint={bp} />}
          {activeTab === 'schema' && <SchemaPanel blueprint={bp} />}
          {activeTab === 'api' && <ApiPanel blueprint={bp} />}
          {activeTab === 'ui' && <UiPanel blueprint={bp} />}
          {activeTab === 'architecture' && <ArchPanel blueprint={bp} />}
          {activeTab === 'effort' && <EffortPanel blueprint={bp} />}
          {activeTab === 'diagrams' && <DiagramsPanel blueprint={bp} />}
        </div>

        <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-obsidian-borderSubtle font-mono text-xs">
            <span className="text-sylven-light font-semibold">02 / CORTEX TIMELINE FEED</span>
            <span className="text-zinc-500">{messages.length} TURNS</span>
          </div>

          <div className="space-y-4 font-mono text-xs border-l border-obsidian-border ml-3 pl-4">
            {messages.map((m, idx) => (
              <div key={idx} className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-semibold">
                  {m.role === 'user' ? '01 / USER REQUEST' : '02 / CORTEX STREAM'}
                </span>
                <div className={`p-3 rounded-xl border leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-sylven/20 border-sylven/40 text-white'
                    : 'bg-obsidian-panel border-obsidian-border text-zinc-300'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clear Spacer to Prevent Bottom Bar Collisions */}
        <div className="h-28 w-full pointer-events-none" />
      </main>

      {/* Close the overflow-hidden split container BEFORE the dock */}
      </div>

      {/* Collapsible Cortex Refinement Bottom Dock — outside overflow-hidden so sticky and animations work */}
      <div className="shrink-0 z-30 bg-obsidian-bg/95 backdrop-blur-xl border-t border-obsidian-border shadow-2xl">
        <div className="max-w-5xl mx-auto p-3 sm:p-4">
          {/* Collapsible Header Rail */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="cursor-pointer flex items-center justify-between p-3.5 bg-obsidian-surface border border-obsidian-border rounded-2xl hover:border-sylven/50 transition-all group select-none"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sylven/10 border border-sylven/20 flex items-center justify-center text-sylven-light shrink-0 group-hover:scale-105 transition-transform">
                <Cpu size={16} />
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                  00 / CORTEX REFINEMENT DOCK
                </span>
                <h4 className="text-xs font-bold text-white tracking-tight truncate flex items-center gap-2">
                  <span>Cortex Agent Refinement</span>
                  <span className="text-[10px] font-mono text-sylven-light bg-sylven/10 border border-sylven/20 px-2 py-0.5 rounded-full font-normal">
                    {messages.length} messages
                  </span>
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono text-sylven-light bg-sylven-glow border border-sylven/20">
                <span className="w-1.5 h-1.5 rounded-full bg-sylven animate-pulse" />
                <span>{isRefining ? 'Thinking…' : 'Cortex (Nemotron 550B)'}</span>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg bg-obsidian-panel group-hover:bg-obsidian-surface text-norvin-muted group-hover:text-white transition-colors"
                aria-label={isExpanded ? 'Collapse refinement dock' : 'Expand refinement dock'}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>
          </div>

          {/* Collapsible Drawer Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                className="overflow-hidden pt-3 space-y-3 font-mono"
              >
                {/* Conversation Stream Log */}
                <div className="max-h-60 overflow-y-auto p-3 space-y-2.5 bg-obsidian-bg border border-obsidian-border rounded-2xl custom-scrollbar font-mono text-xs">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl max-w-[90%] leading-relaxed ${
                        msg.role === 'user'
                          ? 'ml-auto bg-sylven/20 border border-sylven/40 text-white self-end'
                          : 'bg-obsidian-panel border border-obsidian-border text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1 font-mono uppercase">
                        {msg.role === 'user' ? 'You' : 'Cortex AI Agent'}
                      </div>
                      <p className="font-sans text-xs">{msg.content}</p>
                    </div>
                  ))}
                  {isRefining && (
                    <div className="flex items-center gap-2 p-3 bg-obsidian-panel border border-obsidian-border rounded-xl text-xs text-sylven-light animate-pulse font-mono">
                      <Loader2 size={14} className="animate-spin text-sylven-light" />
                      <span>Refining architecture specifications &amp; generating DDL diffs...</span>
                    </div>
                  )}
                </div>

                {/* Console: Preset Chips + Textarea + Submit */}
                <form onSubmit={handleSendRefinement} className="space-y-3">

                  {/* Preset Chips */}
                  <div className="flex flex-wrap gap-2">
                    {PRESET_CHIPS.map(chip => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setRefinePrompt(prev => prev ? `${prev}, ${chip.text}` : chip.text)}
                        className="px-3 py-1 rounded-full text-[10px] font-mono font-medium bg-obsidian-panel hover:bg-obsidian-surface border border-obsidian-border hover:border-sylven/40 text-norvin-muted hover:text-sylven-light transition-all"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    rows={3}
                    value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                    disabled={isRefining}
                    placeholder="Describe changes (e.g., 'Add Stripe webhooks' or 'Add role-based auth')..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendRefinement(e as any);
                    }}
                    className="w-full resize-none bg-obsidian-bg border border-obsidian-border focus:border-sylven focus:ring-1 focus:ring-sylven/30 text-xs text-white placeholder-zinc-500 rounded-xl px-4 py-3 font-mono outline-none transition-all leading-relaxed"
                  />

                  <div className="flex items-center justify-between gap-3 font-mono">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {refinePrompt.length}/500 chars · ⌘+Enter to send
                    </span>
                    <motion.button
                      whileHover={{ scale: isRefining ? 1 : 1.02 }}
                      whileTap={{ scale: isRefining ? 1 : 0.97 }}
                      type="submit"
                      disabled={!refinePrompt.trim() || isRefining}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 border border-emerald-400/30 shrink-0 font-mono"
                    >
                      {isRefining ? (
                        <><Loader2 size={13} className="animate-spin" /><span>Refining…</span></>
                      ) : (
                        <><Zap size={13} /><span>Refine Blueprint</span></>
                      )}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default BlueprintDetailPage;
