import { useState } from 'react';
import { generateOAuthState } from '../lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';
import { Compass, Github, Home, Layers, LogOut, PanelLeft, Sparkles, User, ChevronDown } from 'lucide-react';

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
      className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-white/10 text-white border border-white/15 shadow-sm'
          : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={14} className={active ? 'text-indigo-400' : 'text-neutral-400'} />
      <span>{label}</span>
    </Link>
  );
}

export function Header({ onToggleSidebar, showSidebarToggle, sidebarOpen }: HeaderProps) {
  const location = useLocation();
  const isHome = location.pathname === '/create' || location.pathname.startsWith('/blueprint/');
  const isGallery = location.pathname === '/gallery';
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md border-b border-white/10 bg-zinc-950/60 px-4 sm:px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Sidebar Toggle */}
        <div className="flex items-center gap-3">
          {showSidebarToggle && !sidebarOpen && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/10 text-neutral-300 transition-colors"
              aria-label="Open sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}
          <Link to="/create" className="flex items-center gap-2 group">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Centered Floating Nav Pills */}
        <nav className="flex items-center gap-1.5 bg-black/40 p-1 rounded-full border border-white/5" aria-label="Main Navigation">
          <NavLink to="/create" label="Studio" icon={Sparkles} active={isHome} />
          <NavLink to="/gallery" label="Gallery" icon={Compass} active={isGallery} />
        </nav>

        {/* Right Status & Profile Controls */}
        <div className="flex items-center gap-3">
          {/* Static Autonomous Multi-Model Pipeline Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] text-indigo-300 font-medium">
              Pipeline Mode: Autonomous Multi-Model
            </span>
          </div>

          {/* User Profile Menu */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-white transition-all"
                aria-expanded={showMenu}
              >
                <div className="w-5 h-5 rounded-full bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium hidden sm:inline max-w-[90px] truncate">{user.name}</span>
                <ChevronDown size={12} className="text-neutral-400" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-neutral-900 border border-white/10 shadow-2xl py-1 z-50 text-xs font-mono">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-white font-medium truncate">{user.name}</p>
                    <p className="text-neutral-400 text-[10px] truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={12} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-indigo-500/20"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
