import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Zap, FolderArchive, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { generateOAuthState } from '../lib/utils';
import { AmbientBackground } from './AmbientBackground';
import { Logo } from './Logo';
import { PageHead } from './PageHead';

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

  return (
    <div className="auth-page relative overflow-hidden">
      <PageHead
        title={tab === 'login' ? 'Sign in' : 'Create account'}
        description="Sign in to BuildX to generate and manage AI product blueprints."
      />
      <AmbientBackground />

      <div className="auth-page__layout relative z-10">
        <aside className="auth-page__brand" aria-label="About BuildX">
          <div className="auth-page__brand-glow" aria-hidden />
          <div className="auth-page__brand-inner">
            <div>
              <Link to="/" className="inline-block mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg">
                <Logo size="lg" />
              </Link>
              <h2>
                Turn ideas into <em>full-stack</em> blueprints
              </h2>
              <p className="auth-page__brand-lead mt-4">
                Join BuildX to generate schemas, APIs, UI specs, diagrams, and downloadable code —
                all from a single prompt.
              </p>
            </div>

            <ul className="auth-page__perks">
              {PERKS.map((perk) => (
                <li key={perk.title} className="auth-page__perk">
                  <span className="auth-page__perk-icon" aria-hidden>
                    <perk.icon size={18} />
                  </span>
                  <div>
                    <strong>{perk.title}</strong>
                    <span>{perk.description}</span>
                  </div>
                </li>
              ))}
            </ul>

            <p className="auth-page__brand-footer">Powered by Groq · Secure JWT auth</p>
          </div>
        </aside>

        <main className="auth-page__panel">
          <header className="auth-page__panel-header">
            <div className="lg:hidden">
              <Link to="/" className="auth-page__back-link auth-page__back-link--compact">
                <ArrowLeft size={14} aria-hidden />
                Home
              </Link>
            </div>
            <div className="hidden lg:block" />
            <Link to="/" className="lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg">
              <Logo size="md" />
            </Link>
          </header>

          <div className="auth-page__panel-body animate-fade-slide-up">
            <div className="hidden lg:block mb-8">
              <Link to="/" className="auth-page__back-link">
                <ArrowLeft size={16} aria-hidden />
                Back to home
              </Link>
            </div>

            <h1 className="auth-page__title">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="auth-page__subtitle">
              {tab === 'login'
                ? 'Sign in to access your blueprint workspace and continue building.'
                : 'Get started free — your first blueprint is only a prompt away.'}
            </p>

            <ul className="auth-page__perks auth-page__perks--mobile lg:hidden mb-6">
              {PERKS.map((perk) => (
                <li key={perk.title} className="auth-page__perk">
                  <span className="auth-page__perk-icon" aria-hidden>
                    <perk.icon size={16} />
                  </span>
                  <div>
                    <strong>{perk.title}</strong>
                  </div>
                </li>
              ))}
            </ul>

            <div className="auth-page__tabs" role="tablist" aria-label="Authentication mode">
              {(['login', 'signup'] as AuthTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => switchTab(t)}
                  className={`auth-page__tab ${tab === t ? 'auth-page__tab--active' : ''}`}
                >
                  {t === 'login' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            {error && (
              <div className="auth-page__error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-page__form">
              {tab === 'signup' && (
                <div className="auth-page__field">
                  <label htmlFor="auth-name">Full name</label>
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="auth-page__field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="auth-page__field">
                <label htmlFor="auth-password">Password</label>
                <div className="auth-page__password-wrap">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    className="auth-page__password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !authReady}
                className="landing-btn landing-btn--primary auth-page__submit"
              >
                {isLoading ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="my-6 flex items-center justify-center gap-3">
              <span className="h-px flex-1 bg-[var(--border2)]" />
              <span className="text-[10px] font-mono-custom uppercase tracking-widest text-[var(--text3)]">or</span>
              <span className="h-px flex-1 bg-[var(--border2)]" />
            </div>

            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('buildx_auth_redirect', from);
                sessionStorage.removeItem('buildx_github_link');
                const state = generateOAuthState();
                sessionStorage.setItem('buildx_github_oauth_state', state);
                const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
                const redirectUri = encodeURIComponent(window.location.origin + '/login/callback');
                window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email,repo&redirect_uri=${redirectUri}&state=${state}`;
              }}
              className="w-full py-3 px-4 rounded-xl font-display font-semibold text-sm border transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: 'var(--surface2)',
                borderColor: 'var(--border2)',
                color: 'var(--text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.4)';
                e.currentTarget.style.background = 'rgba(20, 184, 166, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border2)';
                e.currentTarget.style.background = 'var(--surface2)';
              }}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Continue with GitHub
            </button>

            <p className="auth-page__switch">
              {tab === 'login' ? (
                <>
                  No account?{' '}
                  <button type="button" onClick={() => switchTab('signup')} className="auth-page__switch-btn">
                    Sign up free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchTab('login')} className="auth-page__switch-btn">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
