import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, Send, Cpu, AlertTriangle, Wrench, X, Brain, Zap, GitCompare } from 'lucide-react';
import type { ChatMessage } from '../hooks/useRefinement';

interface RefinementChatProps {
  messages: ChatMessage[];
  isRefining: boolean;
  onSend: (message: string) => void;
  onClear: () => void;
  /** Blueprint `<section>` — fixed dock matches this box on scroll / sidebar toggle */
  anchorRef: React.RefObject<HTMLElement>;
  /** Re-sync while app shell margin animates (sidebar open/close) */
  layoutSyncKey?: boolean;
}

const SUGGESTIONS = [
  'Add Stripe payments',
  'Switch database to MongoDB',
  'Add a notification system',
  'Add a real-time chat with WebSockets',
  'Add an admin analytics dashboard',
  'Make it a mobile app with React Native',
];

/** Matches app-shell-content `transition-all duration-300` */
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
  anchorRef,
  layoutSyncKey,
}: RefinementChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);

  // Auto-Fix sandbox error banner state
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

  // Listen for sandbox errors from the sandboxRunner iframe postMessage
  useEffect(() => {
    function handleSandboxMessage(event: MessageEvent) {
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.type === 'BUILDX_SANDBOX_ERROR'
      ) {
        const errMsg: string =
          event.data.error ||
          event.data.message ||
          'Unknown sandbox runtime error';
        setSandboxError(errMsg);
      }
    }
    window.addEventListener('message', handleSandboxMessage);
    return () => window.removeEventListener('message', handleSandboxMessage);
  }, []);

  const handleAutoFixTrigger = () => {
    if (!sandboxError || isRefining || isAutoFixing) return;
    setIsAutoFixing(true);
    onSend(`[AUTO_FIX] Fix this sandbox runtime error:\n\n${sandboxError}`);
    setSandboxError(null);
    setTimeout(() => setIsAutoFixing(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRefining) return;
    onSend(input.trim());
    setInput('');
  };

  const handleSuggestion = (text: string) => {
    if (isRefining) return;
    onSend(text);
  };

  const conversationTurns = groupConversationTurns(messages);
  const pendingUserMessage =
    messages.length > 0 && messages[messages.length - 1]?.role === 'user' && isRefining
      ? messages[messages.length - 1]
      : null;

  const chatPanel = (
    <div
      className={`refine-chat ${isExpanded ? 'refine-chat--expanded' : ''}`}
    >
      {/* Floating Auto-Fix Banner — appears when sandboxRunner emits BUILDX_SANDBOX_ERROR */}
      {sandboxError && (
        <div className="absolute -top-14 left-0 right-0 mx-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-950/60 backdrop-blur-sm text-amber-300 text-xs font-medium shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <AlertTriangle size={14} className="shrink-0 text-amber-400" />
          <span className="flex-1 truncate">Sandbox Error Detected</span>
          <button
            type="button"
            onClick={handleAutoFixTrigger}
            disabled={isRefining || isAutoFixing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-[11px] font-bold transition-colors disabled:opacity-50 shrink-0"
          >
            <Wrench size={11} />
            {isAutoFixing ? 'Fixing…' : 'Auto Fix'}
          </button>
          <button
            type="button"
            onClick={() => setSandboxError(null)}
            className="text-amber-400/70 hover:text-amber-300 p-0.5 rounded transition-colors shrink-0"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="refine-chat__accent" aria-hidden />
      <div className="refine-chat__header">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="refine-chat__header-toggle"
          aria-expanded={isExpanded}
        >
          <div className="refine-chat__header-left">
            <span className="refine-chat__header-icon" aria-hidden>
              <Cpu size={14} strokeWidth={2} className="text-indigo-400" />
            </span>
            <span className="refine-chat__header-title">Refine Blueprint</span>
            {isRefining && (
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono animate-pulse">
                ⚡ Multi-Model Pipeline Active
              </span>
            )}
            {!isExpanded && messages.length > 0 && (
              <span className="refine-chat__header-preview">
                {messages[messages.length - 1]?.content.slice(0, 72)}
                {(messages[messages.length - 1]?.content.length ?? 0) > 72 ? '…' : ''}
              </span>
            )}
          </div>
          <ChevronUp
            size={14}
            strokeWidth={2}
            className={`refine-chat__chevron ${isExpanded ? 'refine-chat__chevron--open' : ''}`}
            aria-hidden
          />
        </button>
        {messages.length > 0 && isExpanded && (
          <button
            type="button"
            onClick={onClear}
            className="refine-chat__clear-btn"
            title="Clear chat"
          >
            Clear
          </button>
        )}
      </div>

      <div
        className="refine-chat__collapse"
        style={{ maxHeight: isExpanded ? 'min(55vh, 420px)' : '0px' }}
      >
        <div
          className={`refine-chat__scroll ${messages.length > 0 ? 'refine-chat__scroll--has-history' : ''}`}
        >
          {messages.length > 0 ? (
            <div className="refine-chat__messages">
              <div className="refine-chat__history-head">
                <span className="refine-chat__history-title">Conversation history</span>
                <span className="refine-chat__history-count">
                  {conversationTurns.length}{' '}
                  {conversationTurns.length === 1 ? 'request' : 'requests'}
                </span>
              </div>

              <div className="refine-chat__turn-list">
                {conversationTurns.map((turn, turnIndex) => (
                  <article key={turn.user.timestamp} className="refine-chat__turn">
                    <header className="refine-chat__turn-head">
                      Request {turnIndex + 1}
                    </header>
                    <div className="refine-chat__bubble-row refine-chat__bubble-row--user">
                      <span className="refine-chat__bubble-label">You asked</span>
                      <div className="refine-chat__bubble refine-chat__bubble--user">
                        {turn.user.content}
                      </div>
                    </div>
                    {turn.assistant ? (
                      <div className="refine-chat__bubble-row refine-chat__bubble-row--assistant">
                        <span className="refine-chat__bubble-label">BuildX Cortex</span>
                        <div className="refine-chat__bubble refine-chat__bubble--assistant">
                          {turn.assistant.content}
                        </div>
                      </div>
                    ) : pendingUserMessage?.timestamp === turn.user.timestamp && isRefining ? (
                      <div className="refine-chat__bubble-row refine-chat__bubble-row--assistant">
                        <span className="refine-chat__bubble-label">BuildX Cortex</span>
                        <div className="refine-chat__bubble refine-chat__bubble--typing flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="refine-chat__typing-dots" aria-hidden>
                              <span />
                              <span />
                              <span />
                            </div>
                            Refining blueprint via Multi-Model Pipeline…
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-indigo-300/80 bg-indigo-950/40 p-2 rounded border border-indigo-500/20">
                            <span className="flex items-center gap-1"><Brain size={10} className="text-purple-400" /> PLANNING</span>
                            <span className="text-gray-600">›</span>
                            <span className="flex items-center gap-1"><Zap size={10} className="text-sky-400" /> INGESTION</span>
                            <span className="text-gray-600">›</span>
                            <span className="flex items-center gap-1"><GitCompare size={10} className="text-emerald-400" /> DIFF_GENERATION</span>
                            <span className="text-gray-600">›</span>
                            <span className="flex items-center gap-1 text-amber-400 font-semibold"><Wrench size={10} /> AUTO_FIX (Kimi K2.6)</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="refine-chat__suggestions">
              <p className="refine-chat__suggestions-label">Try saying</p>
              <div className="refine-chat__suggestions-list">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    disabled={isRefining}
                    className="refine-chat__suggestion-chip"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="refine-chat__form">
          {/* Pipeline mode badge replacing model selector */}
          <div className="refine-chat__model-slot">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 font-mono select-none whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Pipeline Mode: Autonomous</span>
            </div>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isRefining}
            placeholder={
              isRefining ? 'Refining…' : 'e.g. "Add a payments system with Stripe"'
            }
            maxLength={500}
            className="refine-chat__input"
          />

          <button
            type="submit"
            disabled={!input.trim() || isRefining}
            className="refine-chat__send-btn"
            aria-label={isRefining ? 'Refining' : 'Send refinement'}
          >
            {isRefining ? (
              <span className="refine-chat__send-spinner" aria-hidden />
            ) : (
              <Send size={18} strokeWidth={2} aria-hidden />
            )}
          </button>
        </form>
      )}
    </div>
  );

  const fixedDock =
    mounted && anchorBounds.width > 0
      ? createPortal(
          <div
            className="refine-chat-dock"
            style={{
              left: anchorBounds.left,
              width: anchorBounds.width,
            }}
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
