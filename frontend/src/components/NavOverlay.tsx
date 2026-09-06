import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, ArrowUpRight, Sparkles, Compass, Layers, FileText } from 'lucide-react';

interface NavOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { num: '01', label: 'STUDIO', route: '/create', icon: Sparkles, external: false },
  { num: '02', label: 'BLUEPRINTS', route: '/gallery', icon: Compass, external: false },
  { num: '03', label: 'FEATURES', route: '#features', icon: Layers, external: false },
  { num: '04', label: 'DOCS', route: 'https://github.com/nachiket7-dev/BuildX#readme', icon: FileText, external: true },
];

export function NavOverlay({ isOpen, onClose }: NavOverlayProps) {
  const navigate = useNavigate();

  const handleNav = (item: typeof NAV_ITEMS[number]) => {
    if (!item) return;
    onClose();
    if (item.external) {
      window.open(item.route, '_blank', 'noopener,noreferrer');
    } else if (item.route.startsWith('#')) {
      const el = document.querySelector(item.route);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(item.route);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 bg-[#0A0A0B]/95 backdrop-blur-3xl flex flex-col justify-between p-6 sm:p-12 overflow-hidden"
        >
          {/* ── Ambient Background Mesh Lighting ── */}
          <div className="absolute top-0 left-0 w-[600px] h-[350px] bg-emerald-500/10 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/15 blur-[160px] pointer-events-none rounded-full" />

          {/* ── Subtle Background Grid Pattern ── */}
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="nav-overlay-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-zinc-400" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#nav-overlay-grid)" />
          </svg>

          {/* ── Header Bar ── */}
          <div className="flex items-center justify-between border-b border-white/10 pb-6 relative z-10">
            <div className="flex items-center gap-2 text-xs font-sans text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>NAV_OVERLAY // BUILDX v2.4</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.08, rotate: 90 }}
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              className="p-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 text-white transition-all shadow-lg"
              aria-label="Close Navigation"
            >
              <X size={20} />
            </motion.button>
          </div>

          {/* ── Center Navigation Links ── */}
          <div className="max-w-4xl w-full mx-auto my-auto py-8 relative z-10">
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
              }}
              className="space-y-3 sm:space-y-4"
            >
              {(NAV_ITEMS ?? []).map((item) => {
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.num}
                    variants={{
                      hidden: { opacity: 0, x: -30, filter: 'blur(10px)' },
                      show: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
                    }}
                  >
                    <button
                      onClick={() => handleNav(item)}
                      className="group w-full flex items-center justify-between text-left px-4 py-4 rounded-2xl border-b border-white/5 hover:border-indigo-500/40 hover:bg-white/[0.02] transition-all duration-300 transform hover:translate-x-2"
                    >
                      <div className="flex items-baseline gap-4 sm:gap-8">
                        <span className="font-sans text-sm sm:text-lg text-indigo-400 font-bold tracking-wider">
                          {item.num}
                        </span>
                        <span className="font-display text-3xl sm:text-6xl font-extrabold text-white group-hover:text-indigo-400 transition-colors duration-300">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-500 group-hover:text-indigo-400 transition-colors">
                        {Icon && <Icon size={24} className="hidden sm:inline" />}
                        <ArrowUpRight size={28} className="transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* ── Footer Info ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6 font-sans text-xs text-neutral-500 relative z-10">
            <div>BuildX Autonomous Multi-Model Platform</div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/nachiket7-dev/BuildX" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
              <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">NVIDIA NIM</a>
              <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Gemini Flash</a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
