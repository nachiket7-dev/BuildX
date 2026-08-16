import React, { useEffect, useRef, useState } from 'react';
import type { PartialBlueprint, PipelineStage, PipelineStageEvent } from '../lib/types';
import type { AgentEvent } from '../hooks/useStreamBlueprint';
import { FileText, Database, Webhook, Palette, Code, ShieldCheck, ChevronDown, ChevronUp, Cpu, Wrench, Brain, Zap, GitCompare } from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { StreamingSections } from './StreamingSections';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamingViewProps {
  progress: number;
  partialBlueprint: PartialBlueprint;
  agentEvents?: AgentEvent[];
  activeStage?: PipelineStage | null;
  pipelineEvents?: PipelineStageEvent[];
}

const AGENTS_LIST = [
  { key: 'pm' as const, label: 'Product Manager', icon: FileText, color: 'text-sylven-light', desc: 'Specs & Features', stage: 'PLANNING' as PipelineStage },
  { key: 'architect' as const, label: 'Database Architect', icon: Database, color: 'text-sylven-light', desc: 'SQL Relations', stage: 'PLANNING' as PipelineStage },
  { key: 'api_dev' as const, label: 'API Developer', icon: Webhook, color: 'text-sky-400', desc: 'REST Endpoints', stage: 'INGESTION' as PipelineStage },
  { key: 'designer' as const, label: 'UI/UX Designer', icon: Palette, color: 'text-sky-400', desc: 'Screen Layouts', stage: 'INGESTION' as PipelineStage },
  { key: 'coder' as const, label: 'Developer', icon: Code, color: 'text-emerald-400', desc: 'Workspace Code', stage: 'DIFF_GENERATION' as PipelineStage },
  { key: 'qa' as const, label: 'QA Evaluator', icon: ShieldCheck, color: 'text-amber-400', desc: 'Integrity Check', stage: 'AUTO_FIX' as PipelineStage },
] as const;

const PIPELINE_STAGE_BADGES: Record<
  PipelineStage,
  { label: string; Icon: React.ElementType; models: string; color: string; border: string; bg: string; glow: string }
> = {
  PLANNING: {
    label: 'PLANNING',
    Icon: Brain,
    models: 'Nemotron 3 Ultra / GLM-5.2',
    color: 'text-sylven-light',
    border: 'border-sylven/40',
    bg: 'bg-sylven/10',
    glow: 'shadow-sylven/20',
  },
  INGESTION: {
    label: 'INGESTION',
    Icon: Zap,
    models: 'Gemini 3.5 Flash / GLM-5.2',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
    glow: 'shadow-sky-500/20',
  },
  DIFF_GENERATION: {
    label: 'DIFF GENERATION',
    Icon: GitCompare,
    models: 'Z-AI GLM-5.2 / Gemini 3.5 Flash',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/20',
  },
  AUTO_FIX: {
    label: 'AUTO-FIX & QA',
    Icon: Wrench,
    models: 'Moonshot Kimi K2.6 / GLM-5.2',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/20',
  },
};

// Stage ordering for isDone logic
const STAGE_ORDER: PipelineStage[] = ['PLANNING', 'INGESTION', 'DIFF_GENERATION', 'AUTO_FIX'];

