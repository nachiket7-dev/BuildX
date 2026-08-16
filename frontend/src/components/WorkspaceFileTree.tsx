import React from 'react';
import {
  FileCode,
  FileText,
  FileJson,
  Database,
} from 'lucide-react';
import type { VFSFile } from '../context/VFSContext';

interface WorkspaceFileTreeProps {
  files: Record<string, string> | VFSFile[];
  activeFilePath?: string | null;
  onSelectFile: (path: string) => void;
  isLoading?: boolean;
}

function getFileIcon(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode size={13} className="text-cyan-400 shrink-0" />;
    case 'json':
      return <FileJson size={13} className="text-amber-400 shrink-0" />;
    case 'sql':
    case 'prisma':
      return <Database size={13} className="text-sylven-light shrink-0" />;
    case 'md':
      return <FileText size={13} className="text-norvin-silver shrink-0" />;
    default:
      return <FileText size={13} className="text-norvin-muted shrink-0" />;
  }
}

export const WorkspaceFileTree: React.FC<WorkspaceFileTreeProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  isLoading = false,
}) => {
  // Normalize input into an array of file objects
  const filePaths = Array.isArray(files)
    ? files.map(f => f.path)
    : Object.keys(files);

  const visiblePaths = filePaths.filter(p => p !== 'preview.html');

  // STATE 1: Loading Skeleton State (high-tech VFS tree scaffolding loader)
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-obsidian-borderSubtle">
          <span className="text-xs font-mono text-sylven-light animate-pulse font-semibold">
            01 / SCAFFOLDING VFS TREE...
          </span>
        </div>
        <div className="space-y-2 pt-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-obsidian-panel animate-pulse"
            >
              <div className="w-3.5 h-3.5 rounded bg-white/10 shrink-0" />
              <div
                className="h-3 rounded bg-white/10"
                style={{ width: `${Math.floor(40 + (i * 17) % 45)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STATE 3: Truly Empty (only when loading complete and no files exist)
  if (visiblePaths.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-xs font-mono px-3">
        No workspace files found.
      </div>
    );
  }

  // STATE 2: Loaded with Files
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
      {visiblePaths.map(filePath => {
        const isSelected = activeFilePath === filePath;
        const fileName = filePath.split('/').pop() || filePath;
        const dirPath = filePath.includes('/')
          ? filePath.substring(0, filePath.lastIndexOf('/'))
          : '';

        return (
          <button
            key={filePath}
            onClick={() => onSelectFile(filePath)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors group font-mono text-xs ${
              isSelected
                ? 'bg-sylven/20 text-sylven-light font-semibold border border-sylven/40 shadow-sm shadow-emerald-500/10'
                : 'text-norvin-muted hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {getFileIcon(filePath)}
            <div className="truncate flex-1 min-w-0">
              <span className="truncate block leading-tight">{fileName}</span>
              {dirPath && (
                <span className="text-[9px] text-zinc-500 block truncate group-hover:text-zinc-400">
                  {dirPath}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
