import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  FileCode,
  FileText,
  FileJson,
  Database,
  FileCode2,
  Settings,
  Search,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
  Layers,
  Palette,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VFSFile } from '../context/VFSContext';

interface WorkspaceFileTreeProps {
  files: Record<string, string> | VFSFile[];
  activeFilePath?: string | null;
  onSelectFile: (path: string) => void;
  isLoading?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: TreeNode[];
}

function buildFileTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const path of paths) {
    const parts = path.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let existingNode = currentLevel.find((node) => node.name === part);
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: isLast ? undefined : [],
        };
        currentLevel.push(existingNode);

        // Sort folders first, then alphabetical
        currentLevel.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });
      }
      if (!isLast && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  return root;
}

function getFileIcon(name: string, size = 13) {
  const lower = name.toLowerCase();
  const ext = lower.split('.').pop() ?? '';

  if (lower === '.env' || lower.startsWith('.env.') || lower === '.gitignore') {
    return <Settings size={size} className="text-zinc-400 shrink-0" />;
  }
  if (lower === 'package.json' || lower === 'tsconfig.json' || ext === 'json') {
    return <FileJson size={size} className="text-amber-400 shrink-0" />;
  }
  if (ext === 'tsx' || ext === 'jsx') {
    return <FileCode2 size={size} className="text-cyan-400 shrink-0" />;
  }
  if (ext === 'ts' || ext === 'js') {
    return <FileCode size={size} className="text-blue-400 shrink-0" />;
  }
  if (ext === 'css' || ext === 'scss' || ext === 'tailwind') {
    return <Palette size={size} className="text-pink-400 shrink-0" />;
  }
  if (ext === 'sql' || ext === 'prisma' || lower.includes('schema')) {
    return <Database size={size} className="text-emerald-400 shrink-0" />;
  }
  if (ext === 'md' || ext === 'txt' || ext === 'html') {
    return <FileText size={size} className="text-sky-400 shrink-0" />;
  }
  return <FileText size={size} className="text-zinc-400 shrink-0" />;
}

