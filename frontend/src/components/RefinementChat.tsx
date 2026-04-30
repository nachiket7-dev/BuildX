import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../hooks/useRefinement';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';

interface RefinementChatProps {
  messages: ChatMessage[];
  isRefining: boolean;
  onSend: (message: string) => void;
  onClear: () => void;
  sidebarOffset?: number;
}

const SUGGESTIONS = [
  'Add Stripe payments',
  'Switch database to MongoDB',
  'Add a notification system',
  'Add real-time chat with WebSockets',
  'Add an admin analytics dashboard',
  'Make it a mobile app with React Native',
];

export function RefinementChat({ messages, isRefining, onSend, onClear, sidebarOffset = 0 }: RefinementChatProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { selectedModel, setSelectedModel } = useModel();

  // Track window width for responsive maxHeight
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-expand when there are messages
  useEffect(() => {
    if (messages.length > 0) setIsExpanded(true);
  }, [messages.length]);

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

  return (
    <div
      className={`fixed bottom-0 right-0 left-0 z-50 transition-all duration-300 ${
        sidebarOffset > 0 ? 'md:pl-[280px]' : ''
      }`}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="max-w-5xl mx-auto px-3 sm:px-6 pb-3 sm:pb-6"
        style={{ pointerEvents: 'auto' }}
      >
        <div
          className="rounded-2xl border overflow-hidden transition-all duration-300"
          style={{
            background: 'rgba(10, 10, 15, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'rgba(124, 106, 255, 0.2)',
            boxShadow: '0 -4px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Header bar — always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-5 py-3"
            style={{ borderBottom: isExpanded ? '1px solid rgba(124,106,255,0.15)' : 'none' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">✨</span>
              <span
                className="font-mono-custom text-xs font-medium"
                style={{ color: 'var(--accent2)' }}
              >
                Refine Blueprint
              </span>
              {messages.length > 0 && (
                <span
                  className="font-mono-custom text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--accent-glow)',
                    color: 'var(--accent2)',
                  }}
                >
                  {messages.length}
                </span>
              )}
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                color: 'var(--text3)',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* Expandable content */}
          <div
            style={{
              maxHeight: isExpanded ? (isMobile ? '55vh' : '400px') : '0px',
              opacity: isExpanded ? 1 : 0,
              transition: 'max-height 0.3s ease, opacity 0.2s ease',
              overflow: 'hidden',
            }}
          >
            {/* Messages area */}
            {messages.length > 0 ? (
              <div
                className="px-5 py-3 overflow-y-auto flex flex-col gap-2.5"
                style={{ maxHeight: '220px' }}
              >
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="px-3.5 py-2 rounded-xl text-xs max-w-[80%]"
                      style={{
                        background:
                          msg.role === 'user'
                            ? 'rgba(124, 106, 255, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                        color: msg.role === 'user' ? 'var(--accent2)' : 'var(--text2)',
                        borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
                        borderBottomLeftRadius: msg.role === 'user' ? '12px' : '4px',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isRefining && (
                  <div className="flex justify-start">
                    <div
                      className="px-3.5 py-2 rounded-xl text-xs flex items-center gap-2"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text3)',
                      }}
                    >
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot"
                          style={{ animationDelay: '0.2s' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot"
                          style={{ animationDelay: '0.4s' }}
                        />
                      </div>
                      Refining blueprint...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* Suggestion chips when no messages */
              <div className="px-5 py-3">
                <p
                  className="font-mono-custom text-[10px] uppercase tracking-wider mb-2"
                  style={{ color: 'var(--text3)' }}
                >
                  Try saying:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      disabled={isRefining}
                      className="font-mono-custom text-[11px] px-3 py-1.5 rounded-lg border transition-all duration-150 hover:scale-[1.02] disabled:opacity-40"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text3)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <form onSubmit={handleSubmit} className="px-3 sm:px-4 py-3 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isRefining}
                placeholder={
                  isRefining
                    ? 'Refining...'
                    : 'e.g. "Add a payments system with Stripe"'
                }
                maxLength={500}
                className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 rounded-xl border text-sm transition-all duration-150 disabled:opacity-50"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  (e.target as HTMLElement).style.borderColor = 'rgba(124,106,255,0.4)';
                }}
                onBlur={(e) => {
                  (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              />
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="px-3 py-2.5 rounded-xl border text-xs transition-all duration-150 flex-shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text3)',
                  }}
                  title="Clear chat"
                >
                  ✕
                </button>
              )}

              {/* Model Selector — hidden on mobile to save space */}
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="px-3 py-2.5 rounded-xl border flex items-center justify-center transition-all duration-150 group h-full"
                  style={{
                    background: showModelDropdown ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                    borderColor: showModelDropdown ? 'rgba(124, 106, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text3)',
                  }}
                  title="Select AI Model"
                  onMouseEnter={(e) => {
                    if (!showModelDropdown) (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!showModelDropdown) (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <span className="font-mono-custom text-[11px] sm:text-xs">
                    {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.label.split(' ')[0] || 'Model'}
                  </span>
                </button>

                {showModelDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
                    <div
                      className="absolute bottom-full right-0 mb-2 w-[220px] rounded-xl border z-50 overflow-hidden animate-fade-slide-up shadow-2xl"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border2)' }}
                    >
                      <div className="px-3 py-2 text-[10px] font-mono-custom tracking-wider uppercase" style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                        AI Model
                      </div>
                      <div className="p-1">
                        {AVAILABLE_MODELS.map((model) => (
                          <button
                            type="button"
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model.id);
                              setShowModelDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between group transition-colors"
                            style={{
                              background: selectedModel === model.id ? 'var(--surface2)' : 'transparent',
                              color: selectedModel === model.id ? 'var(--text)' : 'var(--text2)'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedModel !== model.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface3)';
                            }}
                            onMouseLeave={(e) => {
                              if (selectedModel !== model.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            <span className="font-mono-custom text-xs">{model.label}</span>
                            {model.badge && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded border font-mono-custom whitespace-nowrap"
                                style={{
                                  background: 'var(--accent-glow)',
                                  borderColor: 'var(--border2)',
                                  color: 'var(--accent2)'
                                }}
                              >
                                {model.badge}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={!input.trim() || isRefining}
                className="px-4 sm:px-5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 disabled:opacity-30 flex-shrink-0"
                style={{
                  background: 'rgba(124, 106, 255, 0.2)',
                  borderColor: 'rgba(124, 106, 255, 0.3)',
                  color: 'var(--accent2)',
                }}
              >
                {isRefining ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin-slow" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
