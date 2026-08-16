import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, LogOut, PanelLeft,
  Cpu, Compass, Sparkles, Rocket,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  sidebarOpen?: boolean;
  onDeploy?: () => void;
}

export function Header({ onToggleSidebar, showSidebarToggle, sidebarOpen, onDeploy }: HeaderProps) {
  const location = useLocation();
  const path = location.pathname;
  const isHome    = path === '/create' || path.startsWith('/blueprint/');
  const isGallery = path === '/gallery';
  const isAgent   = path.startsWith('/agent');

  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const routeIdMatch = path.match(/\/(?:agent|blueprint)\/([^/]+)/);
  const routeId = routeIdMatch ? routeIdMatch[1] : null;

  return (
    <header className="h-16 w-full border-b border-white/10 px-6 flex items-center justify-between bg-[#08080c]/90 backdrop-blur-xl z-50 shrink-0 select-none relative">

      {/* ── LEFT: Sidebar Toggle + BuildX Logo + AI ARCHITECT Badge + Breadcrumb ── */}
      <div className="flex items-center gap-4 min-w-0">

        {/* Sidebar Toggle Button */}
        {showSidebarToggle && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={onToggleSidebar}
            className={`shrink-0 p-2 rounded-xl border transition-all ${
              sidebarOpen
                ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300'
                : 'bg-transparent hover:bg-white/[0.07] border-white/[0.08] text-zinc-400 hover:text-white'
            }`}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <PanelLeft size={18} />
          </motion.button>
        )}

        {/* BuildX Logo (md size for spacious 64px header) */}
        <Link to="/create" className="shrink-0 focus-visible:outline-none">
          <Logo size="md" />
        </Link>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-white/10 shrink-0 mx-1" />

        {/* Breadcrumb Path */}
        <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-zinc-400 min-w-0">
          <span className="text-zinc-400 font-medium shrink-0">01 / BUILDX STUDIO</span>
          <ChevronRight size={12} className="text-zinc-600 shrink-0" />
          <span className="text-zinc-200 bg-zinc-900 border border-white/10 px-2.5 py-1 rounded-lg text-xs truncate max-w-[130px]">
            buildx&nbsp;/&nbsp;{routeId ? routeId.slice(0, 7) : 'my-app'}
          </span>
        </div>
      </div>

      {/* ── CENTER: Navigation Pills ── */}
      <nav
        className="hidden md:flex items-center gap-1 bg-zinc-900/80 border border-white/10 p-1.5 rounded-xl"
        aria-label="Main Navigation"
      >
        {[
          { to: '/create',  label: 'Studio',  Icon: Sparkles, active: isHome    },
          { to: '/gallery', label: 'Gallery', Icon: Compass,  active: isGallery },
          ...(user ? [{ to: '/agent', label: 'IDE', Icon: Cpu, active: isAgent }] : []),
        ].map(({ to, label, Icon, active }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              active
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Icon size={13} className={active ? 'text-indigo-400' : 'text-zinc-500'} />
            {label}
          </Link>
        ))}
      </nav>

      {/* ── RIGHT: Deploy CTA + User Avatar/Menu ── */}
      <div className="flex items-center gap-3 shrink-0">

        {/* Deploy CTA Button */}
        <motion.button
          type="button"
          onClick={onDeploy}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-lg shadow-indigo-500/20 border border-indigo-400/30 flex items-center gap-2 transition-all"
        >
          <Rocket size={13} />
          <span>Deploy</span>
        </motion.button>

        {/* User Menu */}
        {user ? (
          <div className="relative">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMenu(v => !v)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs text-white transition-all"
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-200 shrink-0 font-mono">
                {user.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="hidden sm:block text-zinc-300 text-xs font-medium truncate max-w-[84px]">
                {user.name?.split(' ')[0]}
              </span>
              <ChevronDown size={12} className="text-zinc-500 shrink-0" />
            </motion.button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.13 }}
                  className="absolute right-0 mt-2 w-52 rounded-xl bg-[#111116] border border-white/[0.08] shadow-2xl py-1 z-50"
                >
                  <div className="px-3.5 py-2.5 border-b border-white/[0.06]">
                    <p className="text-white text-xs font-semibold truncate">{user.name}</p>
                    <p className="text-zinc-500 text-[10px] truncate mt-0.5">{user.email}</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); logout(); }}
                    className="w-full text-left px-3.5 py-2 text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors text-xs font-medium"
                  >
                    <LogOut size={13} />
                    <span>Sign out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link
            to="/login"
            className="px-3.5 py-2 rounded-lg border border-white/10 hover:border-white/20 text-xs text-zinc-400 hover:text-white transition-all font-medium"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
