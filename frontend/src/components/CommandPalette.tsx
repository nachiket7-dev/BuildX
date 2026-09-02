import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileCode,
  FileJson,
  FileText,
  Database,
  Sparkles,
  Zap,
  Settings,
  Eye,
  Download,
  GitBranch,
  Cpu,
  Palette,
  Terminal,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaletteAction =
  | { type: 'file'; path: string }
  | { type: 'action'; id: string }
  | { type: 'model'; modelKey: string }
  | { type: 'prompt'; prompt: string };

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: 'file' | 'action' | 'model' | 'prompt';
  icon: React.ReactNode;
  action: PaletteAction;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: PaletteAction) => void;
  /** VFS file paths available in the current workspace */
  filePaths?: string[];
  /** Name of the active workspace */
  appName?: string;
  /** Whether the agent is currently running */
  isAgentBusy?: boolean;
}

// ─── Fuzzy Match Utility ──────────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (!q) return { match: true, score: 0 };
  if (t.includes(q)) return { match: true, score: 100 - t.indexOf(q) };

  let qIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += 10;
      // Bonus for consecutive matches
      if (lastMatchIdx === i - 1) score += 5;
      // Bonus for word boundary match
      if (i === 0 || t[i - 1] === '/' || t[i - 1] === '.' || t[i - 1] === '-' || t[i - 1] === ' ') score += 8;
      lastMatchIdx = i;
      qIdx++;
    }
  }

  return { match: qIdx === q.length, score };
}

// ─── File Icon Helper ─────────────────────────────────────────────────────────

function getFileIcon(path: string) {
  if (path.endsWith('.sql') || path.includes('schema') || path.includes('mongoose')) {
    return <Database size={14} className="text-purple-400" />;
  }
  if (path.endsWith('.tsx') || path.endsWith('.ts')) {
    return <FileCode size={14} className="text-blue-400" />;
  }
  if (path.endsWith('.json')) {
    return <FileJson size={14} className="text-amber-400" />;
  }
  if (path.endsWith('.md')) {
    return <FileText size={14} className="text-emerald-400" />;
  }
  if (path.endsWith('.css') || path.endsWith('.html')) {
    return <Palette size={14} className="text-pink-400" />;
  }
  return <FileCode size={14} className="text-gray-400" />;
}

// ─── Static Action Items ──────────────────────────────────────────────────────

const STUDIO_ACTIONS: CommandItem[] = [
  {
    id: 'enhance-ui',
    label: 'Enhance UI with Dark Glassmorphism',
    description: 'Upgrade App.tsx with rich production-grade UI',
    category: 'action',
    icon: <Sparkles size={14} className="text-purple-400" />,
    action: { type: 'action', id: 'enhance-ui' },
    keywords: ['enhance', 'ui', 'upgrade', 'glassmorphism', 'dark', 'premium'],
  },
  {
    id: 'toggle-preview',
    label: 'Toggle Live Preview',
    description: 'Switch between Code Editor and Live Preview',
    category: 'action',
    icon: <Eye size={14} className="text-cyan-400" />,
    action: { type: 'action', id: 'toggle-preview' },
    keywords: ['preview', 'toggle', 'view', 'live'],
  },
  {
    id: 'run-autofix',
    label: 'Run Auto-Fix QA Pipeline',
    description: 'Launch autonomous self-healing agent on errors',
    category: 'action',
    icon: <Zap size={14} className="text-amber-400" />,
    action: { type: 'action', id: 'run-autofix' },
    keywords: ['fix', 'auto', 'qa', 'heal', 'error', 'debug'],
  },
  {
    id: 'deploy-github',
    label: 'Deploy to GitHub',
    description: 'Push workspace to a GitHub repository',
    category: 'action',
    icon: <GitBranch size={14} className="text-green-400" />,
    action: { type: 'action', id: 'deploy-github' },
    keywords: ['deploy', 'github', 'push', 'export', 'repo'],
  },
  {
    id: 'export-zip',
    label: 'Export as ZIP Archive',
    description: 'Download the scaffold as a ZIP file',
    category: 'action',
    icon: <Download size={14} className="text-sky-400" />,
    action: { type: 'action', id: 'export-zip' },
    keywords: ['export', 'zip', 'download', 'scaffold'],
  },
  {
    id: 'format-code',
    label: 'Format Current File',
    description: 'Auto-format with Prettier conventions',
    category: 'action',
    icon: <Terminal size={14} className="text-emerald-400" />,
    action: { type: 'action', id: 'format-code' },
    keywords: ['format', 'prettier', 'indent', 'clean'],
  },
  {
    id: 'settings',
    label: 'Open Studio Settings',
    description: 'Configure model preferences and display',
    category: 'action',
    icon: <Settings size={14} className="text-gray-400" />,
    action: { type: 'action', id: 'settings' },
    keywords: ['settings', 'config', 'preferences'],
  },
];

