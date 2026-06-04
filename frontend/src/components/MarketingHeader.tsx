import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';

export function MarketingHeader() {
  const { user, authReady } = useAuth();
  const navigate = useNavigate();

  function goToApp() {
    if (user) {
      navigate('/create');
    } else {
      navigate('/login', { state: { from: '/create' } });
    }
  }

  return (
    <div className="marketing-header-shell">
      <header className="marketing-header">
        <Link
          to="/"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg"
        >
          <Logo size="md" />
        </Link>

        <nav className="marketing-header__nav" aria-label="Marketing">
          <a href="#features" className="marketing-header__link hidden sm:inline-flex">
            Features
          </a>
          {authReady && user ? (
            <button
              type="button"
              onClick={() => navigate('/create')}
              className="landing-btn landing-btn--primary landing-btn--sm"
            >
              Open workspace
            </button>
          ) : (
            <>
              <Link to="/login" className="marketing-header__link">
                Sign in
              </Link>
              <button type="button" onClick={goToApp} className="landing-btn landing-btn--primary landing-btn--sm">
                Get started
              </button>
            </>
          )}
        </nav>
      </header>
    </div>
  );
}
