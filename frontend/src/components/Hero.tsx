import React, { useState, useRef, useEffect } from 'react';
import { EXAMPLE_IDEAS } from '../lib/utils';
import { SpotlightCard } from './SpotlightCard';
import { Sparkles, ArrowRight, Code2, Database, ShieldCheck, Terminal, Server, Check, Zap, Bot, GitBranch, Shield, Activity } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { TextReveal } from './animations/TextReveal';
import { slideFromRight } from '../lib/motion';

interface HeroProps {
  onGenerate: (idea: string) => void;
  isLoading: boolean;
}

// Reusable stagger container/item variants
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const rightColVariants = slideFromRight;

const tabContentVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
};

// ─── Simulated Multi-Model Pipeline Widget ───────────────────────────────────

const HERO_PIPELINE_STAGES = [
  { id: 'plan',   label: 'Nemotron 550B', role: 'PLANNING',        icon: Bot,       color: 'emerald' },
  { id: 'ingest', label: 'Gemini Flash',  role: 'INGESTION',       icon: Zap,       color: 'cyan'   },
  { id: 'diff',   label: 'GLM-5.2',       role: 'DIFF_GENERATION', icon: GitBranch, color: 'silver' },
  { id: 'fix',    label: 'Kimi K2.6',     role: 'AUTO_FIX',        icon: Shield,    color: 'emerald'},
] as const;

const STREAM_LINES = [
  { stage: 'plan',   text: 'Decomposing spec: 4 tables, 12 endpoints, 5 screens…', color: 'text-sylven-light' },
  { stage: 'plan',   text: 'Schema: users → appointments → payments → notifications', color: 'text-norvin-muted' },
  { stage: 'ingest', text: 'Generating API contract: POST /auth/login, GET /slots…', color: 'text-cyan-300' },
  { stage: 'ingest', text: 'Drafting Stripe webhook handler with idempotency key…', color: 'text-norvin-muted' },
  { stage: 'diff',   text: '--- backend/src/db/schema.sql', color: 'text-zinc-500' },
  { stage: 'diff',   text: '+++ backend/src/db/schema.sql', color: 'text-zinc-500' },
  { stage: 'diff',   text: '+ CREATE TABLE appointments (', color: 'text-sylven-light' },
  { stage: 'diff',   text: '+   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),', color: 'text-sylven-light' },
  { stage: 'fix',    text: 'Auditing TypeScript: 0 errors across 24 generated files', color: 'text-sylven-light' },
  { stage: 'fix',    text: 'Adding missing index on appointments.user_id ✓', color: 'text-sylven-light' },
];