const MODEL_ITEMS: CommandItem[] = [
  {
    id: 'model-nemotron',
    label: 'Switch to Nemotron 3 Ultra 550B',
    description: 'NVIDIA NIM — Best for architectural planning',
    category: 'model',
    icon: <Cpu size={14} className="text-green-400" />,
    action: { type: 'model', modelKey: 'nemotron-3-550b' },
    keywords: ['nemotron', 'nvidia', '550b', 'planning'],
  },
  {
    id: 'model-gemini-flash',
    label: 'Switch to Gemini 3.5 Flash',
    description: 'Google AI — Ultra fast, great for iteration',
    category: 'model',
    icon: <Cpu size={14} className="text-blue-400" />,
    action: { type: 'model', modelKey: 'gemini-3.5-flash' },
    keywords: ['gemini', 'flash', 'google', 'fast'],
  },
  {
    id: 'model-kimi',
    label: 'Switch to Kimi K2.6',
    description: 'Moonshot AI — Precision code synthesis',
    category: 'model',
    icon: <Cpu size={14} className="text-violet-400" />,
    action: { type: 'model', modelKey: 'kimi-k2.6' },
    keywords: ['kimi', 'moonshot', 'code', 'synthesis'],
  },
  {
    id: 'model-glm',
    label: 'Switch to GLM 5.2',
    description: 'Z-AI — Deep context ingestion',
    category: 'model',
    icon: <Cpu size={14} className="text-sky-400" />,
    action: { type: 'model', modelKey: 'glm-5.2' },
    keywords: ['glm', 'z-ai', 'context', 'ingestion'],
  },
];

const QUICK_PROMPTS: CommandItem[] = [
  {
    id: 'prompt-add-auth',
    label: 'Add authentication guard',
    description: 'Wrap routes with auth middleware and login redirect',
    category: 'prompt',
    icon: <Sparkles size={14} className="text-amber-400" />,
    action: { type: 'prompt', prompt: 'Add authentication guard to all protected routes with login redirect' },
    keywords: ['auth', 'guard', 'login', 'protect'],
  },
  {
    id: 'prompt-dark-mode',
    label: 'Add dark mode toggle',
    description: 'Implement system-aware dark/light theme switcher',
    category: 'prompt',
    icon: <Sparkles size={14} className="text-purple-400" />,
    action: { type: 'prompt', prompt: 'Add a dark mode toggle with system preference detection and smooth transition' },
    keywords: ['dark', 'mode', 'theme', 'toggle', 'light'],
  },
  {
    id: 'prompt-responsive',
    label: 'Make responsive for mobile',
    description: 'Add mobile breakpoints and hamburger menu',
    category: 'prompt',
    icon: <Sparkles size={14} className="text-emerald-400" />,
    keywords: ['responsive', 'mobile', 'breakpoint', 'hamburger'],
    action: { type: 'prompt', prompt: 'Make the UI fully responsive with mobile breakpoints, collapsible sidebar, and hamburger menu' },
  },
  {
    id: 'prompt-loading',
    label: 'Add loading skeletons',
    description: 'Replace spinners with shimmer skeleton placeholders',
    category: 'prompt',
    icon: <Sparkles size={14} className="text-cyan-400" />,
    action: { type: 'prompt', prompt: 'Replace loading spinners with animated shimmer skeleton placeholders for all data-fetching components' },
    keywords: ['loading', 'skeleton', 'shimmer', 'placeholder'],
  },
];

// ─── Category Labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  file: 'FILES',
  action: 'ACTIONS',
  model: 'MODELS',
  prompt: 'QUICK PROMPTS',
};

const CATEGORY_ORDER: string[] = ['file', 'action', 'model', 'prompt'];

// ─── Main Component ───────────────────────────────────────────────────────────

