import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Send, Wand2 } from 'lucide-react';
import type { ChatMessage } from '../hooks/useRefinement';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';

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

const MODEL_MENU_WIDTH = 240;
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

    let raf = 0;
    const endAt = performance.now() + SHELL_TRANSITION_MS;

    function tick() {
      update();
      if (performance.now() < endAt) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [anchorRef, layoutSyncKey]);

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
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const anchorBounds = useAnchorBounds(anchorRef, layoutSyncKey);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const { selectedModel, setSelectedModel } = useModel();

  const selectedModelMeta = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
  const selectedModelLabel = selectedModelMeta?.label ?? 'Model';
  const shortModelLabel = selectedModelLabel.split(' ')[0] ?? 'Model';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) setIsExpanded(true);
  }, [messages.length]);

  useLayoutEffect(() => {
    if (!showModelDropdown || !modelBtnRef.current) {
      setMenuPos(null);
      return;
    }

    function updatePosition() {
      const btn = modelBtnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      let left = rect.left;
      const maxLeft = window.innerWidth - MODEL_MENU_WIDTH - 12;
      if (left > maxLeft) left = maxLeft;
      if (left < 12) left = 12;
      setMenuPos({
        left,
        bottom: window.innerHeight - rect.top + 8,
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showModelDropdown, isExpanded]);

  useEffect(() => {
    if (!showModelDropdown) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowModelDropdown(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showModelDropdown]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || isRefining) return;
    onSend(msg);
    setInput('');
  }

  function handleSuggestion(suggestion: string) {
    if (isRefining) return;
    onSend(suggestion);
  }

  const modelMenu =
    showModelDropdown && menuPos
      ? createPortal(
          <>
            <div
              className="refine-chat__menu-backdrop"
              aria-hidden
              onClick={() => setShowModelDropdown(false)}
            />
            <div
              className="model-select-menu refine-chat__model-menu-portal animate-fade-slide-up"
              role="listbox"
              aria-label="AI Model"
              style={{
                position: 'fixed',
                left: menuPos.left,
                bottom: menuPos.bottom,
                width: MODEL_MENU_WIDTH,
                zIndex: 200,
              }}
            >
              <div className="model-select-menu__header">AI Model</div>
              <div className="model-select-menu__list">
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = selectedModel === model.id;
                  return (
                    <button
                      type="button"
                      key={model.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelDropdown(false);
                      }}
                      className={`model-select-option ${isSelected ? 'model-select-option--active' : ''}`}
                    >
                      <span className="font-mono-custom text-xs">{model.label}</span>
                      {model.badge && (
                        <span className="model-select-option__badge">{model.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  const conversationTurns = groupConversationTurns(messages);
  const pendingUserMessage =
    messages.length > 0 && messages[messages.length - 1]?.role === 'user' && isRefining
      ? messages[messages.length - 1]
      : null;

  const chatPanel = (
    <div
      className={`refine-chat ${isExpanded ? 'refine-chat--expanded' : ''} ${showModelDropdown ? 'refine-chat--menu-open' : ''}`}
    >
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
              <Wand2 size={14} strokeWidth={2} />
            </span>
            <span className="refine-chat__header-title">Refine Blueprint</span>
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
                        <span className="refine-chat__bubble-label">BuildX replied</span>
                        <div className="refine-chat__bubble refine-chat__bubble--assistant">
                          {turn.assistant.content}
                        </div>
                      </div>
                    ) : pendingUserMessage?.timestamp === turn.user.timestamp && isRefining ? (
                      <div className="refine-chat__bubble-row refine-chat__bubble-row--assistant">
                        <span className="refine-chat__bubble-label">BuildX</span>
                        <div className="refine-chat__bubble refine-chat__bubble--typing">
                          <div className="refine-chat__typing-dots" aria-hidden>
                            <span />
                            <span />
                            <span />
                          </div>
                          Refining blueprint…
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
          <div className="refine-chat__model-slot">
            <button
              ref={modelBtnRef}
              type="button"
              onClick={() => setShowModelDropdown((v) => !v)}
              className={`model-select-btn refine-chat__model-btn ${showModelDropdown ? 'model-select-btn--open' : ''}`}
              aria-expanded={showModelDropdown}
              aria-haspopup="listbox"
              title={selectedModelLabel}
            >
              <span className="model-select-btn__dot" aria-hidden />
              <span className="refine-chat__model-btn-label sm:hidden">{shortModelLabel}</span>
              <span className="refine-chat__model-btn-label hidden sm:inline">
                {selectedModelLabel}
              </span>
              <ChevronDown
                size={12}
                strokeWidth={2}
                className="model-select-btn__chevron shrink-0"
                aria-hidden
              />
            </button>
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
      {modelMenu}
      {fixedDock}
      <div className="refine-chat-spacer" aria-hidden />
    </>
  );
}
