import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXAMPLE_IDEAS } from '../lib/utils';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from './AuthModal';

interface HeroProps {
  onGenerate: (idea: string) => void;
  isLoading: boolean;
}

// ─── Animated counter ─────────────────────────────────────
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = Math.max(1, Math.floor(target / 40));
          const interval = setInterval(() => {
            start += step;
            if (start >= target) {
              setCount(target);
              clearInterval(interval);
            } else {
              setCount(start);
            }
          }, 30);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

// ─── Feature card ─────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
  gradient,
  delay,
}: {
  icon: string;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="card p-6 transition-all duration-500 hover:scale-[1.02] group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <h3 className="font-display font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>
        {title}
      </h3>
      <p className="font-mono-custom text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
        {description}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────
export function Hero({ onGenerate, isLoading }: HeroProps) {
  const [idea, setIdea] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const { selectedModel, setSelectedModel } = useModel();
  const { user } = useAuth();
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = idea.trim();
    if (trimmed.length < 10 || isLoading) return;
    // Gate GPT-OSS 120B behind auth
    if (selectedModel === 'gpt-oss-120b' && !user) {
      setShowAuthModal(true);
      return;
    }
    onGenerate(trimmed);
  }

  function fillExample(text: string) {
    setIdea(text);
    textareaRef.current?.focus();
  }

  const canSubmit = idea.trim().length >= 10 && !isLoading;

  const FEATURES = [
    {
      icon: '⚡',
      title: 'Real-Time Streaming',
      description:
        'Watch your blueprint build in real-time via Server-Sent Events. No fake loading screens.',
      gradient: 'linear-gradient(135deg, rgba(124,106,255,0.3), rgba(124,106,255,0.1))',
    },
    {
      icon: '📐',
      title: 'Visual Diagrams',
      description:
        'Auto-generated ER diagrams, architecture flowcharts, and API sequence diagrams with Mermaid.',
      gradient: 'linear-gradient(135deg, rgba(34,211,165,0.3), rgba(34,211,165,0.1))',
    },
    {
      icon: '📦',
      title: 'Download Full Project',
      description:
        'Export a production-ready monorepo: Prisma schema, Express routes, React pages, Docker.',
      gradient: 'linear-gradient(135deg, rgba(96,165,250,0.3), rgba(96,165,250,0.1))',
    },
    {
      icon: '💬',
      title: 'AI Refinement Chat',
      description:
        '"Add Stripe payments" — refine your blueprint through natural language conversation.',
      gradient: 'linear-gradient(135deg, rgba(251,146,60,0.3), rgba(251,146,60,0.1))',
    },
    {
      icon: '🔗',
      title: 'Shareable Links',
      description:
        'Every blueprint gets a unique URL. Share with your team or embed in your portfolio.',
      gradient: 'linear-gradient(135deg, rgba(244,114,182,0.3), rgba(244,114,182,0.1))',
    },
    {
      icon: '🧠',
      title: 'Smart Architecture',
      description:
        'AI picks the right tech stack, designs the schema with foreign keys, maps all API endpoints.',
      gradient: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(168,85,247,0.1))',
    },
  ];

  const STATS = [
    { value: 7, suffix: '+', label: 'Blueprint Sections' },
    { value: 20, suffix: '+', label: 'Files per Export' },
    { value: 3, suffix: '', label: 'Diagram Types' },
    { value: 10, suffix: 's', label: 'Avg Generation' },
  ];

  return (
    <>
      {/* ─── Section 1: Hero ─────────────────────────────── */}
      <section className="w-full px-4 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16 max-w-3xl mx-auto text-center overflow-hidden">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 font-mono-custom text-[10px] sm:text-xs rounded-full px-3 sm:px-4 py-1.5 mb-6 sm:mb-8 border animate-fade-slide-up max-w-full"
          style={{
            color: 'var(--accent2)',
            borderColor: 'rgba(124,106,255,0.25)',
            background: 'var(--accent-glow)',
            letterSpacing: '0.5px',
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--accent)' }}
          />
          <span className="truncate">Idea → Full-Stack Blueprint in seconds</span>
        </div>

        {/* Headline */}
        <h1
          className="font-display font-extrabold tracking-tight mb-5 animate-fade-slide-up max-w-full text-lg sm:text-4xl md:text-5xl lg:text-6xl"
          style={{
            lineHeight: 1.15,
            letterSpacing: '-0.5px',
            color: 'var(--text)',
            animationDelay: '0.1s',
            animationFillMode: 'both',
          }}
        >
          Architect your next{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, var(--accent2), var(--green))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            big idea
          </span>
          <br />
          with AI.
        </h1>

        <p
          className="text-[11px] sm:text-sm md:text-base mb-8 sm:mb-12 mx-auto max-w-lg animate-fade-slide-up"
          style={{
            color: 'var(--text2)',
            lineHeight: 1.7,
            animationDelay: '0.2s',
            animationFillMode: 'both',
          }}
        >
          Describe your app in plain English. BuildX generates database schemas, API
          endpoints, UI screens, architecture diagrams, and a downloadable project scaffold.
        </p>

        {/* Input card */}
        <form
          onSubmit={handleSubmit}
          className="animate-fade-slide-up"
          style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
        >
          <div
            className="card p-4 sm:p-7 mb-5 transition-all duration-300 text-left"
            style={{
              boxShadow:
                idea.length > 0
                  ? '0 0 60px rgba(124,106,255,0.14)'
                  : '0 0 40px rgba(124,106,255,0.06)',
              borderColor:
                idea.length > 0
                  ? 'rgba(124,106,255,0.25)'
                  : 'var(--border2)',
            }}
          >
            <div
              className="font-mono-custom text-xs mb-3 uppercase tracking-widest"
              style={{ color: 'var(--text3)' }}
            >
              // describe your app idea
            </div>

            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. Build a food delivery app with restaurant listings, real-time order tracking, cart management, and Stripe payments..."
              rows={3}
              disabled={isLoading}
              className="w-full bg-transparent border-none outline-none resize-none text-base leading-relaxed disabled:opacity-50"
              style={{ color: 'var(--text)', caretColor: 'var(--accent)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
              }}
            />

            <div className="flex items-center justify-between mt-4 sm:mt-5 flex-wrap gap-2 sm:gap-3">
              <span className="font-mono-custom text-[11px] sm:text-xs" style={{ color: 'var(--text3)' }}>
                {idea.length} chars <span className="hidden sm:inline">· ⌘↵ to generate</span>
              </span>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* Model Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-all duration-150 group"
                    style={{
                      background: showModelDropdown ? 'var(--surface2)' : 'transparent',
                      borderColor: showModelDropdown ? 'var(--border2)' : 'var(--border)',
                    }}
                    onMouseEnter={(e) => {
                      if (!showModelDropdown) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!showModelDropdown) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                      style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }}
                    />
                    <span className="font-mono-custom text-[11px] sm:text-xs transition-colors" style={{ color: 'var(--text2)' }}>
                      <span className="sm:hidden">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.label.split(' ')[0] || 'Model'}</span>
                      <span className="hidden sm:inline">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.label || 'Model'}</span>
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showModelDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
                      <div
                        className="absolute bottom-full right-0 mb-2 w-[200px] sm:w-[220px] rounded-xl border z-50 overflow-hidden animate-fade-slide-up shadow-2xl"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border2)' }}
                      >
                        <div className="px-3 py-2 text-[10px] font-mono-custom tracking-wider uppercase" style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                          AI Model
                        </div>
                        <div className="p-1">
                          {AVAILABLE_MODELS.map((model) => {
                            const isGptLocked = model.id === 'gpt-oss-120b' && !user;
                            return (
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
                              title={isGptLocked ? 'Sign in to use GPT-OSS 120B' : undefined}
                            >
                              <span className="font-mono-custom text-xs flex items-center gap-1.5">
                                {model.label}
                                {isGptLocked && <span>🔒</span>}
                              </span>
                              {model.badge && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded border font-mono-custom whitespace-nowrap"
                                  style={{
                                    background: isGptLocked ? 'rgba(245,158,11,0.1)' : 'var(--accent-glow)',
                                    borderColor: isGptLocked ? 'rgba(245,158,11,0.3)' : 'var(--border2)',
                                    color: isGptLocked ? 'rgb(245,158,11)' : 'var(--accent2)'
                                  }}
                                >
                                  {isGptLocked ? 'Sign in required' : model.badge}
                                </span>
                              )}
                            </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                className="flex items-center gap-2 sm:gap-2.5 rounded-[10px] px-4 sm:px-6 py-2.5 sm:py-3 font-display font-semibold text-xs sm:text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--accent)',
                  boxShadow: canSubmit ? '0 0 24px var(--accent-glow)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (canSubmit) {
                    (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.target as HTMLButtonElement).style.boxShadow =
                      '0 4px 32px rgba(124,106,255,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.target as HTMLButtonElement).style.boxShadow = canSubmit
                    ? '0 0 24px var(--accent-glow)'
                    : 'none';
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="hidden sm:inline">Generate Blueprint</span>
                <span className="sm:hidden">Generate</span>
              </button>
              </div>
            </div>
          </div>
        </form>

        {/* Example chips */}
        <div
          className="font-mono-custom text-xs mb-3 animate-fade-slide-up"
          style={{
            color: 'var(--text3)',
            animationDelay: '0.4s',
            animationFillMode: 'both',
          }}
        >
          // quick examples
        </div>
        <div
          className="flex flex-nowrap sm:flex-wrap overflow-x-auto sm:justify-center gap-2 animate-fade-slide-up pb-2 sm:pb-0"
          style={{ animationDelay: '0.45s', animationFillMode: 'both', scrollbarWidth: 'none' }}
        >
          {EXAMPLE_IDEAS.map(({ label, idea: exampleIdea }) => (
            <button
              key={label}
              onClick={() => fillExample(exampleIdea)}
              disabled={isLoading}
              className="font-mono-custom text-xs px-3.5 py-1.5 rounded-full border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
              style={{
                color: 'var(--text2)',
                borderColor: 'var(--border2)',
                background: 'var(--surface)',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = 'var(--accent)';
                el.style.color = 'var(--accent2)';
                el.style.background = 'var(--accent-glow)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = 'var(--border2)';
                el.style.color = 'var(--text2)';
                el.style.background = 'var(--surface)';
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Section 2: Stats ────────────────────────────── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 max-w-4xl mx-auto overflow-hidden">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        >
          {STATS.map(({ value, suffix, label }) => (
            <div
              key={label}
              className="card p-3 sm:p-5 text-center hover:scale-[1.03] transition-transform duration-200"
            >
              <div
                className="font-display font-extrabold text-2xl sm:text-3xl mb-1"
                style={{
                  background: 'linear-gradient(135deg, var(--accent2), var(--green))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <AnimatedNumber target={value} suffix={suffix} />
              </div>
              <div
                className="font-mono-custom text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--text3)' }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Section 3: Features ─────────────────────────── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 max-w-4xl mx-auto overflow-hidden">
        <div className="text-center mb-12">
          <div
            className="font-mono-custom text-xs uppercase tracking-widest mb-3"
            style={{ color: 'var(--accent2)' }}
          >
            // capabilities
          </div>
          <h2
            className="font-display font-extrabold text-2xl sm:text-3xl mb-4"
            style={{ color: 'var(--text)', letterSpacing: '-1px' }}
          >
            Everything you need to ship faster
          </h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--text3)' }}>
            From concept to code — BuildX handles the architecture so you can focus on building.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feat, i) => (
            <FeatureCard key={feat.title} {...feat} delay={i * 80} />
          ))}
        </div>
      </section>

      {/* ─── Section 4: How it works ─────────────────────── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 max-w-3xl mx-auto overflow-hidden">
        <div className="text-center mb-12">
          <div
            className="font-mono-custom text-xs uppercase tracking-widest mb-3"
            style={{ color: 'var(--green)' }}
          >
            // workflow
          </div>
          <h2
            className="font-display font-extrabold text-2xl sm:text-3xl mb-4"
            style={{ color: 'var(--text)', letterSpacing: '-1px' }}
          >
            Three steps. Zero friction.
          </h2>
        </div>

        <div className="flex flex-col gap-6">
          {[
            {
              step: '01',
              title: 'Describe your idea',
              desc: 'Write what you want to build in plain English. No jargon needed.',
              color: 'var(--accent)',
            },
            {
              step: '02',
              title: 'AI architects everything',
              desc: 'Your chosen AI model generates schema, APIs, screens, and architecture in real-time.',
              color: 'var(--green)',
            },
            {
              step: '03',
              title: 'Download & start building',
              desc: 'Export the full project scaffold, refine through chat, or share with your team.',
              color: 'var(--blue)',
            },
          ].map(({ step, title, desc, color }) => (
            <div
              key={step}
              className="card p-4 sm:p-6 flex items-start gap-3 sm:gap-5 hover:scale-[1.01] transition-transform duration-200"
            >
              <div
                className="font-display font-extrabold text-lg sm:text-2xl flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: `${color}15`,
                  color,
                  border: `1px solid ${color}30`,
                }}
              >
                {step}
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>
                  {title}
                </h3>
                <p className="font-mono-custom text-xs" style={{ color: 'var(--text3)' }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Section 5: CTA ──────────────────────────────── */}
      <section className="px-4 sm:px-6 py-12 sm:py-20 max-w-3xl mx-auto text-center overflow-hidden">
        <div
          className="card p-8 sm:p-12"
          style={{
            background: 'linear-gradient(135deg, rgba(124,106,255,0.08), rgba(34,211,165,0.06))',
            borderColor: 'rgba(124,106,255,0.2)',
          }}
        >
          <h2
            className="font-display font-extrabold text-xl sm:text-2xl mb-3"
            style={{ color: 'var(--text)', letterSpacing: '-1px' }}
          >
            Ready to build something amazing?
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: 'var(--text3)' }}>
            Stop planning in spreadsheets. Let AI architect your next project.
          </p>
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              textareaRef.current?.focus();
            }}
            className="inline-flex items-center gap-2 sm:gap-2.5 rounded-[10px] px-6 sm:px-8 py-3 sm:py-3.5 font-display font-semibold text-xs sm:text-sm text-white transition-all duration-200"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 0 24px var(--accent-glow)',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.target as HTMLButtonElement).style.boxShadow =
                '0 4px 32px rgba(124,106,255,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.target as HTMLButtonElement).style.boxShadow = '0 0 24px var(--accent-glow)';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Start Building — It's Free
          </button>
        </div>
      </section>

      {/* Auth modal for GPT-OSS gate */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
