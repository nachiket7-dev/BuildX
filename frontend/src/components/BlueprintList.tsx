import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Plus, Layers, Database, Code2, Monitor, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { useBlueprintList } from '../hooks/useBlueprints';
import { useAuth } from '../hooks/useAuth';

interface BlueprintListProps {
  onSelectBlueprint?: (id: string) => void;
}

export function BlueprintList({ onSelectBlueprint }: BlueprintListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'archived'>('all');

  const { data: items = [], isLoading } = useBlueprintList('mine', Boolean(user));

  const sampleBlueprints = [
    {
      id: 'demo-1',
      appName: 'MedConnect Telehealth',
      idea: 'HIPAA-compliant telemedicine booking and video consultation platform',
      complexity: 'High',
      tablesCount: 14,
      endpointsCount: 28,
      screensCount: 9,
      modelUsed: 'Kimi K2.6 Engine',
      updatedAt: '2 hours ago',
      status: 'active',
    },
    {
      id: 'demo-2',
      appName: 'PayFlow Quantum',
      idea: 'Real-time multi-currency settlement gateway with AI fraud detection',
      complexity: 'High',
      tablesCount: 18,
      endpointsCount: 36,
      screensCount: 12,
      modelUsed: 'Kimi K2.6 Engine',
      updatedAt: '1 day ago',
      status: 'active',
    },
    {
      id: 'demo-3',
      appName: 'Cortex Studio IDE',
      idea: 'Browser-based agentic code editing environment with Monaco editor',
      complexity: 'Medium',
      tablesCount: 10,
      endpointsCount: 22,
      screensCount: 7,
      modelUsed: 'Gemini 3.5 Flash',
      updatedAt: '3 days ago',
      status: 'archived',
    },
    {
      id: 'demo-4',
      appName: 'ShopCraft AI Storefront',
      idea: 'Next.js e-commerce engine with dynamic recommendations and Stripe checkout',
      complexity: 'Medium',
      tablesCount: 12,
      endpointsCount: 24,
      screensCount: 8,
      modelUsed: 'NVIDIA Nemotron 3',
      updatedAt: '5 days ago',
      status: 'active',
    },
  ];

  const displayItems = useMemo(() => {
    const list = items.length > 0 ? items.map((item: any, idx: number) => ({
      id: item.id || `bp-${idx}`,
      appName: item.appName || item.title || 'Untitled Blueprint',
      idea: item.idea || item.description || 'System Architecture Blueprint',
      complexity: item.complexity || 'Medium',
      tablesCount: item.tablesCount || item.schema?.length || 8,
      endpointsCount: item.endpointsCount || item.endpoints?.length || 16,
      screensCount: item.screensCount || item.screens?.length || 5,
      modelUsed: item.modelUsed || 'Kimi K2.6 Engine',
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Recently',
      status: 'active',
    })) : sampleBlueprints;

    return list.filter((b) => {
      const matchesSearch = b.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.idea.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'all' || (activeFilter === 'active' && b.status === 'active') || (activeFilter === 'archived' && b.status === 'archived');
      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, activeFilter]);

  return (
    <div className="w-full space-y-6 pb-36">
      {/* Search & Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121216] p-3 rounded-2xl border border-white/10 backdrop-blur-xl">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search architectures, models, schemas..."
            className="w-full bg-zinc-950/80 border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 text-xs text-white placeholder-zinc-500 rounded-xl pl-9 pr-4 py-2.5 font-mono outline-none transition-all"
          />
        </div>

        {/* Gliding Filter Pills */}
        <div className="flex items-center gap-1 bg-zinc-950/80 border border-white/10 p-1 rounded-xl w-full sm:w-auto font-mono text-xs">
          {[
            { id: 'all', label: '01 ALL' },
            { id: 'active', label: '02 ACTIVE' },
            { id: 'archived', label: '03 ARCHIVED' },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all flex-1 sm:flex-none text-center ${
                  isActive
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Showcase (2 Columns) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 rounded-2xl bg-[#121216] border border-white/10 animate-pulse p-6 space-y-4">
              <div className="h-4 bg-white/10 rounded w-1/3" />
              <div className="h-6 bg-white/10 rounded w-2/3" />
              <div className="h-12 bg-white/5 rounded w-full" />
            </div>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-16 px-6 bg-[#121216] border border-white/10 rounded-2xl">
          <Layers size={36} className="mx-auto text-zinc-500 mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">No System Architectures Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-6">
            No matching blueprints in this workspace. Create your first full-stack architecture with the AI Prompt Studio.
          </p>
          <Link
            to="/blueprints/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-xs shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 transition-all"
          >
            <Plus size={14} />
            <span>Create Blueprint</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              whileHover={{ y: -3 }}
              className="group bg-[#121216] border border-white/10 hover:border-white/25 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between relative overflow-hidden shadow-xl"
            >
              {/* Subtle top card glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] pointer-events-none rounded-full group-hover:bg-indigo-500/20 transition-all" />

              <div>
                {/* Header Row: Index Tag + Telemetry Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    0{idx + 1} / {item.appName.split(' ')[0].toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {item.modelUsed}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">
                  {item.appName}
                </h3>

                {/* Idea Description */}
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-6 font-sans">
                  {item.idea}
                </p>
              </div>

              <div>
                {/* Resource Count Pills */}
                <div className="flex flex-wrap items-center gap-2 mb-5 font-mono text-[11px]">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300">
                    <Database size={12} className="text-purple-400" />
                    {item.tablesCount} Tables
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300">
                    <Code2 size={12} className="text-blue-400" />
                    {item.endpointsCount} APIs
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300">
                    <Monitor size={12} className="text-emerald-400" />
                    {item.screensCount} Screens
                  </span>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <span className="text-[10px] font-mono text-zinc-500">
                    Updated {item.updatedAt}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/agent/${item.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-mono text-zinc-300 hover:text-white transition-all flex items-center gap-1"
                    >
                      <Sparkles size={11} className="text-indigo-400" />
                      <span>IDE Studio</span>
                    </button>
                    <button
                      onClick={() => navigate(`/blueprint/${item.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-xs font-mono text-indigo-300 hover:text-white transition-all flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
