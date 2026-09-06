import React, { useState, useEffect } from 'react';
import { Play, Github, Download, Check, Sparkles, Layers, Zap, Bot, FileCode2, GitBranch, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpotlightCard } from './SpotlightCard';
import { StaggerGridContainer, StaggerGridItem } from './animations/StaggerGrid';
import { ScrollReveal } from './animations/ScrollReveal';
import { TextReveal } from './animations/TextReveal';

// ─── Live Pipeline Simulation Widget ────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'plan',  label: 'Gemini Flash',   role: 'Planning',    color: 'indigo',  icon: Bot },
  { id: 'ingest',label: 'GLM-5.2',        role: 'Ingestion',   color: 'blue',    icon: Zap },
  { id: 'diff',  label: 'Gemini Flash',   role: 'Diff Patch',  color: 'purple',  icon: GitBranch },
  { id: 'fix',   label: 'Gemini Flash',   role: 'Auto-Fix',    color: 'emerald', icon: Shield },
] as const;

const STREAM_TOKENS = [
  'CREATE TABLE users (',
  '\n  id UUID PRIMARY',
  ' KEY DEFAULT gen_',
  'random_uuid(),',
  '\n  email TEXT UNIQUE',
  ' NOT NULL,',
  '\n  created_at TIMESTAMPTZ',
  '\n);',
];

