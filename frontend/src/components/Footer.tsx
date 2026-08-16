import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Github, Twitter, MessageSquare, Terminal } from 'lucide-react';
import { Logo } from './Logo';
import { ScrollReveal } from './animations/ScrollReveal';

export function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-obsidian-bg border-t border-obsidian-border relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-sylven/10 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">

        {/* Top Monolithic Display Banner */}
        <ScrollReveal direction="up" delay={0.05}>
          <div className="text-center max-w-4xl mx-auto mb-16 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-obsidian-surface border border-obsidian-border">
              <Terminal size={13} className="text-sylven-light" />
              <span className="font-mono text-xs text-norvin-muted uppercase tracking-wider">00 / PRODUCTION SCAFFOLD GENERATOR</span>
            </div>

            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white text-center max-w-4xl mx-auto font-display">
              Build at the speed of thought.
            </h2>

            <p className="text-sm sm:text-base text-norvin-muted max-w-xl mx-auto leading-relaxed">
              Transform plain-English product specifications into complete, running monorepos with PostgreSQL DDL, REST APIs, and React UI screens.
            </p>

            <div className="pt-4 flex justify-center">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/create')}
                className="landing-btn landing-btn--primary px-8 py-3.5 text-sm sm:text-base font-bold shadow-2xl shadow-emerald-500/25"
              >
                <span>Launch Studio IDE</span>
                <ArrowRight size={18} className="landing-btn__icon" />
              </motion.button>
            </div>
          </div>
        </ScrollReveal>

        {/* Middle Navigation & Info Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-12 border-t border-white/10">
          <div className="space-y-3 md:col-span-1">
            <Logo size="lg" />
            <p className="text-xs text-neutral-400 leading-relaxed font-mono">
              Autonomous multi-model AI architect for full-stack web applications.
            </p>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="text-white font-semibold uppercase tracking-wider mb-2">Platform</div>
            <div><a href="#features" className="text-neutral-400 hover:text-white transition-colors">Features</a></div>
            <div><a href="/gallery" className="text-neutral-400 hover:text-white transition-colors">Gallery</a></div>
            <div><a href="/create" className="text-neutral-400 hover:text-white transition-colors">Studio IDE</a></div>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="text-white font-semibold uppercase tracking-wider mb-2">Providers</div>
            <div><a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors">NVIDIA NIM (Nemotron 550B)</a></div>
            <div><a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors">Google AI (Gemini Flash)</a></div>
            <div><a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors">Groq (Qwen 32B)</a></div>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="text-white font-semibold uppercase tracking-wider mb-2">Open Source</div>
            <div><a href="https://github.com/nachiket7-dev/BuildX" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors">GitHub Repository</a></div>
            <div><a href="https://github.com/nachiket7-dev/BuildX#readme" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors">Documentation</a></div>
            <div><a href="https://github.com/nachiket7-dev/BuildX/blob/main/LICENSE" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors">MIT License</a></div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/10 font-mono text-xs text-neutral-500">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Systems Operational</span>
          </div>

          <div>
            © {new Date().getFullYear()} BuildX. Engineered with Node.js, Express, React & TypeScript.
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <a href="https://github.com/nachiket7-dev/BuildX" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="GitHub">
              <Github size={16} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="Twitter">
              <Twitter size={16} />
            </a>
            <a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="Discord">
              <MessageSquare size={16} />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
