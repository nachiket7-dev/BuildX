import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';
import { Compass, Home, Layers, LogOut, PanelLeft, Sparkles } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  sidebarOpen?: boolean;
}

function NavLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`nav-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${active ? 'nav-link--active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function Header({ onToggleSidebar, showSidebarToggle, sidebarOpen }: HeaderProps) {
  const location = useLocation();
  const isHome = location.pathname === '/create' || location.pathname.startsWith('/blueprint/');
  const isGallery = location.pathname === '/gallery';
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { selectedModel } = useModel();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="flex items-center gap-3">
          {showSidebarToggle && !sidebarOpen && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="shell-icon-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Open sidebar"
            >
              <PanelLeft size={18} />
            </button>
          )}
          <Link to="/create" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg">
            <Logo size="md" />
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <NavLink to="/" label="Home" icon={Sparkles} active={false} />
          <NavLink to="/create" label="Create" icon={Home} active={isHome} />
          <NavLink to="/gallery" label="Gallery" icon={Compass} active={isGallery} />
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex items-center gap-2" title="Active model">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
              style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }}
            />
            <span className="font-mono-custom text-[10px]" style={{ color: 'var(--text3)' }}>
              {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.label || 'Groq AI'}
            </span>
          </div>

          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="shell-user-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-expanded={showMenu}
                aria-haspopup="true"
              >
                <span
                  className="shell-user-btn__avatar"
                  aria-hidden
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-mono-custom text-xs hidden sm:inline max-w-[100px] truncate">
                  {user.name}
                </span>
              </button>

              {showMenu && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setShowMenu(false)}
                  />
                  <div
                    className="user-menu animate-fade-slide-up"
                    role="menu"
                  >
                    <div className="user-menu__header">
                      <p className="user-menu__name">{user.name}</p>
                      <p className="user-menu__email">{user.email}</p>
                    </div>
                    <div className="user-menu__divider" />
                    <Link
                      to="/gallery"
                      role="menuitem"
                      onClick={() => setShowMenu(false)}
                      className="user-menu__item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <Layers size={13} />
                      My Blueprints
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        logout();
                        setShowMenu(false);
                        navigate('/', { replace: true });
                      }}
                      className="user-menu__item user-menu__item--danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