function PipelineWidget() {
  const [activeStage, setActiveStage] = useState(0);
  const [doneStages, setDoneStages] = useState<number[]>([]);
  const [tokenIndex, setTokenIndex] = useState(0);
  const [streamText, setStreamText] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage(prev => {
        const next = (prev + 1) % PIPELINE_STAGES.length;
        if (next === 0) setDoneStages([]);
        else setDoneStages(d => [...d, prev]);
        return next;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setStreamText('');
    setTokenIndex(0);
    setRunning(true);
  }, [activeStage]);

  useEffect(() => {
    if (!running) return;
    if (tokenIndex >= STREAM_TOKENS.length) { setRunning(false); return; }
    const delay = 120 + Math.random() * 80;
    const t = setTimeout(() => {
      setStreamText(prev => prev + STREAM_TOKENS[tokenIndex]);
      setTokenIndex(i => i + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [running, tokenIndex]);

  const colorMap = {
    indigo: { dot: 'bg-indigo-500/20 border-indigo-500/60', text: 'text-indigo-300', badge: 'bento-badge--indigo' },
    blue:   { dot: 'bg-blue-500/20 border-blue-500/60',     text: 'text-blue-300',   badge: 'bento-badge--blue'   },
    purple: { dot: 'bg-purple-500/20 border-purple-500/60', text: 'text-purple-300', badge: 'bento-badge--indigo' },
    emerald:{ dot: 'bg-emerald-500/20 border-emerald-500/60',text:'text-emerald-300',badge: 'bento-badge--emerald'},
  };

  return (
    <div className="space-y-4">
      {/* Stage Track */}
      <div className="flex items-center gap-1.5">
        {PIPELINE_STAGES.map((stage, i) => {
          const isDone   = doneStages.includes(i);
          const isActive = activeStage === i;
          const c = colorMap[stage.color];
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center gap-1 flex-1">
                <motion.div
                  animate={isActive ? { scale: 1.12, opacity: 1 } : isDone ? { scale: 1, opacity: 0.7 } : { scale: 0.95, opacity: 0.4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center
                    ${isActive ? `${c.dot} animate-node-glow` : isDone ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/[0.03] border-white/10'}`}
                >
                  {isDone
                    ? <Check size={13} className="text-emerald-400" />
                    : <Icon size={13} className={isActive ? c.text : 'text-neutral-500'} />
                  }
                </motion.div>
                <span className={`text-[9px] font-mono font-semibold truncate max-w-[4.5rem] text-center leading-tight
                  ${isActive ? c.text : isDone ? 'text-emerald-400' : 'text-neutral-600'}`}>
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="pipeline-connector h-px flex-1 -mt-4">
                  <motion.div
                    className="pipeline-connector__fill h-full"
                    animate={{ scaleX: isDone ? 1 : 0 }}
                    initial={{ scaleX: 0 }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Active Stage Badge */}
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
        <span className="text-[10px] font-sans text-neutral-400">
          <span className="text-indigo-300 font-semibold">{PIPELINE_STAGES[activeStage].role}</span>
          {' '}— {PIPELINE_STAGES[activeStage].label} responding…
        </span>
      </div>

      {/* Token Stream */}
      <div className="bg-[#0A0A0B] rounded-xl p-3.5 border border-white/[0.07] font-mono text-[11px] text-emerald-300 min-h-[80px] leading-relaxed overflow-hidden">
        <span className="text-indigo-400 select-none">// Streaming output{'\n'}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={activeStage + '-' + tokenIndex}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
          >
            {streamText}
          </motion.span>
        </AnimatePresence>
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.65 }}
          className="inline-block w-px h-3.5 bg-indigo-400 ml-0.5 align-middle"
        />
      </div>
    </div>
  );
}

// ─── Agentic Workflow Steps ───────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { label: 'Parse blueprint prompt',     status: 'done'    },
  { label: 'Generate PostgreSQL models', status: 'done'    },
  { label: 'Build Express REST routes',  status: 'active'  },
  { label: 'Verify TypeScript build',    status: 'pending' },
] as const;

function AgenticWorkflowWidget() {
  const [activeStep, setActiveStep] = useState(2);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveStep(prev => (prev + 1) % WORKFLOW_STEPS.length);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-2.5 mt-1">
      {WORKFLOW_STEPS.map((step, i) => {
        const isActive  = i === activeStep;
        const isDone    = i < activeStep;
        return (
          <motion.div
            key={step.label}
            animate={isActive ? { x: 0, opacity: 1 } : { opacity: isDone ? 0.7 : 0.45 }}
            className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-sans transition-colors
              ${isActive  ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300'
              : isDone   ? 'bg-emerald-500/[0.07] border-emerald-500/15 text-emerald-400'
              :             'bg-white/[0.02] border-white/[0.06] text-neutral-500'}`}
          >
            {isDone
              ? <Check size={11} className="text-emerald-400 flex-shrink-0" />
              : isActive
              ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
              : <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 flex-shrink-0" />
            }
            <span className="truncate">
              <span className="text-neutral-500 mr-1.5">0{i + 1}.</span>
              {step.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main BentoGrid Component ─────────────────────────────────────────────────

export function BentoGrid() {
  const [activeFileTab, setActiveFileTab] = useState<'app' | 'client' | 'schema'>('app');
  const [copied, setCopied] = useState(false);

  const fileContents = {
    app: `// backend/src/app.ts
import express from 'express';
import { router as apiRouter } from './routes';

export const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);`,
    client: `// frontend/src/api/client.ts
import axios from 'axios';

export const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' }
});`,
    schema: `-- db/schema.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(fileContents[activeFileTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-16">
      <ScrollReveal direction="up" delay={0.05}>
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300">
            <Layers size={13} className="text-indigo-400" />
            <span>Platform Architecture</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">
            <TextReveal text="Production-ready from idea to deployment" className="justify-center" />
          </h2>
          <p className="text-sm text-neutral-400">
            Every blueprint generated by BuildX includes full-stack backend routers, database schemas, and frontend interfaces.
          </p>
        </div>
      </ScrollReveal>

      <StaggerGridContainer className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Card 1: Live Multi-Model Pipeline (spans 2 cols) */}
        <StaggerGridItem className="md:col-span-2">
          <SpotlightCard
            className="h-full p-6 flex flex-col gap-5"
            spotlightColor="rgba(124, 124, 244, 0.2)"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                  <Zap size={14} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white font-display">Live Multi-Model Pipeline</div>
                  <div className="text-[10px] text-neutral-500 font-sans mt-0.5">4-stage autonomous routing</div>
                </div>
              </div>
              <span className="bento-badge bento-badge--indigo">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <PipelineWidget />
          </SpotlightCard>
        </StaggerGridItem>

        {/* Card 2: Agentic Workflow */}
        <StaggerGridItem>
          <SpotlightCard
            className="h-full p-6 flex flex-col gap-4"
            spotlightColor="rgba(16, 185, 129, 0.15)"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
                <Sparkles size={14} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white font-display">Agentic Workflow</div>
                <div className="text-[10px] text-neutral-500 font-sans mt-0.5">Real-time step tracing</div>
              </div>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Multi-step execution traced from prompt evaluation to database migrations.
            </p>
            <AgenticWorkflowWidget />
          </SpotlightCard>
        </StaggerGridItem>

        {/* Card 3: Codebase Explorer */}
        <StaggerGridItem>
          <SpotlightCard
            className="h-full p-6 flex flex-col gap-4"
            spotlightColor="rgba(59, 130, 246, 0.15)"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 size={16} className="text-blue-400" />
                <span className="text-sm font-semibold text-white font-display">Codebase Explorer</span>
              </div>
              <button
                onClick={copyCode}
                className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 text-xs text-neutral-300 flex items-center gap-1 transition-colors font-sans tracking-tight"
              >
                {copied ? <Check size={10} className="text-emerald-400" /> : null}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex items-center gap-1 border-b border-white/[0.08] pb-2">
              {(['app', 'client', 'schema'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFileTab(tab)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors tracking-tight ${
                    activeFileTab === tab
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {tab === 'app' ? 'app.ts' : tab === 'client' ? 'client.ts' : 'schema.sql'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeFileTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="bg-[#0A0A0B] rounded-xl p-3.5 font-mono text-[10.5px] text-neutral-300 overflow-x-auto border border-white/[0.07] shadow-inner flex-1"
              >
                <pre className="leading-relaxed font-mono">{fileContents[activeFileTab]}</pre>
              </motion.div>
            </AnimatePresence>
          </SpotlightCard>
        </StaggerGridItem>

        {/* Card 4: Instant Sandbox */}
        <StaggerGridItem>
          <SpotlightCard
            className="h-full p-6 flex flex-col gap-4"
            spotlightColor="rgba(124, 124, 244, 0.15)"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-500/12 border border-purple-500/20 flex items-center justify-center">
                <Play size={14} className="text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white font-display">Instant Sandbox</div>
                <div className="text-[10px] text-neutral-500 font-sans mt-0.5">Browser-native runtime</div>
              </div>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed font-sans">
              Generated screens rendered live in-browser via Babel transpilation — no local setup required.
            </p>
            <div className="mt-auto">
              <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0B] p-3 space-y-2">
                {['React 18', 'TypeScript', 'Tailwind CSS'].map((lib) => (
                  <div key={lib} className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-neutral-400">{lib}</span>
                    <span className="bento-badge bento-badge--emerald">shimmed</span>
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>
        </StaggerGridItem>

        {/* Card 5: GitHub Sync & Export (spans 2 cols) */}
        <StaggerGridItem className="md:col-span-2">
          <SpotlightCard
            className="h-full p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            spotlightColor="rgba(157, 122, 255, 0.18)"
          >
            <div className="space-y-2 flex-1">
              {/* Header: icon + title on same baseline */}
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 inline-flex items-center justify-center flex-shrink-0">
                  <Github size={14} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-white font-display leading-none">GitHub Sync &amp; ZIP Export</span>
              </div>
              <p className="text-xs text-neutral-400 max-w-md leading-relaxed font-sans">
                Push production repos directly to GitHub or download a self-contained ZIP archive ready for{' '}
                <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded text-[10px] font-mono">npm install</code>.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="bento-badge bento-badge--emerald font-sans text-xs"><Check size={10} /> OAuth 2.0</span>
                <span className="bento-badge bento-badge--indigo font-sans text-xs">20+ files</span>
                <span className="bento-badge bento-badge--amber font-sans text-xs">JWT secured</span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto flex-shrink-0">
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold font-sans leading-none transition-colors"
              >
                <Github size={13} className="flex-shrink-0" />
                <span className="leading-none">Push to GitHub</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/[0.15] border border-white/10 text-white text-xs font-medium font-sans leading-none transition-colors"
              >
                <Download size={13} className="flex-shrink-0" />
                <span className="leading-none">Download ZIP</span>
              </motion.button>
            </div>
          </SpotlightCard>
        </StaggerGridItem>

      </StaggerGridContainer>
    </section>
  );
}
