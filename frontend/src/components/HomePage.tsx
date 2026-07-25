import { Link, useNavigate } from 'react-router-dom';
import {
  Zap,
  GitMerge,
  FolderArchive,
  MessageSquare,
  Share2,
  Cpu,
  ArrowRight,
  PenLine,
  Sparkles,
  Download,
} from 'lucide-react';
import { AmbientBackground } from './AmbientBackground';
import { MarketingHeader } from './MarketingHeader';
import { PageHead } from './PageHead';
import { BlurText } from './BlurText';
import { BentoGrid } from './BentoGrid';
import { SpotlightCard } from './SpotlightCard';
import { useAuth } from '../hooks/useAuth';

const FEATURES = [
  {
    icon: Zap,
    title: 'Real-Time Streaming',
    description: 'Watch agents build your blueprint live — schema, APIs, and UI stream in as they work.',
    gradient: 'linear-gradient(135deg, rgba(82,39,255,0.35), rgba(124,255,103,0.12))',
  },
  {
    icon: GitMerge,
    title: 'Visual Diagrams',
    description: 'ER diagrams, architecture flowcharts, and API sequence views generated automatically.',
    gradient: 'linear-gradient(135deg, rgba(124,255,103,0.28), rgba(82,39,255,0.1))',
  },
  {
    icon: FolderArchive,
    title: 'Export Full Project',
    description: 'Download a monorepo with Prisma schema, Express routes, React pages, and Docker config.',
    gradient: 'linear-gradient(135deg, rgba(82,39,255,0.28), rgba(124,255,103,0.08))',
  },
  {
    icon: MessageSquare,
    title: 'AI Refinement',
    description: 'Iterate in chat — “add Stripe”, “use Next.js”, “add admin dashboard” — and persist changes.',
    gradient: 'linear-gradient(135deg, rgba(124,255,103,0.22), rgba(82,39,255,0.08))',
  },
  {
    icon: Share2,
    title: 'Blueprint Library',
    description: 'Every generation is saved to your workspace — rename, reopen, and continue anytime.',
    gradient: 'linear-gradient(135deg, rgba(82,39,255,0.22), rgba(124,255,103,0.06))',
  },
  {
    icon: Cpu,
    title: 'Multi-Agent Pipeline',
    description: 'PM, architect, API, UI, coder, and QA agents collaborate in one structured run.',
    gradient: 'linear-gradient(135deg, rgba(124,255,103,0.2), rgba(82,39,255,0.06))',
  },
];

const STATS = [
  { value: '7', suffix: '+', label: 'Blueprint sections' },
  { value: '20', suffix: '+', label: 'Files per export' },
  { value: '6', suffix: '', label: 'AI agents' },
  { value: '~30', suffix: 's', label: 'Typical generation' },
];

const STEPS = [
  {
    num: '01',
    icon: PenLine,
    title: 'Describe your idea',
    description: 'Type what you want to build in plain English — audience, features, or a one-liner.',
  },
  {
    num: '02',
    icon: Sparkles,
    title: 'Watch it architect',
    description: 'Agents design schema, endpoints, screens, diagrams, and starter code in real time.',
  },
  {
    num: '03',
    icon: Download,
    title: 'Ship the scaffold',
    description: 'Refine in chat, export a ZIP, and hand a production-shaped codebase to your team.',
  },
];