export function StreamingView({
  progress,
  partialBlueprint,
  agentEvents = [],
  activeStage = 'PLANNING',
  pipelineEvents = [],
}: StreamingViewProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [showReasoning, setShowReasoning] = useState(true);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentEvents, pipelineEvents]);

  const getAgentStatus = (agentKey: string) => {
    const events = agentEvents.filter((e) => e.agent === agentKey);
    if (events.length === 0) return 'idle';
    return events[events.length - 1].status;
  };

  const isAutoFixActive = activeStage === 'AUTO_FIX' || agentEvents.some(e => e.status === 'correcting');

  const activeStageIndex = STAGE_ORDER.indexOf(activeStage ?? 'PLANNING');

  return (
    <section
      className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 py-10 max-w-5xl mx-auto w-full"
      aria-live="polite"
      aria-busy="true"
      aria-label="Generating blueprint"
    >
      {/* Header & Main Stage Status Badges */}
      <motion.div
        className="text-center mb-6 max-w-2xl w-full"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border font-mono text-xs mb-4 border-sylven/30 bg-sylven-glow text-sylven-light">
          <span className="w-2 h-2 rounded-full animate-pulse bg-sylven" />
          Strict Dedicated Multi-Model Pipeline
        </div>

        <h2 className="font-display font-extrabold text-2xl sm:text-3xl bg-gradient-to-r from-emerald-300 via-teal-200 to-white bg-clip-text text-transparent mb-3">
          {partialBlueprint.appName
            ? `Architecting ${partialBlueprint.appName}`
            : 'Compiling Workspace Specifications…'}
        </h2>

        {/* 4 Pipeline Stages Badges — layoutId morphing transitions */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3 mb-2">
          {(Object.keys(PIPELINE_STAGE_BADGES) as PipelineStage[]).map((stageKey, stageIdx) => {
            const badge = PIPELINE_STAGE_BADGES[stageKey];
            const isActive = activeStage === stageKey;
            const isDone = progress === 100 || stageIdx < activeStageIndex;

            return (
              <motion.div
                key={stageKey}
                layoutId={`pipeline-badge-${stageKey}`}
                layout
                animate={
                  isActive
                    ? { scale: 1.08, opacity: 1 }
                    : isDone
                    ? { scale: 1, opacity: 0.8 }
                    : { scale: 1, opacity: 0.45 }
                }
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
                  isActive
                    ? `${badge.bg} ${badge.border} ${badge.color} ring-1 ring-white/10 shadow-lg ${badge.glow}`
                    : isDone
                    ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'
                    : 'bg-neutral-900/40 border-neutral-800 text-neutral-500'
                }`}
              >
                <badge.Icon size={10} />
                <span className="font-bold">{badge.label}</span>
                <span className="text-[9px] opacity-75 hidden sm:inline">({badge.models})</span>
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      key="ping"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="w-1.5 h-1.5 rounded-full bg-current animate-ping ml-0.5"
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Automated Testing & Self-Correction Banner — animated entrance */}
      <AnimatePresence>
        {isAutoFixActive && (
          <motion.div
            key="autofix-banner"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full max-w-4xl mb-6 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between text-amber-300 text-xs font-mono shadow-lg shadow-amber-500/5 overflow-hidden"
          >
            <div className="flex items-center gap-2.5">
              <Wrench className="w-4 h-4 text-amber-400 animate-spin" />
              <div>
                <span className="font-bold text-amber-200">Automated Self-Correction Active:</span>
                <span className="ml-1.5 text-amber-300/90">Moonshot Kimi K2.6 auditing VFS constraints & index optimizations (Fallback: GLM-5.2)</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-400/20 text-[10px] uppercase font-bold border border-amber-400/30 shrink-0">
              AUTO_FIX MODE
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar — spring-animated width */}
      <div className="w-full max-w-3xl mb-6">
        <div className="flex justify-between items-end mb-2 font-mono-custom text-xs" style={{ color: 'var(--text3)' }}>
          <span>Multi-Model Pipeline progress</span>
          <motion.span
            key={progress}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: 'var(--text)' }}
          >
            {progress}%
          </motion.span>
        </div>
        <div
          className="w-full h-2.5 rounded-full overflow-hidden"
          style={{ background: 'var(--surface3)', border: '1px solid var(--border)' }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="h-full rounded-full progress-bar-glow"
            style={{ background: 'linear-gradient(90deg, #10b981, #34d399)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 18 }}
          />
        </div>
      </div>

      <StreamingSections partial={partialBlueprint} />

      {/* Agents Grid — staggered entrance */}
      <motion.div
        className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-6 gap-3 mb-6"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      >
        {AGENTS_LIST.map((agent) => {
          const status = getAgentStatus(agent.key);
          const isActive = status === 'thinking' || status === 'writing' || status === 'correcting';
          const isCompleted = status === 'completed';
          const Icon = agent.icon;

          return (
            <motion.div
              key={agent.key}
              variants={{
                hidden: { opacity: 0, scale: 0.88, y: 10 },
                show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
              }}
              animate={isActive ? { scale: [1, 1.03, 1] } : {}}
              transition={isActive ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } : {}}
            >
              <SpotlightCard
                spotlightColor={
                  isCompleted
                    ? 'rgba(16, 185, 129, 0.08)'
                    : isActive
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(255, 255, 255, 0.03)'
                }
                className="p-4 rounded-xl text-center relative overflow-hidden transition-all duration-300"
                style={{
                  borderColor: isCompleted
                    ? 'rgba(16, 185, 129, 0.25)'
                    : isActive
                      ? 'rgba(16, 185, 129, 0.4)'
                      : 'var(--border)',
                  background: isCompleted
                    ? 'var(--green-dim)'
                    : isActive
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'var(--surface)',
                }}
              >
                {isActive && (
                  <span className="absolute top-2 right-2 flex h-2 w-2" aria-hidden>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-sylven-light" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sylven" />
                  </span>
                )}
                {isCompleted && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="absolute top-2 right-2 text-[10px]"
                    style={{ color: 'var(--green)' }}
                    aria-hidden
                  >
                    ✓
                  </motion.span>
                )}

                <div className={`flex justify-center mb-2 transition-all ${!isActive && !isCompleted ? 'opacity-40 grayscale' : ''}`}>
                  <Icon size={24} className={agent.color} />
                </div>
                <div className="font-display font-semibold text-xs mb-0.5 truncate" style={{ color: 'var(--text)' }}>
                  {agent.label}
                </div>
                <div className="font-mono text-[9px] truncate text-sylven-light/80">
                  {status === 'correcting' ? 'Fixing' : status === 'idle' ? agent.stage : status}
                </div>
              </SpotlightCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Reasoning Process — Framer Motion height-auto accordion */}
      <div
        className="w-full max-w-4xl rounded-xl overflow-hidden flex flex-col"
        style={{
          border: '1px solid var(--border2)',
          background: 'rgba(0, 0, 0, 0.92)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
        }}
      >
        <motion.div
          onClick={() => setShowReasoning(!showReasoning)}
          className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors select-none"
          style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sylven-light" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-sylven-light">
              Reasoning Process & Multi-Model Execution Stream
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-neutral-400">
              {agentEvents.length} log events
            </span>
            <motion.div
              animate={{ rotate: showReasoning ? 0 : -90 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <ChevronUp size={16} className="text-neutral-400" />
            </motion.div>
          </div>
        </motion.div>

        {/* Height-auto animated accordion body */}
        <AnimatePresence initial={false}>
          {showReasoning && (
            <motion.div
              key="reasoning-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              style={{ overflow: 'hidden' }}
            >
              <div
                className="p-4 overflow-y-auto font-mono text-xs space-y-2.5 max-h-[300px]"
                style={{ color: 'var(--green)' }}
              >
                <div style={{ color: 'var(--text3)' }}>
                  [SYS] Multi-Model Router connected · Pipeline stages active (PLANNING ➔ INGESTION ➔ DIFF_GENERATION ➔ AUTO_FIX)
                </div>

                {agentEvents.map((evt, idx) => {
                  const agentLabel = evt.agent.toUpperCase();
                  let color = 'var(--accent2)';
                  if (evt.status === 'completed') color = 'var(--green)';
                  if (evt.status === 'correcting') color = 'var(--amber)';

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-2 leading-relaxed"
                    >
                      <span className="shrink-0 select-none text-neutral-500">
                        [{evt.timestamp}]
                      </span>
                      {evt.stage && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 border border-white/10 shrink-0 text-sylven-light">
                          {evt.stage}
                        </span>
                      )}
                      <span className="font-semibold shrink-0 select-none" style={{ color }}>
                        [{agentLabel}]
                      </span>
                      <span style={{ color: 'var(--text)' }}>{evt.log || evt.message}</span>
                    </motion.div>
                  );
                })}

                <div className="flex items-center gap-1">
                  <span style={{ color: 'var(--text3)' }}>[{new Date().toLocaleTimeString()}]</span>
                  <span className="font-semibold text-emerald-400">[PIPELINE]</span>
                  <span style={{ color: 'var(--text)' }}>Executing {activeStage || 'stages'}…</span>
                  <span className="terminal-cursor" aria-hidden />
                </div>

                <div ref={terminalEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
