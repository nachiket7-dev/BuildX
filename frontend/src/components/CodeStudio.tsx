import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { unifiedMergeView } from '@codemirror/merge';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { buildxEditorTheme, buildxSyntaxHighlighting, buildxExtensions } from './theme/buildxTheme';
import type { Blueprint } from '../lib/types';
import { formatSQL } from '../lib/utils';
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
  GitCompare,
  CheckCircle2,
  XCircle,
  Wand2,
  Terminal,
  MousePointerClick,
  FlaskConical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';
import { getAuthHeaders } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useVFS } from '../context/VFSContext';

// ─── Cursor-Style Inline Diff Theme for CodeMirror 6 ──────────────────────────

const cursorInlineDiffTheme = EditorView.theme({
  '&.cm-editor .cm-merge-inserted, &.cm-editor .cm-insertedLine, .cm-insertedLine': {
    backgroundColor: 'rgba(16, 185, 129, 0.15) !important',
    color: '#34D399 !important',
  },
  '&.cm-editor .cm-insertedText, .cm-insertedText': {
    backgroundColor: 'rgba(16, 185, 129, 0.28) !important',
    color: '#34D399 !important',
  },
  '&.cm-editor .cm-merge-deleted, &.cm-editor .cm-deletedLine, .cm-deletedLine, .cm-deletedChunk': {
    backgroundColor: 'rgba(239, 68, 68, 0.15) !important',
    color: '#F87171 !important',
    textDecoration: 'line-through !important',
  },
  '&.cm-editor .cm-deletedText, .cm-deletedText': {
    backgroundColor: 'rgba(239, 68, 68, 0.28) !important',
    color: '#F87171 !important',
    textDecoration: 'line-through !important',
  },
  '&.cm-editor .cm-changedLine, .cm-changedLine': {
    backgroundColor: 'rgba(16, 185, 129, 0.12) !important',
  },
  '&.cm-editor .cm-changedText, .cm-changedText': {
    backgroundColor: 'rgba(16, 185, 129, 0.25) !important',
  },
  '.cm-deletedChunk': {
    borderLeft: '3px solid #ef4444 !important',
  },
  '.cm-insertedChunk': {
    borderLeft: '3px solid #10b981 !important',
  },
});

// ─── File Icon Helper ──────────────────────────────────────────────────────────

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

// ─── Language Extension Helper for CodeMirror ─────────────────────────────────

function getLanguageExtension(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })];
    case 'ts':
      return [javascript({ typescript: true })];
    case 'jsx':
      return [javascript({ jsx: true })];
    case 'js':
      return [javascript()];
    case 'json':
      return [json()];
    case 'html':
      return [html()];
    case 'css':
      return [css()];
    case 'sql':
      return [sql()];
    default:
      return [javascript({ jsx: true, typescript: true })];
  }
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

      let existingNode = currentLevel.find((node) => node.name === part);
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: isLast ? undefined : [],
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

