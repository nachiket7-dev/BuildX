import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight } from 'lucide-react';

export function MarketingHeader() {
  const { user, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function goToApp() {
    if (user) {
      navigate('/create');
    } else {
      navigate('/login', { state: { from: '/create' } });
    }
  }

  const NAV_LINKS = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '/gallery', label: 'Gallery', isRoute: true },
  ];

  return (
    <div className="w-full flex justify-center sticky top-0 z-50 pt-4 px-4 pointer-events-none">
      <header className="pointer-events-auto w-full max-w-5xl flex items-center justify-between gap-4 px-6 py-3.5 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-xl shadow-black/40">

        {/* Logo */}
        <Link
          to="/"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl flex-shrink-0"
        >
          <Logo size="lg" />
        </Link>

        {/* Center nav links */}
        <nav className="hidden sm:flex items-center gap-1.5" aria-label="Marketing navigation">
          {NAV_LINKS.map((link) =>
            link.isRoute ? (
              <Link
                key={link.label}
                to={link.href}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/[0.07] border border-transparent hover:border-white/10 transition-all duration-200"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/[0.07] border border-transparent hover:border-white/10 transition-all duration-200"
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        {/* Right: auth buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {authReady && !user && (
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/[0.07] border border-transparent hover:border-white/10 transition-all duration-200 hidden sm:inline-flex"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={goToApp}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
          >
            <span>{user ? 'Open Workspace' : 'Get started'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>
    </div>
  );
}