function HeroPipelineWidget() {
  const [stageIndex, setStageIndex] = useState(0);
  const [doneStages, setDoneStages] = useState<number[]>([]);
  const [visibleLines, setVisibleLines] = useState<typeof STREAM_LINES>([]);

  // Advance pipeline stage every 3s
  useEffect(() => {
    const t = setInterval(() => {
      setStageIndex(prev => {
        const next = (prev + 1) % HERO_PIPELINE_STAGES.length;
        if (next === 0) {
          setDoneStages([]);
          setVisibleLines([]);
        } else {
          setDoneStages(d => [...d, prev]);
        }
        return next;
      });
    }, 3200);
    return () => clearInterval(t);
  }, []);

  // Stream log lines for current stage
  useEffect(() => {
    const currentStageObj = HERO_PIPELINE_STAGES[stageIndex];
    if (!currentStageObj) return;
    const stageId = currentStageObj.id;
    const stageLines = STREAM_LINES.filter(l => l && l.stage === stageId);
    let i = 0;
    const t = setInterval(() => {
      if (i >= stageLines.length) { clearInterval(t); return; }
      const lineObj = stageLines[i];
      if (lineObj) {
        setVisibleLines(prev => [...prev.slice(-12), lineObj]);
      }
      i++;
    }, 420);
    return () => clearInterval(t);
  }, [stageIndex]);

  const colorMap: Record<string, { dot: string; text: string; glow: string }> = {
    emerald: { dot: 'border-emerald-500/70 bg-emerald-500/15', text: 'text-sylven-light', glow: 'rgba(16,185,129,0.35)' },
    cyan:    { dot: 'border-cyan-500/70 bg-cyan-500/15',       text: 'text-cyan-300',     glow: 'rgba(56,189,248,0.35)' },
    silver:  { dot: 'border-slate-400/70 bg-slate-400/15',     text: 'text-norvin-silver', glow: 'rgba(226,232,240,0.35)' },
  };

  return (
    <div className="space-y-5">
      {/* Stage nodes */}
      <div className="flex items-center gap-1">
        {HERO_PIPELINE_STAGES.map((stage, i) => {
          if (!stage) return null;
          const isDone   = doneStages.includes(i);
          const isActive = stageIndex === i;
          const stageColor = stage?.color ?? 'emerald';
          const c = colorMap[stageColor] ?? colorMap['emerald'];
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.id || i}>
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <motion.div
                  animate={isActive
                    ? { scale: 1.15, opacity: 1 }
                    : isDone
                    ? { scale: 1, opacity: 0.75 }
                    : { scale: 0.92, opacity: 0.35 }
                  }
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all
                    ${isActive ? `${c.dot} shadow-[0_0_16px_${c.glow}] ring-1 ring-white/20` : isDone ? 'border-sylven/50 bg-sylven-glow' : 'border-obsidian-border bg-obsidian-panel'}`}
                >
                  {isDone
                    ? <Check size={14} className="text-sylven-light" />
                    : Icon ? <Icon size={14} className={isActive ? c.text : 'text-zinc-600'} /> : null
                  }
                </motion.div>
                <div className="text-center">
                  <div className={`text-[9px] font-mono font-semibold leading-tight ${
                    isActive ? c.text : isDone ? 'text-sylven-light' : 'text-zinc-500'
                  }`}>
                    {stage.label}
                  </div>
                  <div className="text-[8px] text-zinc-500 font-mono">{stage.role}</div>
                </div>
              </div>
              {i < HERO_PIPELINE_STAGES.length - 1 && (
                <div className="pipeline-connector flex-1 -mt-5">
                  <motion.div
                    className="pipeline-connector__fill h-full"
                    animate={{ scaleX: isDone ? 1 : 0 }}
                    initial={{ scaleX: 0 }}
                    transition={{ duration: 0.55, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Live log stream */}
      <div className="bg-obsidian-bg rounded-2xl border border-obsidian-border p-3.5 min-h-[160px] font-mono text-[10.5px] overflow-hidden relative shadow-inner">
        <div className="flex items-center gap-2 mb-2.5 border-b border-obsidian-borderSubtle pb-2">
          <Activity size={11} className="text-sylven-light" />
          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">SSE Stream</span>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sylven animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {visibleLines.map((line, i) => {
              if (!line) return null;
              const textColor = line?.color ?? 'text-zinc-300';
              return (
                <motion.div
                  key={(line.text || '') + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`leading-relaxed ${textColor}`}
                >
                  <span className="text-zinc-600 mr-1.5 select-none">&gt;</span>
                  {line.text}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {visibleLines.length === 0 && (
            <div className="text-zinc-600 italic">
              Initializing {HERO_PIPELINE_STAGES[stageIndex]?.role ?? 'PLANNING'}…
            </div>
          )}
        </div>
        {/* Fading bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-obsidian-bg to-transparent pointer-events-none rounded-b-2xl" />
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
        {[
          { v: '24 files', l: 'Generated', c: 'text-sylven-light' },
          { v: '< 30 sec', l: 'Runtime',   c: 'text-norvin-silver' },
          { v: '4 Models', l: 'Pipeline',  c: 'text-cyan-300' },
        ].map(({ v, l, c }) => (
          <div key={l} className="text-center p-2 rounded-xl bg-obsidian-surface border border-obsidian-border">
            <div className={`text-xs font-bold ${c}`}>{v}</div>
            <div className="text-[9px] text-zinc-500">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


export function Hero({ onGenerate, isLoading }: HeroProps) {
  const [idea, setIdea] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Live Stack Customizer Controls
  const [framework, setFramework] = useState<'next' | 'express' | 'fastify'>('next');
  const [db, setDb] = useState<'postgres' | 'supabase' | 'mongo'>('postgres');
  const [auth, setAuth] = useState<'jwt' | 'clerk' | 'nextauth'>('clerk');

  // Preview Widget Tab State inside Hero Right Column
  const [previewTab, setPreviewTab] = useState<'schema' | 'api' | 'ui'>('schema');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = idea.trim();
    if (trimmed.length < 10 || isLoading) return;
    onGenerate(trimmed);
  }

  function fillExample(text: string) {
    setIdea(text);
    textareaRef.current?.focus();
  }

  const MIN_CHARS = 10;
  const charCount = idea.trim().length;
  const canSubmit = charCount >= MIN_CHARS && !isLoading;

  return (
    /* ─── Hero Section: Asymmetrical 2-Column Split Stage ─── */
    <section className="relative w-full px-4 sm:px-6 pt-8 sm:pt-14 pb-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column (7 cols): Builder Control Console — staggered reveal */}
          <motion.div
            className="lg:col-span-7 space-y-6 text-left"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Eyebrow Badge */}
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-obsidian-surface border border-obsidian-border text-xs font-mono text-norvin-silver shadow-sm"
            >
              <Sparkles size={13} className="text-sylven" />
              <span>Next-Gen Full-Stack AI Architect</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white font-display leading-[1.1]"
            >
              <TextReveal text="Architect your next big idea with AI." />
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-sm sm:text-base text-norvin-muted max-w-xl leading-relaxed font-sans"
            >
              Turn prompts into production-ready monorepos: PostgreSQL schemas, Express/Next.js API routes, React UI screens, Mermaid ERD diagrams, and Docker configs.
            </motion.p>

            {/* Live Stack Selector Pills */}
            <motion.div
              variants={itemVariants}
              className="p-3 rounded-2xl bg-obsidian-surface border border-obsidian-border space-y-3 max-w-xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between text-xs text-norvin-muted font-mono">
                <span>Select Target Stack Specs</span>
                <span className="text-sylven-light font-semibold">Customized Monorepo</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {/* Framework Selector */}
                <div className="flex items-center gap-1 bg-obsidian-bg p-1 rounded-xl border border-obsidian-borderSubtle">
                  <Server size={12} className="text-sylven-light ml-1.5" />
                  {(['next', 'express', 'fastify'] as const).map((fw) => (
                    <motion.button
                      key={fw}
                      type="button"
                      onClick={() => setFramework(fw)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        framework === fw ? 'bg-sylven/20 text-sylven-light border border-sylven/40 font-semibold' : 'text-norvin-muted hover:text-white'
                      }`}
                    >
                      {fw === 'next' ? 'Next.js' : fw === 'express' ? 'Express' : 'Fastify'}
                    </motion.button>
                  ))}
                </div>

                {/* DB Selector */}
                <div className="flex items-center gap-1 bg-obsidian-bg p-1 rounded-xl border border-obsidian-borderSubtle">
                  <Database size={12} className="text-sylven-light ml-1.5" />
                  {(['postgres', 'supabase', 'mongo'] as const).map((d) => (
                    <motion.button
                      key={d}
                      type="button"
                      onClick={() => setDb(d)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        db === d ? 'bg-sylven/20 text-sylven-light border border-sylven/40 font-semibold' : 'text-norvin-muted hover:text-white'
                      }`}
                    >
                      {d === 'postgres' ? 'Postgres' : d === 'supabase' ? 'Supabase' : 'MongoDB'}
                    </motion.button>
                  ))}
                </div>

                {/* Auth Selector */}
                <div className="flex items-center gap-1 bg-obsidian-bg p-1 rounded-xl border border-obsidian-borderSubtle">
                  <ShieldCheck size={12} className="text-cyan-400 ml-1.5" />
                  {(['jwt', 'clerk', 'nextauth'] as const).map((a) => (
                    <motion.button
                      key={a}
                      type="button"
                      onClick={() => setAuth(a)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        auth === a ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-norvin-muted hover:text-white'
                      }`}
                    >
                      {a === 'jwt' ? 'JWT' : a === 'clerk' ? 'Clerk' : 'NextAuth'}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Prompt Command Console Form */}
            <motion.form
              variants={itemVariants}
              onSubmit={handleSubmit}
              className="max-w-xl space-y-0"
            >
              <SpotlightCard
                spotlightColor={isFocused ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)'}
                className={`p-4 rounded-t-2xl border transition-all duration-300 ${
                  isFocused ? 'border-sylven/60 shadow-2xl shadow-emerald-500/10 bg-obsidian-surface' : 'border-obsidian-border bg-obsidian-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-norvin-muted font-mono">
                    <Terminal size={14} className="text-sylven" />
                    <span>Prompt Command Console</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sylven/15 text-sylven-light border border-sylven/25">
                    VFS MONOREPO
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="e.g. Build a SaaS telehealth app with doctor availability slots, video room creation, patient appointments, and Stripe payment webhooks..."
                  rows={3}
                  disabled={isLoading}
                  className="w-full bg-transparent border-none outline-none resize-none text-sm sm:text-base leading-relaxed text-white placeholder-zinc-500 font-sans"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
                  }}
                />
              </SpotlightCard>

              {/* Bottom action bar */}
              <div className="relative flex items-center justify-between px-4 py-2.5 bg-obsidian-surface border border-obsidian-border border-t border-t-white/5 rounded-b-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs text-norvin-muted font-mono">
                  <span className={charCount >= MIN_CHARS ? 'text-sylven-light font-semibold' : 'text-zinc-500'}>
                    {charCount}/{MIN_CHARS}
                  </span>
                  <span className="opacity-60 hidden sm:inline">· <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px]">⌘</kbd><kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] ml-0.5">↵</kbd></span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Pipeline Status Indicator */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-norvin-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-sylven animate-pulse" />
                    <span>Autonomous Multi-Model Pipeline</span>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.04 } : {}}
                    whileTap={canSubmit ? { scale: 0.96 } : {}}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-emerald-500/20 border border-emerald-400/30 font-mono"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Architecting…</span>
                      </>
                    ) : (
                      <>
                        <span>Generate</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.form>

            {/* Example Chips */}
            <motion.div variants={itemVariants} className="space-y-2 max-w-xl">
              <div className="text-xs text-zinc-500 font-mono">Preset App Blueprint Templates:</div>
              <motion.div
                className="flex flex-wrap gap-2"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {EXAMPLE_IDEAS.map(({ label, idea: exampleIdea }) => (
                  <motion.button
                    key={label}
                    type="button"
                    onClick={() => fillExample(exampleIdea)}
                    disabled={isLoading}
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className="px-3 py-1 rounded-full bg-obsidian-surface hover:bg-obsidian-panel border border-obsidian-border text-xs text-norvin-silver font-mono transition-colors shadow-sm"
                  >
                    {label}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Right Column (5 cols): Interactive Monorepo Inspector Card */}
          <motion.div
            className="lg:col-span-5 w-full"
            variants={rightColVariants}
            initial="hidden"
            animate="show"
          >
            <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.18)" className="p-5 rounded-3xl border border-obsidian-border bg-obsidian-surface shadow-2xl backdrop-blur-xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 border-b border-obsidian-borderSubtle pb-3.5">
                <div className="flex items-center gap-2 font-mono text-xs text-norvin-silver">
                  <Activity size={14} className="text-sylven" />
                  <span className="font-semibold text-white">Multi-Model Pipeline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sylven animate-pulse" />
                  <span className="text-[10px] font-mono text-sylven-light">SSE Streaming</span>
                </div>
              </div>

              {/* Live Pipeline Widget */}
              <HeroPipelineWidget />
            </SpotlightCard>
          </motion.div>

        </div>
      </section>
  );
}