export function CodeStudio({
  blueprint,
  blueprintId,
  blueprintContentKey,
  onRefineMessage,
  isRefining: propIsRefining,
  codegen,
}: CodeStudioProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const vfs = useVFS();

  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [isAiModifying, setIsAiModifying] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // ─── AI Diff Review Overlay State ───────────────────────────────────────────
  const [pendingDiff, setPendingDiff] = useState<{
    original: string;
    modified: string;
    filePath?: string;
  } | null>(null);

  const [isDiffMode, setIsDiffMode] = useState(false);
  const [patchFlash, setPatchFlash] = useState(false);

  // ─── Diff Re-Key Counter: forces CodeMirror full re-mount when diff toggles ─
  const [diffKey, setDiffKey] = useState(0);

  // CodeMirror Editor View Reference for Bidirectional Inspection
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const editorViewRef = useRef<EditorView | null>(null);

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
  } = codegen;

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
      const modelName =
        (table.table || 'Model').charAt(0).toUpperCase() +
        (table.table || 'model').slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      lines.push(`// ── ${modelName} ─────────────────────────`);
      lines.push(`const ${modelName}Schema = new mongoose.Schema({`);
      for (const col of table.columns || []) {
        if (col.name === '_id' || col.name === 'id') continue;
        const t = col.type.toUpperCase();
        let mongoType = 'String';
        if (t.includes('OBJECTID')) mongoType = 'mongoose.Schema.Types.ObjectId';
        else if (t.includes('INT') || t.includes('FLOAT') || t.includes('DECIMAL') || t === 'NUMBER')
          mongoType = 'Number';
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
    const exports = schema.map((t) => {
      return (
        (t.table || 'Model').charAt(0).toUpperCase() +
        (t.table || 'model').slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
      );
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

  // Merge VFS files and codegen files
  const activeVfsFiles = vfs.files || {};
  const hasVfsCode = Object.keys(activeVfsFiles).length > 0;
  const hasDbGeneratedCode = Object.keys(generatedFilesMap || {}).length > 0;

  const files: VirtualFile[] = useMemo(() => {
    const combinedFilesMap: Record<string, string> = {
      ...generatedFilesMap,
      ...activeVfsFiles,
    };

    if (Object.keys(combinedFilesMap).length > 0) {
      return Object.entries(combinedFilesMap).map(([path, content]) => {
        const name = path.split('/').pop() || path;
        const ext = path.split('.').pop() || 'txt';
        const langMap: Record<string, VirtualFile['language']> = {
          ts: 'ts',
          tsx: 'tsx',
          sql: 'sql',
          json: 'json',
          md: 'md',
          js: 'js',
        };
        return {
          path,
          name,
          folder: path.split('/')[0] || 'root',
          language: langMap[ext] || 'ts',
          content: String(content ?? ''),
          icon: ext,
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
  }, [hasVfsCode, hasDbGeneratedCode, activeVfsFiles, generatedFilesMap, blueprint, isMongo]);

  useEffect(() => {
    if (files.length > 0 && (!activeFilePath || !files.some((f) => f.path === activeFilePath))) {
      const defaultFile =
        files.find((f) => f.path === 'frontend/src/App.tsx' || f.path === 'src/App.tsx' || f.path === 'App.tsx') ||
        files[0];
      setActiveFilePath(defaultFile.path);
      if (!openFiles.includes(defaultFile.path)) {
        setOpenFiles((prev) => [...prev, defaultFile.path]);
      }
    }
  }, [files, activeFilePath, openFiles]);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  // ─── Bidirectional Click-to-Code Visual Inspection Listener ────────────────
  useEffect(() => {
    const handleInspectTarget = (targetFile?: string, targetLine?: number, el?: any) => {
      // 1. If targetFile is provided and not currently active, open and select it
      if (targetFile) {
        if (!openFiles.includes(targetFile)) {
          setOpenFiles((prev) => [...prev, targetFile]);
        }
        setActiveFilePath(targetFile);
        vfs.setActiveFile?.(targetFile);
      }

      // 2. Scroll and highlight line in CodeMirror 6
      const applySelection = () => {
        const view = editorViewRef.current;
        if (!view) return;

        if (targetLine && targetLine > 0) {
          const clampedLine = Math.min(Math.max(targetLine, 1), view.state.doc.lines);
          const line = view.state.doc.line(clampedLine);
          view.dispatch({
            selection: { anchor: line.from, head: line.to },
            scrollIntoView: true,
          });
          view.focus();
          const fname = (targetFile || activeFilePath || '').split('/').pop() || 'file';
          toast(`Inspected element: jumped to line ${clampedLine} in ${fname}`, 'info');
          return;
        }

        // Fallback: search for candidate text/tag snippet in active document
        if (el) {
          const doc = view.state.doc.toString();
          const candidates = [
            el.textContent,
            el.placeholder ? `placeholder="${el.placeholder}"` : '',
            el.placeholder,
            el.ariaLabel ? `aria-label="${el.ariaLabel}"` : '',
            el.ariaLabel,
            el.title ? `title="${el.title}"` : '',
            el.id ? `id="${el.id}"` : '',
            el.id,
            el.className ? el.className.split(' ').filter((c: string) => c.length > 4 && !c.includes(':'))[0] : '',
            el.tagName && el.tagName !== 'div' ? `<${el.tagName}` : '',
          ].filter(Boolean);

          let matchPos = -1;
          let matchLen = 0;

          for (const cand of candidates) {
            if (!cand || cand.length < 2) continue;
            const idx = doc.indexOf(cand);
            if (idx !== -1) {
              matchPos = idx;
              matchLen = cand.length;
              break;
            }
          }

          if (matchPos !== -1) {
            view.dispatch({
              selection: EditorSelection.single(matchPos, matchPos + matchLen),
              scrollIntoView: true,
            });
            view.focus();
            toast(`Inspected element: "${candidates[0]}"`, 'info');
          }
        }
      };

      setTimeout(applySelection, 70);
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BUILDX_INSPECT_CODE_TARGET') {
        const { targetFile, targetLine, element } = event.data;
        handleInspectTarget(targetFile, targetLine, element);
      } else if (event.data?.type === 'buildx:preview-element-click' && event.data.element) {
        handleInspectTarget(undefined, undefined, event.data.element);
      }
    };

    const handleCustomInspectEvent = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        const { targetFile, targetLine, element } = custom.detail;
        handleInspectTarget(targetFile, targetLine, element);
      }
    };

    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('buildx:inspect_target', handleCustomInspectEvent);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('buildx:inspect_target', handleCustomInspectEvent);
    };
  }, [activeFilePath, toast, openFiles, vfs]);

  // ─── Keyboard Shortcuts for Diff Review (⌘Enter / Esc) ─────────────────────
  const currentStagedDiff = activeFile
    ? vfs.stagedDiffs[activeFile.path] ||
      (vfs.pendingDiffs[activeFile.path]
        ? {
            original: vfs.pendingDiffs[activeFile.path].original,
            incoming: vfs.pendingDiffs[activeFile.path].modified,
            filePath: activeFile.path,
          }
        : null) ||
      (pendingDiff && pendingDiff.filePath === activeFile?.path
        ? { original: pendingDiff.original, incoming: pendingDiff.modified, filePath: pendingDiff.filePath }
        : null)
    : null;

  const isShowingDiff = Boolean((isDiffMode || currentStagedDiff !== null) && activeFile && currentStagedDiff);

  // Bump diffKey whenever diff state transitions so CodeMirror fully re-mounts
  const prevDiffRef = useRef<string | null>(null);
  useEffect(() => {
    const diffId = currentStagedDiff ? `${currentStagedDiff.filePath || ''}::${currentStagedDiff.incoming?.length}` : null;
    if (diffId !== prevDiffRef.current) {
      prevDiffRef.current = diffId;
      if (diffId) setDiffKey(k => k + 1);
    }
  }, [currentStagedDiff]);

  // ─── Dev Test Diff Trigger ─────────────────────────────────────────────────
  const handleTestDiff = useCallback(() => {
    if (!activeFile) return;
    const testAddition = '\n// ✅ Test Green Addition Line — delete after verifying inline diff visuals';
    vfs.stageFileDiff(activeFile.path, activeFile.content + testAddition, activeFile.content);
    setIsDiffMode(true);
    toast('🧪 Test diff staged — verify green/red highlights below', 'info');
  }, [activeFile, vfs, toast]);

  const handleAcceptDiff = useCallback(async () => {
    if (!activeFile) return;
    try {
      if (blueprintId) {
        await vfs.acceptDiff(blueprintId, activeFile.path);
      } else {
        await vfs.acceptDiff(activeFile.path);
      }
      triggerPatchFlash();
      setPendingDiff(null);
      setIsDiffMode(false);
      toast('AI changes accepted and applied to VFS!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update file in VFS', 'error');
    }
  }, [vfs, activeFile, blueprintId, toast]);

  const handleRejectDiff = useCallback(() => {
    if (!activeFile) return;
    vfs.rejectDiff(activeFile.path);
    setPendingDiff(null);
    setIsDiffMode(false);
    toast('Proposed AI changes discarded', 'info');
  }, [vfs, activeFile, toast]);

  useEffect(() => {
    if (!currentStagedDiff) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAcceptDiff();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleRejectDiff();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStagedDiff, handleAcceptDiff, handleRejectDiff]);

  // ─── File Open/Close Handlers ──────────────────────────────────────────────
  const handleOpenFile = (path: string) => {
    if (!openFiles.includes(path)) {
      setOpenFiles((prev) => [...prev, path]);
    }
    setActiveFilePath(path);
    vfs.setActiveFile?.(path);
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
      a.download = `${(blueprint.appName || 'buildx').toLowerCase().replace(/\s+/g, '-')}-scaffold.zip`;
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
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const buildedTree = buildFileTree(files.map((f) => f.path));

  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const indent = depth * 12;
      if (node.isFolder) {
        const isCollapsed = collapsedFolders[node.path];
        return (
          <div key={node.path} className="space-y-1">
            <button
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${indent + 8}px` }}
              className="w-full text-left py-1.5 text-zinc-400 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-1.5 transition-colors font-semibold font-mono text-xs"
            >
              {isCollapsed ? (
                <ChevronRight size={12} className="text-zinc-500 shrink-0" />
              ) : (
                <ChevronDown size={12} className="text-zinc-500 shrink-0" />
              )}
              {isCollapsed ? (
                <Folder size={14} className="text-purple-400/80 shrink-0" />
              ) : (
                <FolderOpen size={14} className="text-purple-400/80 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {!isCollapsed && node.children && (
              <div className="space-y-1">{renderTreeNodes(node.children, depth + 1)}</div>
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
            className={`w-full text-left py-1.5 rounded-lg flex items-center gap-2 transition-colors font-mono text-xs ${
              isSelected
                ? 'bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-purple-500 rounded-l-none'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {getFileIcon(node.name, 14)}
            <span className="truncate">{node.name}</span>
          </button>
        );
      }
    });
  };

  // ─── AI Code Refinement & Diff Trigger ─────────────────────────────────────
  const handleSubmitRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim() || isAiModifying || propIsRefining || !activeFile) return;

    const userPrompt = refineInput.trim();
    setRefineInput('');
    setIsAiModifying(true);

    try {
      if (onRefineMessage) {
        onRefineMessage(userPrompt);
      }

      // If backend AI refine is available, call it and set pendingDiff
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      if (blueprintId) {
        const res = await fetch(`${BASE_URL}/api/blueprint/${blueprintId}/refine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            message: `Please modify the active file ${activeFile.path}: ${userPrompt}`,
            currentCode: activeFile.content,
            filePath: activeFile.path,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.modifiedCode || data.data?.modifiedCode) {
            const modified = data.modifiedCode || data.data?.modifiedCode;
            vfs.stageFileDiff(activeFile.path, modified, activeFile.content);
            setIsDiffMode(true);
            toast('AI proposed code edits — review diff below', 'info');
            return;
          }
        }
      }

      // Client-side fallback demonstration if backend streaming is handled via chat
      toast('Prompt sent to Cortex Agent for refinement', 'success');
    } catch (err: any) {
      toast(err.message || 'Refinement request failed', 'error');
    } finally {
      setIsAiModifying(false);
    }
  };

  // ─── Empty & Loading States ────────────────────────────────────────────────
  const hasGeneratedCode = hasDbGeneratedCode || hasVfsCode;

  if (codegenProgress.status === 'loading' && !hasGeneratedCode && !isGenerating) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-[#09090b] text-center py-20 min-h-[480px]">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Loading workspace files…</p>
      </div>
    );
  }

  if (codegenProgress.status === 'error' && !hasGeneratedCode && !isGenerating) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-red-500/20 bg-[#09090b] text-center py-20 min-h-[480px]">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 mb-6 shrink-0">
          <X size={32} />
        </div>
        <h2 className="font-bold text-xl text-white mb-3">Code Generation Failed</h2>
        <p className="text-zinc-400 text-sm max-w-lg mb-8 leading-relaxed">
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
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-[#09090b] text-center py-20 min-h-[480px]">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 mb-6 shrink-0 shadow-lg shadow-purple-500/5">
          <Sparkles size={32} className="animate-pulse text-purple-400" />
        </div>
        <h2 className="font-bold text-xl sm:text-2xl text-white mb-3">
          Generate Full Application Codebase
        </h2>
        <p className="text-zinc-400 text-sm max-w-lg mb-8 leading-relaxed">
          Transform your architecture blueprint specifications into complete, functional source code files with CodeMirror 6 live editing and AI diff reviews.
        </p>

        {blueprintId ? (
          user ? (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => generateCode(blueprintId)}
                className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/20"
              >
                <Play size={16} fill="currentColor" />
                Start Code Generation
              </button>
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
    const percent =
      codegenProgress.totalFiles > 0
        ? Math.round((codegenProgress.currentFileIndex / codegenProgress.totalFiles) * 100)
        : 0;
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-[#09090b] text-center py-20 min-h-[480px]">
        <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-8 flex items-center justify-center shrink-0" />
        <h3 className="font-bold text-lg text-white mb-2">Generating Application Files...</h3>
        <p className="text-xs text-purple-400 font-mono mb-6">
          {codegenProgress.currentFilePath || 'Connecting to Multi-Model Pipeline...'}
        </p>

        <div className="w-full max-w-xs bg-white/5 rounded-full h-1.5 overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">
          File {codegenProgress.currentFileIndex} of {codegenProgress.totalFiles} ({percent}%)
        </div>
      </div>
    );
  }

  const activeContent = activeFile ? activeFile.content : '';
  const languageExts = activeFile ? getLanguageExtension(activeFile.name) : [javascript({ jsx: true, typescript: true })];

  return (
    <div className="flex flex-col md:flex-row rounded-xl border border-white/10 bg-[#0e0e14] overflow-hidden h-full w-full select-none">
      {/* File Tree Explorer (Left) */}
      <div className="w-full md:w-64 bg-[#09090c] border-b md:border-b-0 md:border-r border-white/10 flex flex-col h-48 md:h-full shrink-0">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <span className="font-mono text-xs text-zinc-400 font-bold tracking-wider uppercase truncate">
            Workspace
          </span>
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded hover:bg-purple-500/20 hover:text-purple-300 font-mono flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50 whitespace-nowrap tracking-tight"
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
        <div className="flex-1 p-2 overflow-y-auto space-y-1 font-mono text-xs scrollbar-thin">
          {renderTreeNodes(buildedTree)}
        </div>
      </div>

      {/* Editor & View Area (Center) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#08080c] min-h-0 md:h-full relative select-text">
        {/* Editor Tabs & Controls */}
        <div className="h-11 bg-[#0d0d12] border-b border-white/10 px-3 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] relative" role="tablist">
            {[
              { id: 'code', label: '01 CODE', icon: <FileCode size={12} /> },
              { id: 'diffs', label: '02 DIFFS', icon: <GitCompare size={12} /> },
            ].map((tabItem) => {
              const isActive =
                (tabItem.id === 'diffs' && (isDiffMode || pendingDiff !== null)) ||
                (tabItem.id === 'code' && !isDiffMode && pendingDiff === null);
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (tabItem.id === 'diffs') {
                      setIsDiffMode(true);
                      if (!pendingDiff && activeFile) {
                        setPendingDiff({
                          original: activeFile.content,
                          modified: activeFile.content,
                          filePath: activeFile.path,
                        });
                      }
                    }
                    if (tabItem.id === 'code') {
                      setIsDiffMode(false);
                      setPendingDiff(null);
                    }
                  }}
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors z-10 tracking-tight ${
                    isActive ? 'text-white' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="codeStudioTab"
                      className="absolute inset-0 rounded-lg bg-indigo-500/20 border border-indigo-500/30"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tabItem.icon}
                    {tabItem.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active file metadata badge & actions */}
          <div className="flex items-center gap-2 pr-2 ml-auto">
            {activeFile && (
              <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-zinc-400 truncate tracking-tight">
                <span className="text-zinc-300 truncate max-w-[200px]">{activeFile.path}</span>
                <span className="uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] shrink-0 font-bold font-mono">
                  {activeFile.language}
                </span>
              </div>
            )}
            {/* Dev Test Diff Button */}
            <button
              type="button"
              onClick={handleTestDiff}
              className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg hover:bg-amber-500/20 hover:text-amber-300 font-mono flex items-center gap-1 transition-colors shrink-0"
              title="Test diff visuals with a sample addition"
            >
              <FlaskConical size={11} />
              <span>🧪 Test Diff</span>
            </button>
            <div className="w-px h-4 bg-white/10 shrink-0" />
            <button
              onClick={handleCopyCode}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-1 transition-colors text-xs font-medium font-sans shrink-0"
              title="Copy file content"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Editor View / CodeMirror 6 Engine / AI Diff Review Overlay */}
        <div className="flex-1 overflow-hidden relative min-h-0 bg-[#08080c] flex flex-col">
          {/* Patch apply flash effect */}
          <AnimatePresence>
            {patchFlash && (
              <motion.div
                key="patch-flash"
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="absolute inset-0 z-30 pointer-events-none rounded-xl"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.3) 0%, transparent 70%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* ─── Diff Mode / Cursor-Style Inline AI Review Mode ─── */}
          {isShowingDiff && activeFile && currentStagedDiff ? (
            <div className="h-full flex flex-col min-h-0 relative">
              {/* Floating Action Header Bar */}
              <div className="z-20 flex items-center justify-between px-4 py-2.5 bg-indigo-950/70 backdrop-blur-xl border-b border-indigo-500/30 text-indigo-300 text-xs shrink-0 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <GitCompare size={14} className="text-indigo-400 shrink-0" />
                  <span className="font-mono text-xs">
                    Cursor-Style Inline Diff — <strong className="text-white">{activeFile.name}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptDiff}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 text-xs font-bold font-mono transition-all hover:scale-105 shadow-sm shadow-emerald-500/20"
                    title="Accept Changes (⌘+Enter)"
                  >
                    <CheckCircle2 size={13} />
                    <span>[ ⌘Enter Accept Changes ]</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectDiff}
                    className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 flex items-center gap-1.5 text-xs font-bold font-mono transition-all hover:scale-105 shadow-sm shadow-red-500/20"
                    title="Reject (Esc)"
                  >
                    <XCircle size={13} />
                    <span>[ Esc Reject ]</span>
                  </button>
                </div>
              </div>

              {/* CodeMirror 6 Unified Merge View Engine */}
              <div className="flex-1 overflow-hidden relative min-h-0 bg-[#08080c]">
                <CodeMirror
                  key={`diff-${activeFile.path}-${diffKey}`}
                  value={currentStagedDiff.incoming}
                  height="100%"
                  theme={buildxEditorTheme}
                  extensions={[
                    ...languageExts,
                    unifiedMergeView({
                      original: currentStagedDiff.original,
                      highlightChanges: true,
                      syntaxHighlightDeletions: true,
                      mergeControls: false,
                      gutter: true,
                    }),
                    cursorInlineDiffTheme,
                    ...buildxExtensions,
                    EditorView.lineWrapping,
                  ]}
                  editable={false}
                  className="h-full text-xs font-mono"
                />
              </div>
            </div>
          ) : activeFile ? (
            /* ─── Standard CodeMirror 6 Live Editor ─── */
            <div className="h-full flex-1 min-h-0 overflow-hidden relative">
              <CodeMirror
                key={`editor-${activeFilePath}`}
                ref={editorRef}
                value={activeContent}
                height="100%"
                theme={buildxEditorTheme}
                extensions={[
                  ...languageExts,
                  ...buildxExtensions,
                  EditorView.lineWrapping,
                ]}
                onCreateEditor={(view) => {
                  editorViewRef.current = view;
                }}
                onChange={(val) => {
                  if (blueprintId && activeFile) {
                    vfs.updateFile(blueprintId, activeFile.path, val);
                  }
                }}
                className="h-full text-xs font-mono"
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm font-mono">
              No files open. Select a file from the explorer.
            </div>
          )}
        </div>

        {/* AI Agent refinement bar at the bottom */}
        {onRefineMessage && (
          <form
            onSubmit={handleSubmitRefine}
            className="p-3 bg-[#0d0d12] border-t border-white/10 flex items-center gap-2 shrink-0 select-none"
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-500/10 text-purple-400 shrink-0 border border-purple-500/20">
              <Sparkles size={13} className="text-purple-400 animate-pulse" />
            </div>
            <input
              type="text"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              placeholder={`Ask Cortex Agent to edit this file (e.g. "Change button color to emerald green inside App.tsx")...`}
              disabled={isAiModifying || propIsRefining}
              className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500 font-mono"
            />
            <button
              type="submit"
              disabled={!refineInput.trim() || isAiModifying || propIsRefining}
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-30 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-purple-500/10 shrink-0"
            >
              {isAiModifying || propIsRefining ? (
                <>
                  <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Coding...</span>
                </>
              ) : (
                <>
                  <Wand2 size={12} />
                  <span>Modify with AI</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default CodeStudio;
