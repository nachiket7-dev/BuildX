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
    <div className="min-h-screen bg-[#08080c] text-white relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 selection:bg-purple-500 selection:text-white">
      <PageHead
        title={tab === 'login' ? 'Sign in — BuildX' : 'Create account — BuildX'}
        description="Sign in to BuildX to generate and manage AI product blueprints."
      />
      <AmbientBackground />

      {/* ── Ambient Mesh Lighting (Emerald + Electric Purple Glows) ───── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 blur-[160px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/15 blur-[150px] pointer-events-none rounded-full" />

      {/* ── Left Column (5 Cols): Brand & Showcase ─────────────────────── */}
      <aside className="hidden lg:flex lg:col-span-5 flex-col justify-between p-12 bg-[#08080c]/60 backdrop-blur-md relative z-10 border-r border-white/10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-block focus-visible:outline-none">
            <Logo size="lg" />
          </Link>
          <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400/90 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            00 / AUTHENTICATION
          </span>
        </div>

        <div className="my-auto py-8">
          <h1 className="font-display font-extrabold text-3xl xl:text-4xl text-white leading-tight tracking-tight mb-3">
            Turn ideas into <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-emerald-300 font-normal italic">full-stack</span> blueprints
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-md mb-8 font-sans">
            Join BuildX to generate schemas, APIs, UI specs, diagrams, and downloadable code — all from a single prompt.
          </p>

          <div className="space-y-3">
            {PERKS.map((perk, index) => {
              const num = String(index + 1).padStart(2, '0');
              return (
                <div key={perk.title} className="bg-zinc-900/60 border border-white/10 rounded-xl p-4 flex gap-4 items-start backdrop-blur-md">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <perk.icon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[10px] text-zinc-500">{num} /</span>
                      <span className="font-mono text-xs font-semibold text-zinc-200">{perk.title}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">{perk.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400/90 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            00 / SECURE JWT AUTH · GROQ &amp; GEMINI
          </span>
        </div>
      </aside>

      {/* ── Right Column (7 Cols): Auth Form Card Area ──────────────────── */}
      <main className="col-span-12 lg:col-span-7 bg-[#121216]/80 backdrop-blur-xl border-l border-white/10 flex flex-col justify-between p-8 sm:p-12 md:p-16 relative z-10 min-h-screen lg:min-h-0">
        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-8">
          <div className="lg:hidden">
            <Link to="/" className="inline-block">
              <Logo size="md" />
            </Link>
          </div>
          <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400/90 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full hidden sm:inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            01 / ACCESS WORKSPACE
          </span>
          <Link
            to="/"
            className="bg-zinc-900/90 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all ml-auto"
          >
            <ArrowLeft size={13} />
            Back to home
          </Link>
        </div>

        {/* Center Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full mx-auto my-auto"
        >
          <div className="mb-6">
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white mb-2 tracking-tight">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
              {tab === 'login'
                ? 'Sign in to access your blueprint workspace and continue building.'
                : 'Get started free — your first blueprint is only a prompt away.'}
            </p>
          </div>

          {/* Gliding Tab Pill Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-950/80 border border-white/10 mb-6 relative font-mono text-xs" role="tablist">
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
                      className="absolute inset-0 rounded-lg bg-indigo-600/30 border border-indigo-500/40 shadow-sm"
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
                      className="w-full bg-zinc-950/80 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
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
                className="w-full bg-zinc-950/80 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
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
                  className="w-full bg-zinc-950/80 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none transition-all font-mono"
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

            {/* Signature Electric Indigo Primary CTA Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading || !authReady}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 border border-indigo-400/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Secondary GitHub OAuth Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={handleGithubOAuth}
            className="w-full bg-zinc-900/90 border border-white/10 hover:border-white/25 text-white rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2.5"
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
