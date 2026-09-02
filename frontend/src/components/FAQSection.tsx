import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, HelpCircle, Shield, Zap, Terminal, Key } from 'lucide-react';
import { ScrollReveal } from './animations/ScrollReveal';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  icon: typeof HelpCircle;
  tag: string;
}

const FAQS: FAQItem[] = [
  {
    id: 'multi-model',
    question: 'How fast and reliable is the Multi-Model Orchestration pipeline?',
    answer: 'BuildX runs a unified agent pipeline for planning, ingestion, code generation, refinement, diff generation, and auto-fix. Each stage has a configured primary, fallback, and emergency model, with rate-limit cooldowns and automatic failover. Streaming stages use Server-Sent Events (SSE) and report the model that actually completed the work.',
    icon: Zap,
    tag: 'Pipeline Speed',
  },
  {
    id: 'sandbox-safety',
    question: 'Is the browser-based Terminal Sandbox secure?',
    answer: 'Yes. Generated TypeScript and React JSX code is compiled live in your browser via Babel and executed inside an isolated, cross-origin iframe sandbox. All module dependencies (React, Lucide, Tailwind, Axios) are shimmed client-side with zero remote code execution risk.',
    icon: Shield,
    tag: 'Sandbox Security',
  },
  {
    id: 'local-dev',
    question: 'Can I export the codebase for local development or push to GitHub?',
    answer: 'Absolutely. Every blueprint can be downloaded as a complete, self-contained monorepo ZIP file ready for `npm install`, or pushed directly to your personal GitHub repository in one click via GitHub OAuth integration.',
    icon: Terminal,
    tag: 'Monorepo Export',
  },
  {
    id: 'api-keys',
    question: 'How are provider API keys and token budgets managed?',
    answer: 'All API keys remain securely proxied server-side and are never exposed to the client. BuildX implements per-model token budget caps, automatic model aliasing, and rate-limiting to ensure predictable performance and prevent API depletion.',
    icon: Key,
    tag: 'Key Security',
  },
];

export function FAQSection() {
  const [openId, setOpenId] = useState<string | null>('multi-model');

  const toggle = (id: string) => {
    setOpenId(prev => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="w-full max-w-7xl mx-auto px-6 py-20 border-t border-white/10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

        {/* Left Column: Sticky Section Heading */}
        <div className="lg:col-span-4 lg:sticky lg:top-28 space-y-4">
          <ScrollReveal direction="down" delay={0.05}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300">
              <HelpCircle size={13} className="text-indigo-400" />
              <span>04 / FREQUENTLY ASKED QUESTIONS</span>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.15}>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display leading-[1.1]">
              Everything you need to know
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed pt-2">
              Have questions about multi-model routing, code sandbox security, or monorepo exports? Here are the technical details.
            </p>
          </ScrollReveal>
        </div>

        {/* Right Column: Interactive Accordion List */}
        <div className="lg:col-span-8 space-y-4">
          {(FAQS ?? []).map((faq) => {
            if (!faq) return null;
            const isOpen = openId === faq.id;
            const Icon = faq.icon ?? HelpCircle;

            return (
              <ScrollReveal key={faq.id} direction="up" delay={0.1}>
                <div className="rounded-2xl border border-white/10 bg-neutral-950/80 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-indigo-500/30">
                  <button
                    type="button"
                    onClick={() => toggle(faq.id)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isOpen ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/[0.04] border-white/10 text-neutral-400'
                      }`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block mb-0.5">
                          {faq.tag ?? 'FAQ'}
                        </span>
                        <h3 className="text-base font-semibold text-white font-display leading-snug">
                          {faq.question}
                        </h3>
                      </div>
                    </div>

                    {/* Animated '+' to '×' (rotate 45deg) toggle icon */}
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className={`p-2 rounded-full border shrink-0 ${
                        isOpen ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-white/[0.04] text-neutral-400 border-white/10'
                      }`}
                    >
                      <Plus size={16} />
                    </motion.div>
                  </button>

                  {/* Accordion Content Reveal */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-1 text-xs sm:text-sm text-neutral-300 font-mono leading-relaxed border-t border-white/5 bg-white/[0.01]">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

      </div>
    </section>
  );
}
