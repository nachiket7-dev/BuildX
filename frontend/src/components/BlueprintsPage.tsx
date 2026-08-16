import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Layers } from 'lucide-react';
import { BlueprintList } from './BlueprintList';
import { PageHead } from './PageHead';

export function BlueprintsPage() {
  return (
    <div className="min-h-screen bg-obsidian-bg text-white relative overflow-x-hidden font-sans">
      <PageHead
        title="Blueprints Library — BuildX"
        description="Manage your generated system architectures, database schemas, and AI application specifications."
      />

      {/* Top Ambient Radial Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-emerald-500/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-20 right-10 w-[500px] h-[300px] bg-sylven/15 blur-[160px] pointer-events-none rounded-full" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 pb-6 border-b border-obsidian-borderSubtle">
          <div>
            <div className="flex items-center gap-2 mb-2 font-mono text-xs text-norvin-muted">
              <span className="text-sylven-light font-semibold">02 / BLUEPRINT LIBRARY</span>
              <span>•</span>
              <span className="text-zinc-500">SYSTEM ARCHITECTURES</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              MY SYSTEM ARCHITECTURES
            </h1>
            <p className="text-xs sm:text-sm text-norvin-muted mt-2 max-w-xl leading-relaxed font-sans">
              Inspect production-grade database DDL schemas, API routes, React UI wireframes, and generate full application codebases.
            </p>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="shrink-0 font-mono">
            <Link
              to="/blueprints/new"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 border border-emerald-400/30"
            >
              <Plus size={15} />
              <span>+ Create Blueprint</span>
            </Link>
          </motion.div>
        </div>

        {/* Dashboard Grid Container */}
        <BlueprintList />
      </main>
    </div>
  );
}

export default BlueprintsPage;
