import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, Send, Cpu, AlertTriangle, Wrench, X, Brain, Zap, GitCompare, Sparkles, MessageSquare, Terminal, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../hooks/useRefinement';
import type { Blueprint } from '../lib/types';
import { timelineNodeSlide, timelineContainer, commandDock as commandDockVariants } from '../lib/motion';

interface RefinementChatProps {
  messages: ChatMessage[];
  isRefining: boolean;
  onSend: (message: string) => void;
  onClear: () => void;
  /** Active blueprint for dynamic contextual suggestion chips */
  blueprint?: Blueprint;
  /** Blueprint `<section>` — fixed dock matches this box on scroll / sidebar toggle */
  anchorRef: React.RefObject<HTMLElement>;
  /** Re-sync while app shell margin animates (sidebar open/close) */
  layoutSyncKey?: boolean;
}

function resolveSuggestions(blueprint?: Blueprint): string[] {
  if (blueprint?.suggestedRefinements && Array.isArray(blueprint.suggestedRefinements) && blueprint.suggestedRefinements.length > 0) {
    return blueprint.suggestedRefinements;
  }

  const textToMatch = `${blueprint?.appName ?? ''} ${blueprint?.title ?? ''} ${blueprint?.category ?? ''} ${blueprint?.description ?? ''}`.toLowerCase();

  // CRM / Sales apps
  if (/crm|sale|lead|deal|customer|pipeline|contact/i.test(textToMatch)) {
    return [
      'Add CSV lead bulk import with validation',
      'Add email thread tracking & webhook sync',
      'Add automated deal stage pipeline transition rules',
      'Add sales performance leaderboard panel',
    ];
  }

  // Health / Medical apps
  if (/health|med|care|clinic|doc|patient|appoint|pharm/i.test(textToMatch)) {
    return [
      'Add HIPAA compliance audit logging',
      'Add automated SMS appointment reminders',
      'Add doctor calendar sync & availability slots',
      'Add patient prescription history export',
    ];
  }

  // E-commerce / Store apps
  if (/shop|store|e-?commerce|cart|checkout|product|inventory|stripe/i.test(textToMatch)) {
    return [
      'Add Stripe payment webhooks with idempotency',
      'Add real-time WebSocket order tracking',
      'Add inventory depletion alert triggers',
      'Add multi-currency checkout support',
    ];
  }

  // Generic / Fallback
  return [
    'Add role-based access control (RBAC) schema',
    'Add Redis caching layer for API endpoints',
    'Add automated database audit trail tables',
    'Add OAuth 2.0 social login support',
  ];
}

const SHELL_TRANSITION_MS = 320;

interface ConversationTurn {
  user: ChatMessage;
  assistant?: ChatMessage;
}

function groupConversationTurns(messages: ChatMessage[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    const next = messages[i + 1];
    turns.push({
      user: msg,
      assistant: next?.role === 'assistant' ? next : undefined,
    });
    if (next?.role === 'assistant') i++;
  }
  return turns;
}

function useAnchorBounds(
  anchorRef: React.RefObject<HTMLElement>,
  layoutSyncKey?: boolean
) {
  const [bounds, setBounds] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    function update() {
      const target = anchorRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setBounds({ left: rect.left, width: rect.width });
    }

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    const shell = el.closest('.app-shell-content');
    if (shell) {
      observer.observe(shell);
      shell.addEventListener('transitionend', update);
    }

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      observer.disconnect();
      if (shell) shell.removeEventListener('transitionend', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (layoutSyncKey === undefined) return;

    const el = anchorRef.current;
    if (!el) return;

    function update() {
      const target = anchorRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setBounds({ left: rect.left, width: rect.width });
    }

    update();

    const frameId = requestAnimationFrame(update);
    const timeoutId = window.setTimeout(update, SHELL_TRANSITION_MS);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [layoutSyncKey, anchorRef]);

  return bounds;
}