export function HomePage() {
  const { user, authReady } = useAuth();
  const navigate = useNavigate();

  function startBuilding() {
    if (user) {
      navigate('/create');
    } else {
      navigate('/login', { state: { from: '/create' } });
    }
  }

  return (
    <div className="landing-page min-h-screen flex flex-col relative overflow-x-hidden">
      <PageHead
        title="BuildX"
        description="Turn app ideas into full-stack blueprints with AI — schema, APIs, UI, diagrams, and exportable code."
      />
      <AmbientBackground />
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="landing-top">
          <MarketingHeader />

          <div className="landing-hero-stage">
            <div className="landing-hero-stage__inner">
              <section className="landing-hero" aria-labelledby="landing-headline">
                <div className="hero-aurora-glow pointer-events-none" aria-hidden />

                <div className="landing-eyebrow animate-fade-slide-up">
              <span className="landing-eyebrow__dot" aria-hidden />
              <span className="landing-eyebrow__text">
                Idea → Full-Stack Blueprint in seconds
              </span>
            </div>

            <h1 id="landing-headline" className="hero-headline font-display font-extrabold mb-5">
              <span className="hero-headline__line">
                <BlurText text="Architect your next" delay={50} stagger={25} />
              </span>
              <span className="hero-headline__line hero-headline__line--accent">
                <BlurText
                  text="big idea"
                  delay={400}
                  stagger={25}
                  gradientColors={['#7cff67', '#c4b5fd', '#5227FF', '#7cff67']}
                />
              </span>
              <span className="hero-headline__line">
                <BlurText text="with AI." delay={650} stagger={25} />
              </span>
            </h1>

            <p className="landing-subhead animate-fade-slide-up">
              Describe your product in plain English. BuildX generates database schemas, API
              routes, UI screens, Mermaid diagrams, and a downloadable monorepo — ready for your
              team to implement.
            </p>

                <div className="landing-actions animate-fade-slide-up">
                  <button
                    type="button"
                    onClick={startBuilding}
                    className="landing-btn landing-btn--primary"
                  >
                    Start building free
                    <ArrowRight size={18} className="landing-btn__icon" aria-hidden />
                  </button>
                  {!user && authReady && (
                    <Link
                      to="/login"
                      state={{ from: '/create' }}
                      className="landing-btn landing-btn--secondary"
                    >
                      Sign in
                    </Link>
                  )}
                  {user && authReady && (
                    <button
                      type="button"
                      onClick={() => navigate('/create')}
                      className="landing-btn landing-btn--secondary"
                    >
                      Open workspace
                    </button>
                  )}
                </div>

                <p className="landing-trust">Free to start · Powered by Groq · Export-ready code</p>
              </section>

              <div className="landing-stats" aria-label="Product highlights">
                {STATS.map((stat) => (
                  <div key={stat.label} className="landing-stat">
                    <span className="landing-stat__value">
                      {stat.value}
                      <span>{stat.suffix}</span>
                    </span>
                    <span className="landing-stat__label">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <main id="main-content" className="flex-1" tabIndex={-1}>
          <section id="features" className="landing-section" aria-labelledby="features-title">
            <BentoGrid />
          </section>

          <section className="landing-section" aria-labelledby="how-title">
            <div className="landing-section__head">
              <p className="landing-section__eyebrow">How it works</p>
              <h2 id="how-title" className="landing-section__title">
                Three steps to a buildable plan
              </h2>
            </div>
            <div className="landing-steps">
              {STEPS.map((step) => (
                <div key={step.num} className="landing-step">
                  <span className="landing-step__num">{step.num}</span>
                  <step.icon
                    size={20}
                    className="mx-auto mb-3"
                    style={{ color: 'var(--accent3)' }}
                    aria-hidden
                  />
                  <h3 className="landing-step__title">{step.title}</h3>
                  <p className="landing-step__desc">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-cta-band">
              <h2 className="landing-cta-band__title">Ready to architect your next app?</h2>
              <p className="landing-cta-band__desc">
                Create an account, describe your idea, and get a full-stack blueprint in under a
                minute.
              </p>
              <button type="button" onClick={startBuilding} className="landing-btn landing-btn--primary">
                Get started
                <ArrowRight size={18} className="landing-btn__icon" aria-hidden />
              </button>
            </div>
          </section>
        </main>

        <footer className="app-footer">
          <p>BuildX — Idea to deployable blueprint in one flow</p>
          <p className="app-footer__sub">Powered by Groq · PostgreSQL · React</p>
        </footer>
      </div>
    </div>
  );
}
