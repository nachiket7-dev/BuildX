import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Zap, FolderArchive, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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
            <Link to="/" className="auth-page__back-link auth-page__back-link--compact lg:hidden">
              <ArrowLeft size={14} aria-hidden />
              Home
            </Link>
            <div className="hidden lg:block" />
            <Link to="/" className="lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg">
              <Logo size="md" />
            </Link>
          </header>

          <div className="auth-page__panel-body animate-fade-slide-up">
            <Link to="/" className="auth-page__back-link hidden lg:inline-flex mb-8">
              <ArrowLeft size={16} aria-hidden />
              Back to home
            </Link>

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
