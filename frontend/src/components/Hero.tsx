import React, { useState, useRef, useEffect } from 'react';
import { EXAMPLE_IDEAS } from '../lib/utils';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';
import { SpotlightCard } from './SpotlightCard';
import { DecryptedText } from './DecryptedText';
import { BlurText } from './BlurText';
import { Zap, GitMerge, FolderArchive, MessageSquare, Share2, Cpu } from 'lucide-react';

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

// ─── Scroll Reveal Wrapper ─────────────────────────────────
function ScrollReveal({
  children,
  className = '',
  as: Component = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      className={`reveal ${visible ? 'visible' : ''} ${className}`}
    >
      {children}
    </Component>
  );
}

// ─── Feature card ─────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
  delay,
}: {
  icon: React.ComponentType<any>;
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
    <SpotlightCard
      ref={ref}
      className="p-6 group flex flex-col justify-start"
      spotlightColor="rgba(20, 184, 166, 0.15)"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transitionDelay: `${delay}ms`,
        transitionProperty: 'opacity, transform, border-color, box-shadow',
        transitionDuration: '500ms',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ background: gradient }}
      >
        <Icon size={18} className="text-white" />
      </div>
      <h3 className="font-display font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>
        {title}
      </h3>
      <p className="font-mono-custom text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
        {description}
      </p>
    </SpotlightCard>
  );
}

