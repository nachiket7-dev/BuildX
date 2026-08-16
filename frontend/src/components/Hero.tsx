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
  { id: 'plan',   label: 'Nemotron 550B', role: 'PLANNING',        icon: Bot,       color: 'indigo' },
  { id: 'ingest', label: 'Gemini Flash',  role: 'INGESTION',       icon: Zap,       color: 'blue'   },
  { id: 'diff',   label: 'GLM-5.2',       role: 'DIFF_GENERATION', icon: GitBranch, color: 'purple' },
  { id: 'fix',    label: 'Kimi K2.6',     role: 'AUTO_FIX',        icon: Shield,    color: 'emerald'},
] as const;

const STREAM_LINES = [
  { stage: 'plan',   text: 'Decomposing spec: 4 tables, 12 endpoints, 5 screens…', color: 'text-indigo-300' },
  { stage: 'plan',   text: 'Schema: users → appointments → payments → notifications', color: 'text-neutral-300' },
  { stage: 'ingest', text: 'Generating API contract: POST /auth/login, GET /slots…', color: 'text-blue-300' },
  { stage: 'ingest', text: 'Drafting Stripe webhook handler with idempotency key…', color: 'text-neutral-300' },
  { stage: 'diff',   text: '--- backend/src/db/schema.sql', color: 'text-neutral-500' },
  { stage: 'diff',   text: '+++ backend/src/db/schema.sql', color: 'text-neutral-500' },
  { stage: 'diff',   text: '+ CREATE TABLE appointments (', color: 'text-emerald-400' },
  { stage: 'diff',   text: '+   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),', color: 'text-emerald-400' },
  { stage: 'fix',    text: 'Auditing TypeScript: 0 errors across 24 generated files', color: 'text-emerald-300' },
  { stage: 'fix',    text: 'Adding missing index on appointments.user_id ✓', color: 'text-emerald-300' },
];

