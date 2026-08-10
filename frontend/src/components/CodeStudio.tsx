import React, { useState, useEffect, useCallback } from 'react';
import type { Blueprint } from '../lib/types';
import { escapeHtml, formatSQL } from '../lib/utils';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileJson, 
  FileText, 
  Database,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Download,
  Copy,
  Check,
  X,
  Play,
  Cpu,
  GitCompare,
  CheckCircle2,
  XCircle,
  Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';
import { getAuthHeaders } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

function getFileIcon(name: string, size = 14) {
  if (name.endsWith('.sql') || name === 'schema.js' || name === 'mongoose.ts') {
    return <Database size={size} className="text-purple-400" />;
  }
  if (name.endsWith('.tsx') || name.endsWith('.ts')) {
    return <FileCode size={size} className="text-blue-400" />;
  }
  if (name.endsWith('.json')) {
    return <FileJson size={size} className="text-amber-400" />;
  }
  if (name.endsWith('.md')) {
    return <FileText size={size} className="text-emerald-400" />;
  }
  return <FileCode size={size} className="text-gray-400" />;
}

interface CodeStudioProps {
  blueprint: Blueprint;
  blueprintId?: string | null;
  blueprintContentKey?: string;
  onRefineMessage?: (msg: string) => void;
  isRefining?: boolean;
  codegen: any;
}

interface VirtualFile {
  path: string;
  name: string;
  folder: string;
  language: 'tsx' | 'ts' | 'sql' | 'json' | 'md' | 'js' | 'javascript';
  content: string;
  icon: string;
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
      
      let existingNode = currentLevel.find(node => node.name === part);
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: isLast ? undefined : []
        };
        currentLevel.push(existingNode);
        
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

function highlightCode(code: string, language: string): string {
  if (!code) return '';
  let esc = escapeHtml(code);

  if (language === 'sql') {
    esc = esc.replace(
      /\b(CREATE TABLE|PRIMARY KEY|DEFAULT|NOT NULL|UNIQUE|FOREIGN KEY|REFERENCES|UUID|VARCHAR|INTEGER|BOOLEAN|TIMESTAMP|WITH TIME ZONE|CHECK|INDEX|IF NOT EXISTS|ALTER TABLE|ADD CONSTRAINT)\b/gi,
      '<span class="text-purple-400 font-semibold">$1</span>'
    );
    esc = esc.replace(
      /\b(gen_random_uuid|now|CURRENT_TIMESTAMP)\b/gi,
      '<span class="text-amber-300 font-mono">$1</span>'
    );
  } else if (language === 'tsx' || language === 'ts' || language === 'js' || language === 'javascript') {
    esc = esc.replace(
      /\b(import|export|from|default|const|let|var|function|return|if|else|switch|case|async|await|try|catch|type|interface|extends|implements|typeof)\b/g,
      '<span class="text-purple-400 font-semibold">$1</span>'
    );
    esc = esc.replace(
      /\b(useState|useEffect|useCallback|useMemo|useRef|useQuery|useMutation|Router|Request|Response)\b/g,
      '<span class="text-blue-400 font-semibold">$1</span>'
    );
    esc = esc.replace(
      /(&lt;\/?[a-zA-Z0-9]+(?:\s+[^&]*)?\/?&gt;)/g,
      '<span class="text-indigo-300">$1</span>'
    );
  }

  esc = esc.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="text-emerald-300">$1</span>');
  esc = esc.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500 italic">$1</span>');

  return esc;
}

