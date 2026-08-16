import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { NavOverlay } from './NavOverlay';

export function MarketingHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);

  function goToApp() {
    if (user) {
      navigate('/create');
    } else {
      navigate('/login', { state: { from: '/create' } });
    }
  }

  return (
    <>
      <div className="w-full flex justify-center sticky top-0 z-40 pt-4 px-4 pointer-events-none">
        <header className="pointer-events-auto w-full max-w-5xl flex items-center justify-between gap-4 px-5 py-2.5 rounded-full border border-emerald-500/30 bg-[#092017]/50 backdrop-blur-md shadow-2xl shadow-black/60">

          {/* Left: Brand Logo & Status Pill */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-xl flex-shrink-0"
            >
              <Logo size="lg" />
            </Link>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[11px] font-medium">Operational</span>
            </div>
          </div>

          {/* Right: CTA & Custom Animated 2-Line Hamburger */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={goToApp}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#10B981] hover:bg-[#34D399] text-[#04120C] text-xs sm:text-sm font-semibold font-mono leading-none transition-all duration-200 shadow-lg shadow-emerald-500/25 border border-emerald-400/40"
            >
              <span className="leading-none">Launch Studio</span>
              <ArrowRight size={13} strokeWidth={2.5} className="flex-shrink-0 translate-y-[0.5px]" />
            </motion.button>

            {/* Custom Animated 2-Line Hamburger */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setIsNavOpen(true)}
              className="p-2 rounded-full bg-[#0C2720]/80 hover:bg-[#0C2720] border border-emerald-500/20 text-white flex flex-col justify-center gap-1.5 w-9 h-9 items-center transition-colors"
              aria-label="Open Navigation Menu"
            >
              <span className="w-4 h-0.5 bg-white rounded-full transition-transform" />
              <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full transition-transform self-end" />
            </motion.button>
          </div>
        </header>
      </div>

      {/* Fullscreen Staggered Nav Overlay */}
      <NavOverlay isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />
    </>
  );
}