export const WorkspaceFileTree: React.FC<WorkspaceFileTreeProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  isLoading = false,
}) => {
  // Normalize input into an array of file paths
  const filePaths = useMemo(() => {
    const raw = Array.isArray(files)
      ? files.map((f) => f.path)
      : Object.keys(files || {});
    return raw.filter((p) => p !== 'preview.html');
  }, [files]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Filter paths by search query if present
  const filteredPaths = useMemo(() => {
    if (!searchQuery.trim()) return filePaths;
    const q = searchQuery.toLowerCase();
    return filePaths.filter((p) => p.toLowerCase().includes(q));
  }, [filePaths, searchQuery]);

  const tree = useMemo(() => {
    return buildFileTree(filteredPaths);
  }, [filteredPaths]);

  // Auto-expand folder ancestors when activeFilePath changes
  useEffect(() => {
    if (!activeFilePath) return;
    const parts = activeFilePath.split('/');
    if (parts.length <= 1) return;

    let acc = '';
    const toExpand: Record<string, boolean> = {};
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      toExpand[acc] = false; // false = expanded
    }

    setCollapsedFolders((prev) => ({
      ...prev,
      ...toExpand,
    }));
  }, [activeFilePath]);

  const toggleFolder = useCallback((folderPath: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedFolders({});
  }, []);

  const collapseAll = useCallback(() => {
    const allCollapsed: Record<string, boolean> = {};
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          allCollapsed[node.path] = true;
          if (node.children) traverse(node.children);
        }
      }
    };
    traverse(tree);
    setCollapsedFolders(allCollapsed);
  }, [tree]);

  // STATE 1: Loading Skeleton
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span className="text-xs font-mono text-indigo-300 font-semibold tracking-wide">
              INITIALIZING VFS...
            </span>
          </div>
        </div>
        <div className="space-y-1.5 pt-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.03] animate-pulse"
            >
              <div className="w-3.5 h-3.5 rounded bg-white/10 shrink-0" />
              <div
                className="h-2.5 rounded bg-white/10"
                style={{ width: `${Math.floor(35 + ((i * 19) % 50))}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STATE 2: Empty State
  if (filePaths.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-xs font-mono">
        <Layers size={20} className="text-zinc-600 mb-2 stroke-[1.5]" />
        <span>No workspace files</span>
      </div>
    );
  }

  // Render tree node recursively with high-precision indentation lines
  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const indent = depth * 12;

      if (node.isFolder) {
        const isCollapsed = Boolean(collapsedFolders[node.path]);
        return (
          <div key={node.path} className="flex flex-col select-none">
            <button
              type="button"
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${indent + 6}px` }}
              className="w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-all group text-xs font-sans font-medium"
            >
              <span className={`text-zinc-500 group-hover:text-zinc-300 transition-transform duration-150 shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}>
                <ChevronRight size={11} />
              </span>
              <span className="text-amber-400/90 shrink-0">
                {isCollapsed ? <Folder size={13} className="fill-amber-400/10" /> : <FolderOpen size={13} className="fill-amber-400/20 text-amber-300" />}
              </span>
              <span className="truncate tracking-tight text-zinc-200 group-hover:text-white text-[12px] font-medium">
                {node.name}
              </span>
            </button>

            {!isCollapsed && node.children && (
              <div className="relative flex flex-col border-l border-white/[0.06] ml-[11px] pl-1 my-0.5">
                {renderTreeNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      const isSelected = activeFilePath === node.path;
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => onSelectFile(node.path)}
          style={{ paddingLeft: `${indent + 6}px` }}
          className={`w-full flex items-center gap-2 py-1.5 pr-2.5 rounded-lg text-left transition-all text-xs font-mono group relative ${
            isSelected
              ? 'bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-transparent text-white font-semibold border-l-2 border-indigo-400 shadow-sm shadow-indigo-500/5'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]'
          }`}
          title={node.path}
        >
          {getFileIcon(node.name, 13)}
          <span className={`truncate flex-1 text-[11px] tracking-tight ${isSelected ? 'text-white font-semibold' : 'text-zinc-300 group-hover:text-white'}`}>
            {node.name}
          </span>
          {isSelected && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
          )}
        </button>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090a10] select-none">
      {/* ── Sleek Glassmorphic Explorer Header ── */}
      <div className="px-3 py-2.5 border-b border-white/[0.08] bg-white/[0.01] shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Layers size={11} className="text-indigo-400" />
            </div>
            <span className="text-[11px] font-bold font-sans tracking-wide text-zinc-200 uppercase">
              Workspace Files
            </span>
          </div>

          {/* Action Icons: File count, Search, Collapse/Expand */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-md">
              {filePaths.length}
            </span>

            <button
              type="button"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className={`p-1 rounded-md transition-colors ${
                isSearchOpen || searchQuery
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`}
              title="Search files in workspace"
            >
              <Search size={12} />
            </button>

            <button
              type="button"
              onClick={expandAll}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] rounded-md transition-colors"
              title="Expand all folders"
            >
              <ChevronsUpDown size={12} />
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] rounded-md transition-colors"
              title="Collapse all folders"
            >
              <ChevronsDownUp size={12} />
            </button>
          </div>
        </div>

        {/* Expandable Search Input */}
        <AnimatePresence>
          {(isSearchOpen || searchQuery) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative overflow-hidden pt-0.5"
            >
              <Search size={11} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter files..."
                className="w-full pl-7 pr-6 py-1 bg-black/40 border border-white/10 hover:border-white/20 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 rounded-lg text-[11px] font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={11} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Hierarchical Tree View Content ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
        {filteredPaths.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs font-mono">
            No matching files
          </div>
        ) : (
          renderTreeNodes(tree)
        )}
      </div>
    </div>
  );
};
