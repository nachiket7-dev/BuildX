import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LandingPreloaderProps {
  onComplete: () => void;
}

const LETTERS = 'BUILDX'.split('');

const STAGES = [
  { threshold: 0,    label: '01 / LOADING SCHEMAS' },
  { threshold: 1500, label: '02 / MOUNTING MODELS' },
  { threshold: 2800, label: '03 / SYSTEM READY' },
];

const TELEMETRY_LOGS = [
  '> initializing_monorepo_vfs()',
  '> mounting_kimi_k3_reasoning_node()',
  '> verifying_jwt_keystore()',
];

// Variants for the stagger container
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.25,
    },
  },
};

// Each letter slides up from below its mask
const letterVariants = {
  hidden: { y: '110%' },
  visible: {
    y: '0%',
    transition: {
      duration: 0.72,
      ease: [0.76, 0, 0.24, 1] as [number, number, number, number],
    },
  },
};

// Subtitle & telemetry fade in after letters land
const fadeUpVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.33, 1, 0.68, 1] as [number, number, number, number],
      delay: LETTERS.length * 0.08 + 0.72 + 0.1,
    },
  },
};

export function LandingPreloader({ onComplete }: LandingPreloaderProps) {
  const [visible, setVisible] = useState(true);
  const [stageLabel, setStageLabel] = useState(STAGES[0].label);

  // Stage label ticker & scroll lock handling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const start = Date.now();
    const interval = setInterval(() => {
      const ms = Date.now() - start;
      const current = STAGES.reduce(
        (acc, s) => (ms >= s.threshold ? s : acc),
        STAGES[0]
      );
      setStageLabel(current.label);
    }, 80);

    return () => {
      clearInterval(interval);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Total reveal timer: ~0.25 + 5×0.08 + 0.72 + fade(0.6) + hold(0.4) ≈ 2.37s
  useEffect(() => {
    const totalMs =
      (0.25 + (LETTERS.length - 1) * 0.08 + 0.72 + 0.6 + 0.4) * 1000;
    const timer = setTimeout(() => setVisible(false), totalMs);
    return () => clearTimeout(timer);
  }, []);

  const handleExitComplete = () => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    onComplete();
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && (
        <motion.div
          key="preloader"
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.85, ease: [0.87, 0, 0.13, 1] as [number, number, number, number] }}
          className="fixed inset-0 z-[9999] bg-[#08080c] text-white flex flex-col justify-between p-8 md:p-16 overflow-hidden pointer-events-none"
        >
          {/* ── Corner Crosshairs (+) ── */}
          <div className="absolute top-4 left-4 text-zinc-600 font-mono text-xs z-20 select-none">+</div>
          <div className="absolute top-4 right-4 text-zinc-600 font-mono text-xs z-20 select-none">+</div>
          <div className="absolute bottom-4 left-4 text-zinc-600 font-mono text-xs z-20 select-none">+</div>
          <div className="absolute bottom-4 right-4 text-zinc-600 font-mono text-xs z-20 select-none">+</div>

          {/* ── Subtle Architectural Grid Background ── */}
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="preloader-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-zinc-400" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#preloader-grid)" />
          </svg>

          {/* ── Ambient Mesh Lighting ── */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-emerald-500/15 blur-[150px] pointer-events-none rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sylven/15 blur-[160px] pointer-events-none rounded-full" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-teal-500/10 blur-[120px] pointer-events-none rounded-full" />

          {/* ── Top Header Rail ── */}
          <div className="flex items-center justify-between relative z-10">
            <span className="font-mono text-[11px] tracking-widest text-norvin-muted uppercase">
              00 / INITIALIZING ENGINE
            </span>
            <span className="font-mono text-[11px] tracking-widest text-norvin-muted uppercase">
              V2.4
            </span>
          </div>

          {/* ── Center Typography Glass Card Container ── */}
          <div className="absolute inset-0 flex items-center justify-center p-4 z-10 pointer-events-none">
            <div className="bg-obsidian-surface/60 backdrop-blur-md border border-obsidian-border rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center justify-center text-center relative max-w-3xl w-full">
              {/* Letter mask container */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex items-center justify-center gap-[0.04em]"
                aria-label="BUILDX"
              >
                {LETTERS.map((char, i) => (
                  <span
                    key={i}
                    className="overflow-hidden inline-block leading-none"
                    style={{ lineHeight: 1.0 }}
                  >
                    <motion.span
                      variants={letterVariants}
                      className="inline-block font-black tracking-tighter text-white"
                      style={{
                        fontSize: 'clamp(4rem, 13vw, 10rem)',
                        lineHeight: 1,
                        background:
                          i === LETTERS.length - 1
                            ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                            : 'white',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: i === LETTERS.length - 1 ? 'transparent' : 'white',
                      }}
                    >
                      {char}
                    </motion.span>
                  </span>
                ))}
              </motion.div>

              {/* Subtitle tagline */}
              <motion.p
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="font-mono text-[11px] sm:text-xs tracking-[0.3em] text-zinc-400 uppercase text-center mt-4"
              >
                NEXT-GEN FULL-STACK AI ARCHITECT
              </motion.p>

              {/* Live Telemetry Code Stream */}
              <motion.div
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="mt-6 space-y-1 font-mono text-[11px] text-zinc-600/40 text-center"
              >
                {TELEMETRY_LOGS.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* ── Bottom Status Rail ── */}
          <div className="flex items-end justify-between relative z-10 pt-6 border-t border-white/10">
            <div className="space-y-1.5">
              <AnimatePresence mode="wait">
                <motion.span
                  key={stageLabel}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.18 }}
                  className="block font-mono text-[11px] text-zinc-400 tracking-widest uppercase"
                >
                  {stageLabel}
                </motion.span>
              </AnimatePresence>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[10px] text-emerald-400 tracking-widest">LIVE</span>
              </div>
            </div>

            <span className="font-mono text-[11px] text-zinc-600 tracking-widest uppercase">
              BUILDX V2.4
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