// ─── Main component ───────────────────────────────────────
export function Hero({ onGenerate, isLoading }: HeroProps) {
  const [idea, setIdea] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { selectedModel, setSelectedModel } = useModel();
  const [showModelDropdown, setShowModelDropdown] = useState(false);

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
  const charProgress = Math.min(100, (charCount / MIN_CHARS) * 100);
  const canSubmit = charCount >= MIN_CHARS && !isLoading;

  const FEATURES = [
    {
      icon: Zap,
      title: 'Real-Time Streaming',
      description:
        'Watch your blueprint build in real-time via Server-Sent Events. No fake loading screens.',
      gradient: 'linear-gradient(135deg, rgba(20,184,166,0.28), rgba(20,184,166,0.06))',
    },
    {
      icon: GitMerge,
      title: 'Visual Diagrams',
      description:
        'Auto-generated ER diagrams, architecture flowcharts, and API sequence diagrams with Mermaid.',
      gradient: 'linear-gradient(135deg, rgba(94,234,212,0.25), rgba(94,234,212,0.05))',
    },
    {
      icon: FolderArchive,
      title: 'Download Full Project',
      description:
        'Export a production-ready monorepo: Prisma schema, Express routes, React pages, Docker.',
      gradient: 'linear-gradient(135deg, rgba(15,118,110,0.28), rgba(15,118,110,0.06))',
    },
    {
      icon: MessageSquare,
      title: 'AI Refinement Chat',
      description:
        '"Add Stripe payments" — refine your blueprint through natural language conversation.',
      gradient: 'linear-gradient(135deg, rgba(20,184,166,0.22), rgba(20,184,166,0.04))',
    },
    {
      icon: Share2,
      title: 'Shareable Links',
      description:
        'Every blueprint gets a unique URL. Share with your team or embed in your portfolio.',
      gradient: 'linear-gradient(135deg, rgba(94,234,212,0.22), rgba(94,234,212,0.04))',
    },
    {
      icon: Cpu,
      title: 'Smart Architecture',
      description:
        'AI picks the right tech stack, designs the schema with foreign keys, maps all API endpoints.',
      gradient: 'linear-gradient(135deg, rgba(15,118,110,0.22), rgba(15,118,110,0.04))',
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
      <section className="relative w-full px-4 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16 max-w-3xl mx-auto text-center overflow-hidden">
        {/* Local aurora glow behind hero content */}
        <div className="hero-aurora-glow pointer-events-none" aria-hidden />

        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 font-mono-custom text-[10px] sm:text-xs rounded-full px-3 sm:px-4 py-1.5 mb-6 sm:mb-8 border animate-fade-slide-up max-w-full"
          style={{
            color: 'var(--accent2)',
            borderColor: 'rgba(20,184,166,0.25)',
            background: 'var(--accent-glow)',
            letterSpacing: '0.5px',
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--accent)' }}
          />
          <span className="truncate">
            <DecryptedText text="Idea → Full-Stack Blueprint in seconds" delay={300} speed={25} />
          </span>
        </div>

        {/* Headline — three balanced lines; gradient applied per-letter (not nested clip) */}
        <h1 className="hero-headline font-display font-extrabold mb-5 max-w-full">
          <span className="hero-headline__line">
            <BlurText text="Architect your next" delay={50} stagger={25} />
          </span>
          <span className="hero-headline__line hero-headline__line--accent">
            <BlurText
              text="big idea"
              delay={450}
              stagger={25}
              gradientColors={['#5eead4', '#2dd4bf', '#14b8a6', '#0f766e', '#14b8a6']}
            />
          </span>
          <span className="hero-headline__line">
            <BlurText text="with AI." delay={700} stagger={25} />
          </span>
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
          className="animate-fade-slide-up relative"
          style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
        >
          {/* Spotlight background glow behind input */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] pointer-events-none opacity-20 transition-opacity duration-500 blur-[80px]"
            style={{
              background: isFocused
                ? 'radial-gradient(circle, var(--accent-hex) 0%, var(--accent-deep) 35%, transparent 70%)'
                : 'radial-gradient(circle, rgba(20, 184, 166, 0.4) 0%, transparent 60%)',
              zIndex: -1,
            }}
          />
          <div
            className={`card border-beam-wrapper ${isFocused || idea.length > 0 ? 'border-beam-active' : ''} p-4 sm:p-7 mb-5 transition-all duration-300 text-left`}
            style={{
              boxShadow:
                idea.length > 0
                  ? '0 0 60px rgba(20,184,166,0.14)'
                  : '0 0 40px rgba(20,184,166,0.06)',
              borderColor:
                idea.length > 0
                  ? 'rgba(20,184,166,0.25)'
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
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="e.g. Build a food delivery app with restaurant listings, real-time order tracking, cart management, and Stripe payments..."
              rows={3}
              disabled={isLoading}
              className="w-full bg-transparent border-none outline-none resize-none text-base leading-relaxed disabled:opacity-50"
              style={{ color: 'var(--text)', caretColor: 'var(--accent)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
              }}
            />

            <div className="flex flex-col gap-3 mt-4 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0 order-2 sm:order-1">
                <div className="char-meter" aria-hidden>
                  <div
                    className="char-meter__fill"
                    style={{
                      width: `${charProgress}%`,
                      background:
                        charCount >= MIN_CHARS
                          ? 'linear-gradient(90deg, var(--accent-hex), var(--green))'
                          : 'var(--accent-hex)',
                    }}
                  />
                </div>
                <span className="font-mono-custom text-[11px] sm:text-xs" style={{ color: charCount >= MIN_CHARS ? 'var(--green)' : 'var(--text3)' }}>
                  {charCount}/{MIN_CHARS}
                  <span className="hidden sm:inline"> · ⌘↵ generate</span>
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
                {/* Model Selector */}
                <div className="relative flex-1 sm:flex-none min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className={`model-select-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${showModelDropdown ? 'model-select-btn--open' : ''}`}
                    aria-expanded={showModelDropdown}
                    aria-haspopup="listbox"
                  >
                    <span className="model-select-btn__dot" aria-hidden />
                    <span className="truncate">
                      <span className="sm:hidden">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.label.split(' ')[0] || 'Model'}</span>
                      <span className="hidden sm:inline">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.label || 'Model'}</span>
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="model-select-btn__chevron"
                      aria-hidden
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showModelDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
                      <div
                        className="model-select-menu animate-fade-slide-up"
                        role="listbox"
                        aria-label="AI Model"
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
                              <span className="font-mono-custom text-xs flex items-center gap-1.5">
                                {model.label}
                              </span>
                              {model.badge && (
                                <span className="model-select-option__badge">
                                  {model.badge}
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
                aria-busy={isLoading}
                className="btn-shiny flex flex-1 sm:flex-none items-center justify-center gap-2 sm:gap-2.5 rounded-[10px] px-4 sm:px-6 py-2.5 sm:py-3 font-display font-semibold text-xs sm:text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                style={{
                  background: 'var(--accent)',
                  boxShadow: canSubmit ? '0 0 24px var(--accent-glow)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (canSubmit) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      '0 4px 32px rgba(82, 39, 255, 0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = canSubmit
                    ? '0 0 24px var(--accent-glow)'
                    : 'none';
                }}
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                    <span>Building…</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} className="fill-white text-white" />
                    <span className="hidden sm:inline">Generate Blueprint</span>
                    <span className="sm:hidden">Generate</span>
                  </>
                )}
              </button>
              </div>
            </div>
          </div>
        </form>

        {/* Example chips */}
        <p className="example-chips-label animate-fade-slide-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
          // quick examples
        </p>
        <div
          className="example-chips animate-fade-slide-up"
          style={{ animationDelay: '0.45s', animationFillMode: 'both' }}
        >
          {EXAMPLE_IDEAS.map(({ label, idea: exampleIdea }) => (
            <button
              key={label}
              type="button"
              onClick={() => fillExample(exampleIdea)}
              disabled={isLoading}
              className="example-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Section 2: Stats ────────────────────────────── */}
      <ScrollReveal className="px-4 sm:px-6 py-12 sm:py-16 max-w-4xl mx-auto overflow-hidden">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        >
          {STATS.map(({ value, suffix, label }, i) => (
            <div
              key={label}
              className="card p-3 sm:p-5 text-center hover:scale-[1.03] transition-transform duration-200 animate-float"
              style={{
                animationDelay: `${i * 0.4}s`,
                animationDuration: '6s'
              }}
            >
              <div
                className="font-display font-extrabold text-2xl sm:text-3xl mb-1"
                style={{
                  background: 'linear-gradient(135deg, var(--accent2), var(--accent-hex))',
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
      </ScrollReveal>

      {/* ─── Section 3: Features ─────────────────────────── */}
      <ScrollReveal className="px-4 sm:px-6 py-12 sm:py-16 max-w-4xl mx-auto overflow-hidden">
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
      </ScrollReveal>

      {/* ─── Section 4: How it works ─────────────────────── */}
      <ScrollReveal className="px-4 sm:px-6 py-12 sm:py-16 max-w-3xl mx-auto overflow-hidden">
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
              color: 'var(--accent)',
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
      </ScrollReveal>

      {/* ─── Section 5: CTA ──────────────────────────────── */}
      <ScrollReveal className="px-4 sm:px-6 py-12 sm:py-20 max-w-3xl mx-auto text-center overflow-hidden">
        <div
          className="p-[1.5px] rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(20,184,166,0.45), rgba(15,118,110,0.25) 50%, rgba(94,234,212,0.35))',
            boxShadow: '0 12px 40px rgba(20,184,166,0.08)'
          }}
        >
          <div
            className="p-8 sm:p-12 rounded-[15px]"
            style={{
              background: 'linear-gradient(135deg, rgba(10,10,18,0.9), rgba(15,15,25,0.85))',
              backdropFilter: 'blur(20px)',
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
            className="btn-shiny inline-flex items-center gap-2 sm:gap-2.5 rounded-[10px] px-6 sm:px-8 py-3 sm:py-3.5 font-display font-semibold text-xs sm:text-sm text-white"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 0 24px var(--accent-glow)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 4px 32px rgba(20,184,166,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px var(--accent-glow)';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Start Building — It's Free
          </button>
        </div>
      </div>
    </ScrollReveal>

    </>
  );
}
