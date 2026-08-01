import React, { useState, useRef } from 'react';
import { EXAMPLE_IDEAS } from '../lib/utils';
import { SpotlightCard } from './SpotlightCard';
import { BentoGrid } from './BentoGrid';
import { Sparkles, ArrowRight, Code2, Database, ShieldCheck, Layers, Terminal, Server, Check } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';

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

const rightColVariants = {
  hidden: { opacity: 0, x: 30, scale: 0.97 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.15 },
  },
};

const tabContentVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
};

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
    <>
      {/* ─── Hero Section: Asymmetrical 2-Column Split Stage ─── */}
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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300"
            >
              <Sparkles size={13} className="text-indigo-400" />
              <span>Next-Gen Full-Stack AI Architect</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white font-display leading-[1.1]"
            >
              Architect your next <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
                big idea with AI.
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-sm sm:text-base text-neutral-400 max-w-xl leading-relaxed"
            >
              Turn prompts into production-ready monorepos: PostgreSQL schemas, Express/Next.js API routes, React UI screens, Mermaid ERD diagrams, and Docker configs.
            </motion.p>

            {/* Live Stack Selector Pills */}
            <motion.div
              variants={itemVariants}
              className="p-3 rounded-2xl bg-neutral-950/60 border border-white/10 space-y-3 max-w-xl"
            >
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>Select Target Stack Specs</span>
                <span className="text-emerald-400">Customized Monorepo</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {/* Framework Selector */}
                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/5">
                  <Server size={12} className="text-indigo-400 ml-1.5" />
                  {(['next', 'express', 'fastify'] as const).map((fw) => (
                    <motion.button
                      key={fw}
                      type="button"
                      onClick={() => setFramework(fw)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        framework === fw ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {fw === 'next' ? 'Next.js' : fw === 'express' ? 'Express' : 'Fastify'}
                    </motion.button>
                  ))}
                </div>

                {/* DB Selector */}
                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/5">
                  <Database size={12} className="text-emerald-400 ml-1.5" />
                  {(['postgres', 'supabase', 'mongo'] as const).map((d) => (
                    <motion.button
                      key={d}
                      type="button"
                      onClick={() => setDb(d)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        db === d ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {d === 'postgres' ? 'Postgres' : d === 'supabase' ? 'Supabase' : 'MongoDB'}
                    </motion.button>
                  ))}
                </div>

                {/* Auth Selector */}
                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/5">
                  <ShieldCheck size={12} className="text-purple-400 ml-1.5" />
                  {(['jwt', 'clerk', 'nextauth'] as const).map((a) => (
                    <motion.button
                      key={a}
                      type="button"
                      onClick={() => setAuth(a)}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      className={`px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        auth === a ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-neutral-400 hover:text-white'
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
                spotlightColor={isFocused ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.05)'}
                className={`p-4 rounded-t-2xl border transition-all duration-300 ${
                  isFocused ? 'border-indigo-500/50 shadow-2xl shadow-indigo-500/10' : 'border-white/10 bg-neutral-950/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                    <Terminal size={14} className="text-indigo-400" />
                    <span>Prompt Command Console</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
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
                  className="w-full bg-transparent border-none outline-none resize-none text-sm sm:text-base leading-relaxed text-white placeholder-neutral-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
                  }}
                />
              </SpotlightCard>

              {/* Bottom action bar */}
              <div className="relative flex items-center justify-between px-4 py-2.5 bg-neutral-950/80 border border-white/10 border-t border-t-white/5 rounded-b-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                  <span className={charCount >= MIN_CHARS ? 'text-emerald-400' : 'text-neutral-500'}>
                    {charCount}/{MIN_CHARS}
                  </span>
                  <span className="opacity-60 hidden sm:inline">· <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px]">⌘</kbd><kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] ml-0.5">↵</kbd></span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Pipeline Status Indicator */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-indigo-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Autonomous Multi-Model Pipeline</span>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.04 } : {}}
                    whileTap={canSubmit ? { scale: 0.96 } : {}}
                    className="px-5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-40"
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
              <div className="text-xs text-neutral-500 font-mono">Preset App Blueprint Templates:</div>
              <motion.div
                className="flex flex-wrap gap-2"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {EXAMPLE_IDEAS.map(({ label, idea: exampleIdea }, i) => (
                  <motion.button
                    key={label}
                    type="button"
                    onClick={() => fillExample(exampleIdea)}
                    disabled={isLoading}
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className="px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/10 text-xs text-neutral-300 font-mono transition-colors"
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
            <SpotlightCard spotlightColor="rgba(99, 102, 241, 0.15)" className="p-5 rounded-3xl border border-white/10 bg-neutral-950/90 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 font-mono text-xs text-neutral-300">
                  <Code2 size={15} className="text-indigo-400" />
                  <span>Monorepo Spec Live Output</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                  Real-Time
                </span>
              </div>

              {/* Inspector Tabs */}
              <div className="flex gap-1 bg-black/60 p-1 rounded-xl border border-white/5 mb-4">
                {(['schema', 'api', 'ui'] as const).map((tab) => (
                  <motion.button
                    key={tab}
                    type="button"
                    onClick={() => setPreviewTab(tab)}
                    whileTap={{ scale: 0.96 }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                      previewTab === tab ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tab === 'schema' ? 'DB Schema' : tab === 'api' ? 'API Routes' : 'React UI'}
                  </motion.button>
                ))}
              </div>

              {/* Inspector Tab Content with AnimatePresence transitions */}
              <div className="bg-black/80 rounded-2xl p-4 font-mono text-xs border border-white/5 min-h-[220px] overflow-hidden">
                <motion.div
                  key={previewTab}
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  {previewTab === 'schema' && (
                    <div className="space-y-2 text-neutral-300">
                      <div className="text-indigo-400 font-semibold">// PostgreSQL Schema Draft</div>
                      <div className="text-neutral-400">CREATE TABLE users (</div>
                      <div className="pl-4 text-emerald-300">id UUID PRIMARY KEY DEFAULT gen_random_uuid(),</div>
                      <div className="pl-4 text-neutral-300">email VARCHAR(255) NOT NULL UNIQUE,</div>
                      <div className="pl-4 text-purple-300">role VARCHAR(50) DEFAULT 'patient',</div>
                      <div className="pl-4 text-neutral-400">created_at TIMESTAMP WITH TIME ZONE</div>
                      <div className="text-neutral-400">);</div>
                    </div>
                  )}

                  {previewTab === 'api' && (
                    <div className="space-y-2 text-neutral-300">
                      <div className="text-indigo-400 font-semibold">// Express TypeScript Endpoints</div>
                      <div className="flex items-center gap-2"><span className="text-emerald-400 font-bold">POST</span> <span>/api/v1/auth/login</span></div>
                      <div className="flex items-center gap-2"><span className="text-blue-400 font-bold">GET</span> <span>/api/v1/appointments/slots</span></div>
                      <div className="flex items-center gap-2"><span className="text-amber-400 font-bold">POST</span> <span>/api/v1/payments/webhook</span></div>
                      <div className="flex items-center gap-2"><span className="text-purple-400 font-bold">PATCH</span> <span>/api/v1/users/profile</span></div>
                    </div>
                  )}

                  {previewTab === 'ui' && (
                    <div className="space-y-2 text-neutral-300">
                      <div className="text-indigo-400 font-semibold">// Generated React + Tailwind Screen</div>
                      <div className="text-purple-300">&lt;div className="p-6 rounded-2xl bg-neutral-900 border"&gt;</div>
                      <div className="pl-4 text-neutral-300">&lt;AppointmentCalendar slots={'{'}availableSlots{'}'} /&gt;</div>
                      <div className="pl-4 text-emerald-300">&lt;StripePaymentButton amount={'{'}15000{'}'} /&gt;</div>
                      <div className="text-purple-300">&lt;/div&gt;</div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Footer Stat Pills inside Inspector */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/5 text-center font-mono text-[11px]">
                {[
                  { value: '20+ Files', label: 'Monorepo', color: 'text-indigo-400' },
                  { value: '< 30 sec', label: 'Generation', color: 'text-emerald-400' },
                  { value: '4 Models', label: 'Pipeline', color: 'text-purple-400' },
                ].map(({ value, label, color }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.08, duration: 0.3 }}
                    className="p-2 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className={`${color} font-bold`}>{value}</div>
                    <div className="text-neutral-500 text-[9px]">{label}</div>
                  </motion.div>
                ))}
              </div>
            </SpotlightCard>
          </motion.div>

        </div>
      </section>

      {/* Bento Grid Feature Showcase */}
      <section className="w-full px-4 sm:px-6 py-12 max-w-7xl mx-auto border-t border-white/10">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-2xl sm:text-4xl font-bold font-display text-white mb-2">
            Built for Principal Engineers & Founders
          </h2>
          <p className="text-neutral-400 text-sm max-w-xl mx-auto font-mono">
            BuildX replaces boilerplate code setup with strict multi-model pipeline execution.
          </p>
        </motion.div>
        <BentoGrid />
      </section>
    </>
  );
}