export function RefinementChat({
  messages,
  isRefining,
  onSend,
  onClear,
  blueprint,
  anchorRef,
  layoutSyncKey,
}: RefinementChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);

  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isAutoFixing, setIsAutoFixing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const anchorBounds = useAnchorBounds(anchorRef, layoutSyncKey);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isRefining) setIsExpanded(true);
  }, [isRefining]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isRefining]);

  // Listen for sandbox errors from live preview iframe postMessage
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'BUILDX_SANDBOX_ERROR') {
        const errPayload = event.data.error;
        const msg = errPayload?.message || 'Runtime execution error captured';
        setSandboxError(msg);
      } else if (event.data?.type === 'BUILDX_TRIGGER_AUTO_FIX') {
        if (sandboxError) triggerAutoFix(sandboxError);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sandboxError]);

  const triggerAutoFix = (errMsg: string) => {
    setIsAutoFixing(true);
    setIsExpanded(true);
    onSend(`[AUTO-FIX DISPATCH] Fix sandbox execution error: ${errMsg}`);
    setTimeout(() => {
      setIsAutoFixing(false);
      setSandboxError(null);
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRefining) return;
    onSend(input.trim());
    setInput('');
  };

  const handleSuggestion = (suggestionText: string) => {
    if (isRefining) return;
    setInput(suggestionText);
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const suggestions = resolveSuggestions(blueprint);
  const conversationTurns = groupConversationTurns(messages);
  const pendingUserMessage = isRefining
    ? [...messages].reverse().find((m) => m.role === 'user')
    : undefined;

  const chatPanel = (
    <motion.div
      variants={commandDockVariants}
      initial="hidden"
      animate="show"
      className={`refine-chat pointer-events-auto bg-[#121216]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-2xl relative overflow-hidden transition-all duration-200 ${
        isExpanded ? 'border-indigo-500/30 ring-1 ring-indigo-500/20' : 'hover:border-white/20'
      }`}
    >
      {/* Sandbox Error Interceptor Bar */}
      <AnimatePresence>
        {sandboxError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-2.5 bg-red-950/90 border-b border-red-500/30 text-xs font-mono text-red-200"
          >
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span className="truncate">Sandbox error: {sandboxError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => triggerAutoFix(sandboxError)}
                disabled={isAutoFixing || isRefining}
                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] flex items-center gap-1 transition-all"
              >
                <Wrench size={11} />
                <span>Auto-Fix with Kimi K2.6</span>
              </button>
              <button
                type="button"
                onClick={() => setSandboxError(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dock Bar / Toggle */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => {
            const next = !isExpanded;
            setIsExpanded(next);
            if (next) {
              setTimeout(() => inputRef.current?.focus(), 100);
            }
          }}
          className="flex-1 flex items-center justify-between gap-3 text-left group cursor-pointer border-0 bg-transparent p-0 outline-none"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
              <Sparkles size={14} />
            </div>
            <span className="font-mono text-xs font-semibold text-neutral-200 group-hover:text-white transition-colors truncate">
              Cortex Agent Refinement
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {messages.length > 0 && (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </span>
            )}
            <div className="p-1 rounded-lg hover:bg-white/[0.08] text-neutral-400 group-hover:text-white transition-colors flex items-center justify-center">
              <ChevronUp
                size={15}
                strokeWidth={2}
                className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`}
                aria-hidden
              />
            </div>
          </div>
        </button>

        {messages.length > 0 && isExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-3 px-2 py-1 text-[10px] font-mono text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
            title="Clear chat"
          >
            Clear
          </button>
        )}
      </div>

      {/* Timeline Event Feed */}
      <div
        className="refine-chat__collapse overflow-hidden transition-all duration-300"
        style={{ maxHeight: isExpanded ? 'min(55vh, 440px)' : '0px' }}
      >
        <div
          className={`refine-chat__scroll ${messages.length > 0 ? 'refine-chat__scroll--has-history p-4 max-h-[380px]' : 'p-2 max-h-none'} overflow-y-auto relative`}
        >
          {messages.length > 0 ? (
            <motion.div
              variants={timelineContainer}
              initial="hidden"
              animate="show"
              className="timeline-feed border-l border-brand-border ml-4 pl-4 space-y-6 font-mono text-xs"
            >
              {conversationTurns.map((turn, turnIndex) => (
                <div key={turn.user.timestamp || turnIndex} className="space-y-4">
                  {/* User Question Node */}
                  <motion.div variants={timelineNodeSlide} className="timeline-node relative">
                    <div className="flex items-center gap-2 mb-1.5 text-[10px] text-zinc-400 font-mono">
                      <span className="text-[10px] text-brand-glow font-semibold">01 / ARCHITECT</span>
                      <span className="text-zinc-600">•</span>
                      <span>Request #{turnIndex + 1}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-brand-surface2 border border-brand-border text-zinc-100 leading-relaxed font-sans text-xs shadow-sm">
                      {turn.user.content}
                    </div>
                  </motion.div>

                  {/* Assistant Answer Node */}
                  {turn.assistant ? (
                    <motion.div variants={timelineNodeSlide} className="timeline-node relative">
                      <div className="flex items-center gap-2 mb-1.5 text-[10px] text-zinc-400 font-mono">
                        <span className="text-[10px] text-brand-green font-semibold">02 / PATCH_DIFF</span>
                        <span className="text-zinc-600">•</span>
                        <span>BuildX Cortex Multi-Model Stream</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-brand-surface border border-brand-border text-zinc-200 leading-relaxed font-sans text-xs shadow-sm">
                        {turn.assistant.content}
                      </div>
                    </motion.div>
                  ) : pendingUserMessage?.timestamp === turn.user.timestamp && isRefining ? (
                    <motion.div variants={timelineNodeSlide} className="timeline-node relative">
                      <div className="flex items-center gap-2 mb-1.5 text-[10px] text-amber-400 font-mono">
                        <span className="text-[10px] font-semibold">03 / AUTO_FIX</span>
                        <span className="text-zinc-600">•</span>
                        <span>Cortex Engine Pipeline</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-brand-surface2 border border-brand-accent/30 space-y-2">
                        <div className="flex items-center gap-2 text-brand-glow font-mono text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                          <span>Refining blueprint via Multi-Model Pipeline…</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 pt-2 border-t border-brand-borderSubtle font-mono">
                          <span className="flex items-center gap-1"><Brain size={10} className="text-brand-glow" /> 01 / ARCHITECT</span>
                          <span className="text-zinc-600">›</span>
                          <span className="flex items-center gap-1"><GitCompare size={10} className="text-brand-green" /> 02 / PATCH_DIFF</span>
                          <span className="text-zinc-600">›</span>
                          <span className="flex items-center gap-1 text-brand-amber font-semibold"><Wrench size={10} /> 03 / AUTO_FIX</span>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </div>
              ))}
              <div ref={messagesEndRef} />

              {/* CRITICAL: Clearance spacer so content never collides with sticky input bar */}
              <div className="h-36 w-full pointer-events-none" />
            </motion.div>
          ) : (
            <div className="refine-chat__suggestions p-2.5 space-y-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 font-semibold block select-none">
                TRY SAYING
              </span>
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 whitespace-nowrap">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    disabled={isRefining}
                    className="bg-brand-surface2 hover:bg-brand-surface3 border border-brand-border text-zinc-300 hover:text-white font-mono text-[11px] px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer text-left outline-none shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docked Glass Input Bar */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="bg-brand-surface border-t border-brand-border pt-2.5 sticky bottom-0 z-10 backdrop-blur-xl">
          <div className="h-10 flex items-center gap-2">
            <div className="text-[10px] font-mono px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-brand-green rounded-lg shrink-0 flex items-center gap-1.5 font-semibold select-none h-full">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
              <span className="hidden sm:inline">Engine:</span> Cortex Multi-Model
            </div>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isRefining}
              placeholder={
                isRefining ? 'Refining blueprint…' : 'e.g. "Add Stripe payment webhooks with idempotency"'
              }
              maxLength={500}
              className="bg-brand-bg border border-brand-border focus:border-brand-accent text-white font-mono text-xs px-3 py-2 rounded-lg flex-1 h-full focus:outline-none placeholder:text-zinc-500 outline-none transition-all"
            />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={!input.trim() || isRefining}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold px-4 h-full rounded-lg transition-all shrink-0 flex items-center justify-center border border-purple-400/30 cursor-pointer disabled:opacity-40 gap-1.5 font-mono shadow-md shadow-purple-500/20"
              aria-label={isRefining ? 'Refining' : 'Send refinement'}
            >
              {isRefining ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send size={12} />
                </>
              )}
            </motion.button>
          </div>
        </form>
      )}
    </motion.div>
  );

  const fixedDock = mounted
    ? createPortal(
        <div
          className="refine-chat-dock"
          style={
            anchorBounds.width > 0
              ? { left: anchorBounds.left, width: anchorBounds.width }
              : { left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 2rem)', maxWidth: '1024px' }
          }
        >
          {chatPanel}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {fixedDock}
      <div className="refine-chat-spacer" aria-hidden />
    </>
  );
}
