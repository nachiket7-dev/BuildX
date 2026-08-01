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
  Terminal,
  Code2,
  Database,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { AmbientBackground } from './AmbientBackground';
import { MarketingHeader } from './MarketingHeader';
import { PageHead } from './PageHead';
import { BentoGrid } from './BentoGrid';
import { SpotlightCard } from './SpotlightCard';
import { GridBeams } from './GridBeams';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

const STEPS = [
  {
    num: '01',
    icon: PenLine,
    title: 'Describe your app idea',
    description: 'Type your concept in plain English — audience, features, database preferences, or a simple one-liner.',
  },
  {
    num: '02',
    icon: Sparkles,
    title: 'Multi-Agent Pipeline Architects',
    description: 'AI PM, DB Architect, API Engineer, and UI Designer generate full-stack specifications in real time.',
  },
  {
    num: '03',
    icon: Download,
    title: 'Export Production Monorepo',
    description: 'Refine in chat, export a self-contained ZIP or push directly to your GitHub repository.',
  },
];

const STATS = [
  { value: '7+', label: 'Blueprint Sections' },
  { value: '20+', label: 'Scaffold Files' },
  { value: '6', label: 'Collaborative Agents' },
  { value: '< 30s', label: 'Average Generation' },
];

export function HomePage() {
  const { user, authReady } = useAuth();
  const navigate = useNavigate();
  const [heroTab, setHeroTab] = useState<'schema' | 'api' | 'ui'>('schema');

  function startBuilding() {
    if (user) {
      navigate('/create');
    } else {
      navigate('/login', { state: { from: '/create' } });
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-[#000000] text-white overflow-x-hidden">
      <PageHead
        title="BuildX — AI Full-Stack App Architect"
        description="Turn app ideas into full-stack blueprints with AI — schema, APIs, UI, diagrams, and exportable code."
      />
      <GridBeams />
      <AmbientBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <MarketingHeader />

        {/* ─── Hero Section ───────────────────────────────────── */}
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 text-center">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300 mb-8 animate-fade-slide-up">
            <Sparkles size={13} className="text-indigo-400" />
            <span>Idea to Production-Ready Blueprint in Seconds</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight font-display max-w-4xl mx-auto leading-[1.1] mb-6">
            Architect full-stack apps <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
              with multi-agent AI.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Describe your product vision. BuildX automatically generates PostgreSQL DDL schemas, Express/Next.js REST endpoints, React UI specs, Mermaid ER diagrams, and a downloadable monorepo.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 flex-wrap mb-16">
            <button
              onClick={startBuilding}
              className="landing-btn landing-btn--primary"
            >
              <span>Start Building — It's Free</span>
              <ArrowRight size={16} className="landing-btn__icon" />
            </button>
            {!user && authReady && (
              <Link
                to="/login"
                state={{ from: '/create' }}
                className="landing-btn landing-btn--secondary"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Live Studio Mockup Window inside Hero */}
          <div className="max-w-4xl mx-auto text-left">
            <SpotlightCard className="p-5 rounded-2xl border border-white/10" spotlightColor="rgba(99, 102, 241, 0.2)">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-indigo-400" />
                  <span className="text-xs font-mono font-semibold text-white">Live Blueprint Output Preview</span>
                </div>
                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10 text-xs">
                  {(['schema', 'api', 'ui'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setHeroTab(tab)}
                      className={`px-3 py-1 rounded font-mono text-[11px] transition-colors ${
                        heroTab === tab ? 'bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {tab === 'schema' ? 'PostgreSQL DDL' : tab === 'api' ? 'REST Endpoints' : 'React Wireframes'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#090810] rounded-xl p-4 border border-white/10 font-mono text-xs text-neutral-300 space-y-3 min-h-[220px]">
                {heroTab === 'schema' && (
                  <div className="space-y-2">
                    <div className="text-emerald-400">// Database Schema — Generated DDL</div>
                    <code>
                      CREATE TABLE users (<br />
                      &nbsp;&nbsp;id UUID PRIMARY KEY DEFAULT gen_random_uuid(),<br />
                      &nbsp;&nbsp;email TEXT UNIQUE NOT NULL,<br />
                      &nbsp;&nbsp;created_at TIMESTAMPTZ DEFAULT NOW()<br />
                      );<br /><br />
                      CREATE TABLE workspace_blueprints (<br />
                      &nbsp;&nbsp;id UUID PRIMARY KEY DEFAULT gen_random_uuid(),<br />
                      &nbsp;&nbsp;user_id UUID REFERENCES users(id),<br />
                      &nbsp;&nbsp;app_name TEXT NOT NULL,<br />
                      &nbsp;&nbsp;schema_json JSONB NOT NULL<br />
                      );
                    </code>
                  </div>
                )}

                {heroTab === 'api' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                      <span className="px-1.5 py-0.5 bg-emerald-500 text-black font-bold rounded">GET</span>
                      <span className="text-emerald-300 font-mono">/api/v1/blueprints</span>
                      <span className="text-neutral-400">200 OK</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px]">
                      <span className="px-1.5 py-0.5 bg-indigo-500 text-white font-bold rounded">POST</span>
                      <span className="text-indigo-300 font-mono">/api/v1/blueprint/generate</span>
                      <span className="text-neutral-400">201 Created</span>
                    </div>
                    <div className="p-3 bg-black/80 rounded-lg border border-white/5 text-neutral-400 text-[11px]">
                      <code>&#123; "status": "success", "monorepoFiles": 24 &#125;</code>
                    </div>
                  </div>
                )}

                {heroTab === 'ui' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-white/[0.04] rounded-lg border border-white/10 flex items-center justify-between text-neutral-300">
                      <span>Screen Spec: Dashboard View</span>
                      <span className="text-emerald-400 text-[10px]">Desktop & Mobile</span>
                    </div>
                    <p className="text-neutral-400 text-xs leading-relaxed">
                      Generated components: HeaderNav, AnalyticsCard, BlueprintListGrid, ProjectExporterModal.
                    </p>
                  </div>
                )}
              </div>
            </SpotlightCard>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-16 pt-8 border-t border-white/10">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center p-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-white">{stat.value}</div>
                <div className="text-xs text-neutral-400 font-mono mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Bento Grid Showcase Section ──────────────────── */}
        <section id="features" className="w-full">
          <BentoGrid />
        </section>

        {/* ─── How It Works Section ─────────────────────────── */}
        <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="max-w-2xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300">
              <span>Simple Workflow</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
              Three steps from prompt to codebase
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <SpotlightCard key={step.num} className="p-6 text-left" spotlightColor="rgba(99, 102, 241, 0.15)">
                <div className="text-xs font-mono text-indigo-400 mb-3">{step.num}</div>
                <step.icon size={22} className="text-white mb-4" />
                <h3 className="text-base font-bold text-white mb-2 font-display">{step.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{step.description}</p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        {/* ─── CTA Section ──────────────────────────────────── */}
        <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="rounded-3xl border border-white/10 bg-neutral-950/80 p-8 sm:p-14 backdrop-blur-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-display mb-3">
              Ready to build your next product?
            </h2>
            <p className="text-sm text-neutral-400 max-w-md mx-auto mb-8 leading-relaxed">
              Stop planning in spreadsheets. Let BuildX architect your database, endpoints, and frontend in seconds.
            </p>
            <button
              onClick={startBuilding}
              className="landing-btn landing-btn--primary"
            >
              <span>Start Building — It's Free</span>
              <ArrowRight size={16} className="landing-btn__icon" />
            </button>
          </div>
        </section>

        {/* ─── Footer ───────────────────────────────────────── */}
        <footer className="w-full border-t border-white/10 py-8 px-4 text-center text-xs text-neutral-500 font-mono">
          <p>BuildX — Idea to production-ready monorepo</p>
        </footer>
      </div>
    </div>
  );
}
