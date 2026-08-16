import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Zap, FolderArchive, MessageSquare, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { generateOAuthState } from '../lib/utils';
import { AmbientBackground } from './AmbientBackground';
import { Logo } from './Logo';
import { PageHead } from './PageHead';
import { motion, AnimatePresence } from 'framer-motion';

type AuthTab = 'login' | 'signup';

const PERKS = [
  {
    icon: Zap,
    title: 'Agentic generation',
    description: 'PM, architect, API, UI, and code agents build your blueprint in one run.',
  },
  {
    icon: FolderArchive,
    title: 'Export-ready scaffold',
    description: 'Download a full monorepo with schema, routes, and React pages.',
  },
  {
    icon: MessageSquare,
    title: 'Refine & save',
    description: 'Iterate in chat and keep every version in your workspace.',
  },
];

function GithubIcon() {
  return (
    <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function LoginPage() {
  const [tab, setTab] = useState<AuthTab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { user, authReady, login, signup, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: string } | null)?.from?.startsWith('/login')
      ? '/create'
      : (location.state as { from?: string } | null)?.from || '/create';

  if (authReady && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      navigate(from, { replace: true });
    } catch {
      // Error surfaced via useAuth
    }
  }

  function switchTab(newTab: AuthTab) {
    setTab(newTab);
    clearError();
  }

  function handleGithubOAuth() {
    sessionStorage.setItem('buildx_auth_redirect', from);
    sessionStorage.removeItem('buildx_github_link');
    const state = generateOAuthState();
    sessionStorage.setItem('buildx_github_oauth_state', state);
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(window.location.origin + '/login/callback');
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email,repo&redirect_uri=${redirectUri}&state=${state}`;
  }

  return (
    <div className="min-h-screen bg-obsidian-bg text-white relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 selection:bg-sylven selection:text-black font-sans">
      <PageHead
        title={tab === 'login' ? 'Sign in — BuildX' : 'Create account — BuildX'}
        description="Sign in to BuildX to generate and manage AI product blueprints."
      />
      <AmbientBackground />

      {/* Ambient Mesh Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-sylven/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[160px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sylven/10 blur-[150px] pointer-events-none rounded-full" />

      {/* Left Column (5 Cols): Brand & Showcase */}
      <aside className="hidden lg:flex lg:col-span-5 flex-col justify-between p-12 bg-obsidian-surface/70 backdrop-blur-md relative z-10 border-r border-obsidian-border">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-block focus-visible:outline-none">
            <Logo size="lg" />
          </Link>
          <span className="inline-flex items-center gap-2 font-mono text-xs text-sylven-light border border-sylven/20 bg-sylven-glow px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-sylven animate-pulse" />
            00 / AUTHENTICATION
          </span>
        </div>

        <div className="my-auto py-8">
          <h1 className="font-display font-extrabold text-3xl xl:text-4xl text-white leading-tight tracking-tight mb-3">
            Turn ideas into <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-sylven-light font-normal italic">full-stack</span> blueprints
          </h1>
          <p className="text-sm text-norvin-muted leading-relaxed max-w-md mb-8 font-sans">
            AI-driven monorepo scaffolding with production PostgreSQL schemas, Express API endpoints, Sandpack previews, and GitHub export.
          </p>

          <div className="space-y-4">
            {PERKS.map((perk, i) => {
              const Icon = perk.icon;
              return (
                <div key={perk.title} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-obsidian-panel border border-obsidian-border">
                  <div className="w-8 h-8 rounded-xl bg-sylven/15 border border-sylven/25 flex items-center justify-center shrink-0 text-sylven-light">
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white font-mono flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">0{i + 1} /</span>
                      {perk.title}
                    </div>
                    <div className="text-xs text-norvin-muted mt-0.5 leading-relaxed font-sans">
                      {perk.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs font-mono text-zinc-500 flex items-center justify-between">
          <span>PLATFORM V2.4</span>
          <span>AUTONOMOUS WORKSPACE</span>
        </div>
      </aside>

      {/* Right Column (7 Cols): Form & Auth Card */}
      <main className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-12 relative z-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-sylven/40 text-xs font-mono text-norvin-muted hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft size={13} />
            <span>Back to home</span>
          </Link>
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md mx-auto my-auto py-8"
        >
          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
              {tab === 'login' ? 'Sign in to BuildX' : 'Create your account'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
              {tab === 'login'
                ? 'Access your saved blueprints, agent workflows, and active workspaces'
                : 'Start generating full-stack software blueprints in seconds'}
            </p>
          </div>

          {/* Tab Slider */}
          <div className="flex items-center p-1 rounded-xl bg-obsidian-surface border border-obsidian-border mb-6 relative font-mono text-xs" role="tablist">
            {(['login', 'signup'] as AuthTab[]).map((t, idx) => {
              const num = String(idx + 1).padStart(2, '0');
              const label = t === 'login' ? 'Sign in' : 'Sign up';
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchTab(t)}
                  className={`relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10 flex items-center justify-center gap-1.5 ${
                    isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="authTabIndicator"
                      className="absolute inset-0 rounded-lg bg-sylven/20 border border-sylven/40 shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500">{num}</span>
                    <span>{label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 px-4 py-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs font-mono text-red-400"
                role="alert"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence>
              {tab === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <label htmlFor="auth-name" className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      01 / FULL NAME
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Chen"
                      required
                      minLength={2}
                      autoComplete="name"
                      className="w-full bg-obsidian-panel border border-obsidian-border focus:border-sylven focus:ring-1 focus:ring-sylven/30 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {tab === 'signup' ? '02 / EMAIL ADDRESS' : '01 / EMAIL ADDRESS'}
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="w-full bg-obsidian-panel border border-obsidian-border focus:border-sylven focus:ring-1 focus:ring-sylven/30 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="auth-password" className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {tab === 'signup' ? '03 / PASSWORD' : '02 / PASSWORD'}
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-obsidian-panel border border-obsidian-border focus:border-sylven focus:ring-1 focus:ring-sylven/30 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Primary CTA Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading || !authReady}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/25 border border-emerald-400/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-40 disabled:cursor-not-allowed font-mono"
            >
              {isLoading ? (
                <span className="font-mono text-xs">Please wait…</span>
              ) : (
                <>
                  <span>{tab === 'login' ? 'Sign in' : 'Create account'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3 font-mono">
            <span className="h-px flex-1 bg-obsidian-borderSubtle" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">or</span>
            <span className="h-px flex-1 bg-obsidian-borderSubtle" />
          </div>

          {/* Secondary GitHub OAuth Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={handleGithubOAuth}
            className="w-full bg-obsidian-panel border border-obsidian-border hover:border-sylven/40 text-white rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2.5 font-mono shadow-sm"
          >
            <GithubIcon />
            <span>Continue with GitHub</span>
          </motion.button>
        </motion.div>

        {/* Footer info */}
        <div className="pt-6 border-t border-white/5 flex items-center justify-between text-xs font-mono text-zinc-500">
          <span>BUILDX V2.4</span>
          <span>SECURE WORKSPACE ACCESS</span>
        </div>
      </main>
    </div>
  );
}
