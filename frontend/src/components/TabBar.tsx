import { motion } from 'framer-motion';
import { TABS } from '../lib/utils';
import type { TabId } from '../lib/types';

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-[#111113]/80 backdrop-blur-xl border border-white/10 max-w-full overflow-x-auto custom-scrollbar"
      role="tablist"
      aria-label="Blueprint sections"
    >
      {TABS.map(({ id, label }, idx) => {
        const isActive = activeTab === id;
        const num = String(idx + 1).padStart(2, '0');
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id as TabId)}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-sans font-medium transition-all whitespace-nowrap shrink-0 ${
              isActive
                ? 'text-white bg-indigo-600/30 border border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeBlueprintTab"
                className="absolute inset-0 rounded-xl bg-indigo-600/25 border border-indigo-500/40"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <span className={`text-[9px] font-mono ${isActive ? 'text-indigo-400/80' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                {num}
              </span>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