function HeroPipelineWidget() {
  const [stageIndex, setStageIndex] = useState(0);
  const [doneStages, setDoneStages] = useState<number[]>([]);
  const [visibleLines, setVisibleLines] = useState<typeof STREAM_LINES>([]);
  const [lineIndex, setLineIndex] = useState(0);

  // Advance pipeline stage every 3s
  useEffect(() => {
    const t = setInterval(() => {
      setStageIndex(prev => {
        const next = (prev + 1) % HERO_PIPELINE_STAGES.length;
        if (next === 0) {
          setDoneStages([]);
          setVisibleLines([]);
          setLineIndex(0);
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
    indigo: { dot: 'border-indigo-500/70 bg-indigo-500/15', text: 'text-indigo-300', glow: 'rgba(99,102,241,0.35)' },
    blue:   { dot: 'border-blue-500/70 bg-blue-500/15',     text: 'text-blue-300',   glow: 'rgba(59,130,246,0.35)' },
    purple: { dot: 'border-purple-500/70 bg-purple-500/15', text: 'text-purple-300', glow: 'rgba(168,85,247,0.35)' },
    emerald:{ dot: 'border-emerald-500/70 bg-emerald-500/15',text:'text-emerald-300',glow: 'rgba(16,185,129,0.35)' },
  };

  return (
    <div className="space-y-5">
      {/* Stage nodes */}
      <div className="flex items-center gap-1">
        {HERO_PIPELINE_STAGES.map((stage, i) => {
          if (!stage) return null;
          const isDone   = doneStages.includes(i);
          const isActive = stageIndex === i;
          const stageColor = stage?.color ?? 'indigo';
          const c = colorMap[stageColor] ?? colorMap['indigo'];
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
                    ${isActive ? `${c.dot} animate-node-glow` : isDone ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'}`}
                >
                  {isDone
                    ? <Check size={14} className="text-emerald-400" />
                    : Icon ? <Icon size={14} className={isActive ? c.text : 'text-neutral-600'} /> : null
                  }
                </motion.div>
                <div className="text-center">
                  <div className={`text-[9px] font-mono font-semibold leading-tight ${
                    isActive ? c.text : isDone ? 'text-emerald-400' : 'text-neutral-600'
                  }`}>
                    {stage.label}
                  </div>
                  <div className="text-[8px] text-neutral-600 font-mono">{stage.role}</div>
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
      <div className="bg-[#050507] rounded-2xl border border-white/[0.07] p-3.5 min-h-[160px] font-mono text-[10.5px] overflow-hidden relative">
        <div className="flex items-center gap-2 mb-2.5 border-b border-white/[0.06] pb-2">
          <Activity size={11} className="text-emerald-400" />
          <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">SSE Stream</span>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {visibleLines.map((line, i) => {
              if (!line) return null;
              const textColor = line?.color ?? 'text-neutral-300';
              return (
                <motion.div
                  key={(line.text || '') + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`leading-relaxed ${textColor}`}
                >
                  <span className="text-neutral-600 mr-1.5 select-none">&gt;</span>
                  {line.text}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {visibleLines.length === 0 && (
            <div className="text-neutral-600 italic">
              Initializing {HERO_PIPELINE_STAGES[stageIndex]?.role ?? 'PLANNING'}…
            </div>
          )}
        </div>
        {/* Fading bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-[#050507] to-transparent pointer-events-none rounded-b-2xl" />
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { v: '24 files', l: 'Generated', c: 'text-indigo-400' },
          { v: '< 30 sec', l: 'Runtime',   c: 'text-emerald-400' },
          { v: '4 Models', l: 'Pipeline',  c: 'text-purple-400' },
        ].map(({ v, l, c }) => (
          <div key={l} className="text-center p-2 rounded-xl bg-white/[0.025] border border-white/[0.06] font-mono">
            <div className={`text-xs font-bold ${c}`}>{v}</div>
            <div className="text-[9px] text-neutral-600">{l}</div>
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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-surface border border-brand-border text-xs font-mono text-zinc-300"
            >
              <Sparkles size={13} className="text-brand-accent" />
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
              className="text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed font-sans"
            >
              Turn prompts into production-ready monorepos: PostgreSQL schemas, Express/Next.js API routes, React UI screens, Mermaid ERD diagrams, and Docker configs.
            </motion.p>

            {/* Live Stack Selector Pills */}
            <motion.div
              variants={itemVariants}
              className="p-3 rounded-2xl bg-brand-surface border border-brand-border space-y-3 max-w-xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span>Select Target Stack Specs</span>
                <span className="text-brand-green">Customized Monorepo</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {/* Framework Selector */}
                <div className="flex items-center gap-1 bg-brand-bg/80 p-1 rounded-xl border border-brand-borderSubtle">
                  <Server size={12} className="text-brand-glow ml-1.5" />
                  {(['next', 'express', 'fastify'] as const).map((fw) => (
                    <motion.button
                      key={fw}
                      type="button"
                      onClick={() => setFramework(fw)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        framework === fw ? 'bg-purple-500/20 text-brand-glow border border-purple-500/30' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {fw === 'next' ? 'Next.js' : fw === 'express' ? 'Express' : 'Fastify'}
                    </motion.button>
                  ))}
                </div>

                {/* DB Selector */}
                <div className="flex items-center gap-1 bg-brand-bg/80 p-1 rounded-xl border border-brand-borderSubtle">
                  <Database size={12} className="text-brand-green ml-1.5" />
                  {(['postgres', 'supabase', 'mongo'] as const).map((d) => (
                    <motion.button
                      key={d}
                      type="button"
                      onClick={() => setDb(d)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        db === d ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {d === 'postgres' ? 'Postgres' : d === 'supabase' ? 'Supabase' : 'MongoDB'}
                    </motion.button>
                  ))}
                </div>

                {/* Auth Selector */}
                <div className="flex items-center gap-1 bg-brand-bg/80 p-1 rounded-xl border border-brand-borderSubtle">
                  <ShieldCheck size={12} className="text-brand-cyan ml-1.5" />
                  {(['jwt', 'clerk', 'nextauth'] as const).map((a) => (
                    <motion.button
                      key={a}
                      type="button"
                      onClick={() => setAuth(a)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        auth === a ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-zinc-400 hover:text-white'
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
                spotlightColor={isFocused ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)'}
                className={`p-4 rounded-t-2xl border transition-all duration-300 ${
                  isFocused ? 'border-brand-accent/60 shadow-2xl shadow-purple-500/15 bg-brand-surface' : 'border-brand-border bg-brand-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                    <Terminal size={14} className="text-brand-accent" />
                    <span>Prompt Command Console</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-brand-glow border border-purple-500/25">
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
              <div className="relative flex items-center justify-between px-4 py-2.5 bg-brand-surface border border-brand-border border-t border-t-white/5 rounded-b-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                  <span className={charCount >= MIN_CHARS ? 'text-brand-green font-semibold' : 'text-zinc-500'}>
                    {charCount}/{MIN_CHARS}
                  </span>
                  <span className="opacity-60 hidden sm:inline">· <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px]">⌘</kbd><kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] ml-0.5">↵</kbd></span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Pipeline Status Indicator */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                    <span>Autonomous Multi-Model Pipeline</span>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.04 } : {}}
                    whileTap={canSubmit ? { scale: 0.96 } : {}}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-purple-500/25 border border-purple-400/30 font-mono"
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

            {/* Example Chips — staggered */}
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
                    className="px-3 py-1 rounded-full bg-brand-surface hover:bg-brand-surface2 border border-brand-border text-xs text-zinc-300 font-mono transition-colors shadow-sm"
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
            <SpotlightCard spotlightColor="rgba(168, 85, 247, 0.2)" className="p-5 rounded-3xl border border-brand-border bg-brand-surface shadow-2xl backdrop-blur-xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 border-b border-brand-borderSubtle pb-3.5">
                <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                  <Activity size={14} className="text-brand-green" />
                  <span className="font-semibold text-white">Multi-Model Pipeline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                  <span className="text-[10px] font-mono text-brand-green">SSE Streaming</span>
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