export function CodeStudio({
  blueprint,
  blueprintId,
  blueprintContentKey,
  onRefineMessage,
  isRefining,
  codegen
}: CodeStudioProps) {
  const { toast } = useToast();
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  
  // Side-by-Side Diff Editor Mode State
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [modifiedDrafts, setModifiedDrafts] = useState<Record<string, string>>({});
  // Glow flash on patch apply
  const [patchFlash, setPatchFlash] = useState(false);

  const triggerPatchFlash = () => {
    setPatchFlash(true);
    setTimeout(() => setPatchFlash(false), 600);
  };

  const {
    isGenerating,
    progress: codegenProgress,
    files: generatedFilesMap,
    generateCode,
    loadGeneratedFiles,
    saveFileContent
  } = codegen;

  const { user } = useAuth();

  const PipelineStatusIndicator = () => (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 font-mono-custom select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span>Autonomous Multi-Model Pipeline</span>
    </div>
  );

  useEffect(() => {
    if (blueprintId && !isGenerating) {
      loadGeneratedFiles(blueprintId);
    }
  }, [blueprintId, blueprintContentKey, loadGeneratedFiles, isGenerating]);

  const isMongo = (blueprint.architecture?.database || '').toLowerCase().includes('mongo');

  const unescapeString = (str: string) => {
    if (!str) return '';
    let result = str;
    result = result.replace(/\\\\n/g, '\\n');
    result = result.replace(/\\\\t/g, '\\t');
    result = result.replace(/\\\\"/g, '\\"');
    result = result.replace(/\\n/g, '\n');
    result = result.replace(/\\t/g, '\t');
    result = result.replace(/\\"/g, '"');
    result = result.replace(/\\\\/g, '\\');
    return result;
  };

  const generateFallbackMongooseCode = (): string => {
    const schema = blueprint.schema || [];
    if (schema.length === 0) return '// No schema defined';
    const lines: string[] = ["const mongoose = require('mongoose');", ''];
    for (const table of schema) {
      const modelName = (table.table || 'Model').charAt(0).toUpperCase() +
        (table.table || 'model').slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      lines.push(`// ── ${modelName} ─────────────────────────`);
      lines.push(`const ${modelName}Schema = new mongoose.Schema({`);
      for (const col of (table.columns || [])) {
        if (col.name === '_id' || col.name === 'id') continue;
        const t = col.type.toUpperCase();
        let mongoType = 'String';
        if (t.includes('OBJECTID')) mongoType = 'mongoose.Schema.Types.ObjectId';
        else if (t.includes('INT') || t.includes('FLOAT') || t.includes('DECIMAL') || t === 'NUMBER') mongoType = 'Number';
        else if (t.includes('BOOL')) mongoType = 'Boolean';
        else if (t.includes('DATE') || t.includes('TIMESTAMP')) mongoType = 'Date';
        else if (t.includes('JSON') || t.includes('MIXED')) mongoType = 'mongoose.Schema.Types.Mixed';

        const noteStr = col.note || '';
        const noteLower = noteStr.toLowerCase();
        const extras: string[] = [];
        if (noteLower.includes('unique')) extras.push('unique: true');
        if (noteLower.includes('required') || noteLower.includes('not null')) extras.push('required: true');
        const refMatch = noteStr.match(/ref:\s*(\w+)/i);
        if (refMatch) {
          const refModel = refMatch[1].charAt(0).toUpperCase() + refMatch[1].slice(1);
          lines.push(`  ${col.name}: { type: mongoose.Schema.Types.ObjectId, ref: '${refModel}' },`);
        } else if (extras.length > 0) {
          lines.push(`  ${col.name}: { type: ${mongoType}, ${extras.join(', ')} },`);
        } else {
          lines.push(`  ${col.name}: ${mongoType},`);
        }
      }
      lines.push('}, { timestamps: true });');
      lines.push('');
      lines.push(`const ${modelName} = mongoose.model('${modelName}', ${modelName}Schema);`);
      lines.push('');
    }
    const exports = schema.map(t => {
      const n = (t.table || 'Model').charAt(0).toUpperCase() +
        (t.table || 'model').slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      return n;
    });
    lines.push(`module.exports = { ${exports.join(', ')} };`);
    return lines.join('\n');
  };

  const getSchemaCode = (): string => {
    const raw = unescapeString(blueprint.code?.sql || '');
    if (raw.trim() && raw.trim() !== '-- No SQL generated') return isMongo ? raw : formatSQL(raw);
    if (isMongo) return generateFallbackMongooseCode();
    return raw || '-- No SQL generated';
  };

  const hasDbGeneratedCode = Object.keys(generatedFilesMap).length > 0;

  const files: VirtualFile[] = React.useMemo(() => {
    if (hasDbGeneratedCode) {
      return Object.entries(generatedFilesMap).map(([path, content]) => {
        const name = path.split('/').pop() || path;
        const ext = path.split('.').pop() || 'txt';
        const langMap: Record<string, VirtualFile['language']> = {
          ts: 'ts',
          tsx: 'tsx',
          sql: 'sql',
          json: 'json',
          md: 'md',
          js: 'js'
        };
        return {
          path,
          name,
          folder: path.split('/')[0] || 'root',
          language: langMap[ext] || 'ts',
          content: String(content ?? ''),
          icon: ext
        };
      });
    }

    const legacy: VirtualFile[] = [
      {
        path: isMongo ? 'backend/schema.js' : 'backend/schema.sql',
        name: isMongo ? 'schema.js' : 'schema.sql',
        folder: 'backend',
        language: isMongo ? 'js' : 'sql',
        content: getSchemaCode(),
        icon: isMongo ? 'js' : 'sql',
      },
      {
        path: 'frontend/src/App.tsx',
        name: 'App.tsx',
        folder: 'frontend',
        language: 'tsx',
        content: unescapeString(blueprint.code?.frontend || '// No frontend code available'),
        icon: 'tsx',
      },
      {
        path: 'backend/src/app.ts',
        name: 'app.ts',
        folder: 'backend',
        language: 'ts',
        content: unescapeString(blueprint.code?.backend || '// No backend code available'),
        icon: 'ts',
      },
    ];
    return legacy;
  }, [hasDbGeneratedCode, generatedFilesMap, blueprint, isMongo]);

  useEffect(() => {
    if (files.length > 0 && (!activeFilePath || !files.some((f) => f.path === activeFilePath))) {
      setActiveFilePath(files[0].path);
      if (!openFiles.includes(files[0].path)) {
        setOpenFiles((prev) => [...prev, files[0].path]);
      }
    }
  }, [files, activeFilePath, openFiles]);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  const handleOpenFile = (path: string) => {
    if (!openFiles.includes(path)) {
      setOpenFiles((prev) => [...prev, path]);
    }
    setActiveFilePath(path);
  };

  const handleCloseFile = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = openFiles.filter((p) => p !== path);
    setOpenFiles(filtered);
    if (activeFilePath === path) {
      if (filtered.length > 0) {
        setActiveFilePath(filtered[filtered.length - 1]);
      } else {
        setActiveFilePath('');
      }
    }
  };

  const handleCopyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    toast('Code copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const url = blueprintId
        ? `${BASE_URL}/api/blueprint/export?id=${blueprintId}`
        : `${BASE_URL}/api/blueprint/export`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: blueprintId ? undefined : JSON.stringify(blueprint),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${blueprint.appName.toLowerCase().replace(/\s+/g, '-')}-scaffold.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Scaffold ZIP downloaded successfully', 'success');
    } catch (err) {
      toast('Export failed — try again', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  const buildedTree = buildFileTree(files.map(f => f.path));

  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    return nodes.map(node => {
      const indent = depth * 12;
      if (node.isFolder) {
        const isCollapsed = collapsedFolders[node.path];
        return (
          <div key={node.path} className="space-y-1">
            <button
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${indent + 8}px` }}
              className="w-full text-left py-1.5 text-muted-foreground hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-1.5 transition-colors font-semibold font-mono-custom text-xs"
            >
              {isCollapsed ? (
                <ChevronRight size={12} className="text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown size={12} className="text-muted-foreground shrink-0" />
              )}
              {isCollapsed ? (
                <Folder size={14} className="text-purple-400/80 shrink-0" />
              ) : (
                <FolderOpen size={14} className="text-purple-400/80 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {!isCollapsed && node.children && (
              <div className="space-y-1">
                {renderTreeNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      } else {
        const isSelected = activeFilePath === node.path;
        return (
          <button
            key={node.path}
            onClick={() => handleOpenFile(node.path)}
            style={{ paddingLeft: `${indent + 24}px` }}
            className={`w-full text-left py-1.5 rounded-lg flex items-center gap-2 transition-colors font-mono-custom text-xs ${
              isSelected
                ? 'bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-purple-500 rounded-l-none'
                : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
          >
            {getFileIcon(node.name, 14)}
            <span className="truncate">{node.name}</span>
          </button>
        );
      }
    });
  };

  const handleSubmitRefine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim() || isRefining || !onRefineMessage) return;
    onRefineMessage(refineInput);
    setRefineInput('');
  };

  const hasGeneratedCode = hasDbGeneratedCode;

  if (codegenProgress.status === 'loading' && !hasGeneratedCode && !isGenerating) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-bg-surface text-center py-20 min-h-[480px]">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading generated code files…</p>
      </div>
    );
  }

  if (codegenProgress.status === 'error' && !hasGeneratedCode && !isGenerating) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-red-500/20 bg-bg-surface text-center py-20 min-h-[480px]">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 mb-6 shrink-0">
          <X size={32} />
        </div>
        <h2 className="font-display font-bold text-xl text-white mb-3">Code Generation Failed</h2>
        <p className="text-muted-foreground text-sm max-w-lg mb-8 leading-relaxed">
          {codegenProgress.error || 'Something went wrong while generating or loading code.'}
        </p>
        {blueprintId && user && (
          <button
            onClick={() => generateCode(blueprintId)}
            className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl text-sm font-semibold border border-purple-500/30 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!hasGeneratedCode && !isGenerating && files.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-bg-surface text-center py-20 min-h-[480px]">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 mb-6 shrink-0 shadow-lg shadow-purple-500/5">
          <Sparkles size={32} className="animate-pulse text-purple-400" />
        </div>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-white mb-3">
          Generate Full Application Codebase
        </h2>
        <p className="text-muted-foreground text-sm max-w-lg mb-8 leading-relaxed">
          Transform your architecture blueprint specifications into complete, functional source code files. Writes backend endpoints, database integration routes, schemas, and modern React components.
        </p>

        {blueprintId ? (
          user ? (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => generateCode(blueprintId)}
                className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-display font-semibold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/20"
              >
                <Play size={16} fill="currentColor" />
                Start Code Generation
              </button>
              <div className="mt-4 flex items-center justify-center gap-2">
                <PipelineStatusIndicator />
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-xl max-w-sm text-amber-400/90 text-xs font-medium">
              Sign in to generate a full application codebase from this blueprint.
            </div>
          )
        ) : (
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-xl max-w-sm text-amber-400/90 text-xs font-medium">
            ⚠️ Save this blueprint to unlock the codebase generator and preview sandbox.
          </div>
        )}
      </div>
    );
  }

  if (isGenerating) {
    const percent = codegenProgress.totalFiles > 0
      ? Math.round((codegenProgress.currentFileIndex / codegenProgress.totalFiles) * 100)
      : 0;
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-bg-surface text-center py-20 min-h-[480px]">
        <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-8 flex items-center justify-center shrink-0" />
        <h3 className="font-display font-bold text-lg text-white mb-2">
          Generating Application Files...
        </h3>
        <p className="text-xs text-purple-400 font-mono-custom mb-6">
          {codegenProgress.currentFilePath || 'Connecting to Multi-Model Pipeline...'}
        </p>

        <div className="w-full max-w-xs bg-white/5 rounded-full h-1.5 overflow-hidden mb-3">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground font-mono-custom">
          File {codegenProgress.currentFileIndex} of {codegenProgress.totalFiles} ({percent}%)
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row rounded-xl border border-white/10 bg-[#111116] overflow-hidden h-full w-full">
      {/* File Tree Explorer (Left) */}
      <div className="w-full md:w-64 bg-[#0e0e14] border-b md:border-b-0 md:border-r border-white/10 flex flex-col h-44 md:h-full shrink-0 select-none">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <span className="font-mono text-[10px] text-zinc-400 font-bold tracking-wider uppercase truncate">
            Workspace
          </span>
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded hover:bg-purple-500/20 hover:text-purple-300 font-mono flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50 whitespace-nowrap"
          >
            {downloading ? (
              <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={10} />
            )}
            {downloading ? 'Exporting...' : 'Download All'}
          </button>
        </div>

        {/* Tree items */}
        <div className="flex-1 p-2 overflow-y-auto space-y-1.5 font-mono text-xs">
          {renderTreeNodes(buildedTree)}
        </div>
      </div>

      {/* Editor & View Area (Center) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#08080c] min-h-0 md:h-full relative">
        {/* Editor Gliding Tabs (01 CODE | 02 DIFFS | 03 PREVIEW) & Actions */}
        <div className="h-11 bg-[#111116] border-b border-white/10 px-3 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] relative" role="tablist">
            {[
              { id: 'code', label: '01 CODE' },
              { id: 'diffs', label: '02 DIFFS' },
            ].map((tabItem) => {
              const isActive = (tabItem.id === 'diffs' && isDiffMode) || (tabItem.id === 'code' && !isDiffMode);
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (tabItem.id === 'diffs') setIsDiffMode(true);
                    if (tabItem.id === 'code') setIsDiffMode(false);
                  }}
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors z-10 ${
                    isActive ? 'text-white' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="studioActiveTab"
                      className="absolute inset-0 rounded-lg bg-indigo-500/20 border border-indigo-500/30"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{tabItem.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right-side action controls */}
          <div className="flex items-center gap-2 pr-2 ml-auto">
            <PipelineStatusIndicator />
            <div className="w-px h-4 bg-white/10 shrink-0" />
            <div className="flex items-center gap-1.5">
              {activeFile && (
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-1 transition-colors text-xs font-medium shrink-0"
                  title="Copy file content"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Editor content / Side-by-Side Diff Editor */}
        <div className="flex-1 p-4 overflow-auto font-mono-custom text-xs text-white leading-relaxed relative min-h-0">
          {/* Patch-apply glow flash overlay */}
          <AnimatePresence>
            {patchFlash && (
              <motion.div
                key="patch-flash"
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="absolute inset-0 z-20 pointer-events-none rounded-xl"
                style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.25) 0%, transparent 70%)' }}
              />
            )}
          </AnimatePresence>
          {activeFile ? (
            isDiffMode ? (
              /* Side-by-Side Diff View */
              <div className="h-full flex flex-col gap-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs">
                  <div className="flex items-center gap-2">
                    <GitCompare size={14} className="text-indigo-400" />
                    <span>Search/Replace Patch Comparison — <strong>{activeFile.name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        toast('Diff patch accepted', 'success');
                        triggerPatchFlash();
                        setIsDiffMode(false);
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 text-[11px] font-bold"
                    >
                      <CheckCircle2 size={12} /> Accept Patch
                    </button>
                    <button
                      onClick={() => {
                        toast('Diff patch rejected', 'info');
                        setIsDiffMode(false);
                      }}
                      className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center gap-1 text-[11px] font-bold"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 overflow-auto">
                  {/* Left Column: Original File */}
                  <div className="rounded-xl border border-white/10 bg-black/60 p-3 overflow-auto">
                    <div className="text-[10px] font-mono text-red-400 mb-2 font-bold uppercase tracking-wider">
                      Original File
                    </div>
                    <pre className="whitespace-pre tab-size-2 scrollbar-thin text-neutral-400">
                      <code>{activeFile.content}</code>
                    </pre>
                  </div>

                  {/* Right Column: Modified / Patch Preview */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3 overflow-auto">
                    <div className="text-[10px] font-mono text-emerald-400 mb-2 font-bold uppercase tracking-wider">
                      Patched Output (GLM-5.2)
                    </div>
                    <pre className="whitespace-pre tab-size-2 scrollbar-thin text-emerald-200">
                      <code>{modifiedDrafts[activeFile.path] || activeFile.content}</code>
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              /* Normal Editor View */
              <pre className="whitespace-pre tab-size-2 scrollbar-thin">
                <code
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(activeFile.content, activeFile.language)
                      .split('\n')
                      .map((line, i) => `<span class="text-muted-foreground select-none inline-block w-6 pr-2 mr-2 border-r border-white/5 text-right">${i + 1}</span>${line}`)
                      .join('\n'),
                  }}
                />
              </pre>
            )
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No files open. Select a file from the explorer.
            </div>
          )}
        </div>

        {/* AI Agent refinement bar at the bottom */}
        {onRefineMessage && (
          <form
            onSubmit={handleSubmitRefine}
            className="p-3 bg-bg-surface2 border-t border-white/5 flex items-center gap-2 shrink-0"
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-500/10 text-purple-400 shrink-0 border border-purple-500/20">
              <Sparkles size={13} className="text-purple-400 animate-pulse" />
            </div>
            <input
              type="text"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              placeholder={`Ask Agent to edit this workspace (e.g. "Add field to database schema")...`}
              disabled={isRefining}
              className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-muted-foreground"
            />
            <button
              type="submit"
              disabled={!refineInput.trim() || isRefining}
              className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-30 disabled:hover:bg-purple-500 text-white rounded-lg font-display text-[11px] font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            >
              {isRefining ? (
                <>
                  <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin-slow" />
                  Coding...
                </>
              ) : (
                'Modify'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