export function CommandPalette({
  isOpen,
  onClose,
  onAction,
  filePaths = [],
  appName,
  isAgentBusy = false,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build file items from VFS paths
  const fileItems = useMemo<CommandItem[]>(
    () =>
      filePaths
        .filter((p) => p !== 'preview.html')
        .map((path) => ({
          id: `file-${path}`,
          label: path.split('/').pop() || path,
          description: path,
          category: 'file' as const,
          icon: getFileIcon(path),
          action: { type: 'file' as const, path },
          keywords: path.split(/[/.\-_]/).filter(Boolean),
        })),
    [filePaths]
  );

  // Merge all items
  const allItems = useMemo(
    () => [...fileItems, ...STUDIO_ACTIONS, ...MODEL_ITEMS, ...QUICK_PROMPTS],
    [fileItems]
  );

  // Filter & sort by fuzzy score
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // Default: show actions first, then files, then models, then prompts
      return [...STUDIO_ACTIONS.slice(0, 4), ...fileItems.slice(0, 6), ...MODEL_ITEMS.slice(0, 2), ...QUICK_PROMPTS.slice(0, 2)];
    }

    return allItems
      .map((item) => {
        const labelMatch = fuzzyMatch(query, item.label);
        const descMatch = item.description ? fuzzyMatch(query, item.description) : { match: false, score: 0 };
        const kwMatch = (item.keywords || []).reduce(
          (best, kw) => {
            const m = fuzzyMatch(query, kw);
            return m.score > best.score ? m : best;
          },
          { match: false, score: 0 }
        );

        const bestScore = Math.max(labelMatch.score, descMatch.score, kwMatch.score);
        const isMatch = labelMatch.match || descMatch.match || kwMatch.match;

        return { item, score: bestScore, isMatch };
      })
      .filter((r) => r.isMatch)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.item)
      .slice(0, 20);
  }, [query, allItems, fileItems]);

  // Group by category for rendering
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filteredItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return CATEGORY_ORDER.filter((cat) => groups[cat]?.length).map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: groups[cat],
    }));
  }, [filteredItems]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => groupedItems.flatMap((g) => g.items), [groupedItems]);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a single animation frame to let the modal mount
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Clamp index when list changes
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      onAction(item.action);
      onClose();
    },
    [onAction, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatItems.length));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            handleSelect(flatItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, selectedIndex, handleSelect, onClose]
  );

  let flatIdx = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cmd-palette-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette Modal */}
          <motion.div
            key="cmd-palette-modal"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
            className="fixed top-[18%] left-1/2 -translate-x-1/2 z-[10000] w-[min(580px,92vw)]"
          >
            <div
              className="rounded-2xl border border-white/[0.08] bg-[#0c0c10]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden"
              onKeyDown={handleKeyDown}
            >
              {/* ── Search Input ────────────────────────────────────────── */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                <Search size={16} className="text-gray-500 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder={appName ? `Search ${appName} workspace…` : 'Search files, actions, models…'}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none font-sans"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-[10px] font-mono text-gray-500">
                  ESC
                </kbd>
              </div>

              {/* ── Results List ────────────────────────────────────────── */}
              <div
                ref={listRef}
                className="max-h-[380px] overflow-y-auto custom-scrollbar py-2"
              >
                {flatItems.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-500 font-sans">No results found for "{query}"</p>
                    <p className="text-xs text-gray-600 mt-1 font-sans">Try a different keyword or file name</p>
                  </div>
                ) : (
                  groupedItems.map((group) => (
                    <div key={group.category} className="mb-1">
                      {/* Category Header */}
                      <div className="px-4 py-1.5 flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest">
                          {group.label}
                        </span>
                        <div className="flex-1 h-px bg-white/[0.04]" />
                      </div>

                      {/* Items */}
                      {group.items.map((item) => {
                        const idx = flatIdx++;
                        const isSelected = idx === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            data-selected={isSelected}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                              isSelected
                                ? 'bg-indigo-500/[0.12] text-white'
                                : 'text-gray-300 hover:bg-white/[0.04]'
                            }`}
                          >
                            <span
                              className={`shrink-0 p-1 rounded-md ${
                                isSelected ? 'bg-indigo-500/20' : 'bg-white/[0.04]'
                              }`}
                            >
                              {item.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium truncate font-sans">
                                {item.label}
                              </div>
                              {item.description && (
                                <div className="text-[11px] text-gray-500 truncate font-sans">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono text-indigo-400">
                                <CornerDownLeft size={10} />
                                select
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* ── Footer Hints ────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                  <span className="flex items-center gap-1">
                    <ChevronUp size={10} />
                    <ChevronDown size={10} />
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <CornerDownLeft size={10} />
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    esc close
                  </span>
                </div>
                {isAgentBusy && (
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Agent running
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
