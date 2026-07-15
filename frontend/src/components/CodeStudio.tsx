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
  Cpu
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { getAuthHeaders } from '../lib/api';
import { useCodeGeneration } from '../hooks/useCodeGeneration';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';
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

function highlightCode(content: string, language: string): string {
  let html = escapeHtml(content);

  if (language === 'ts' || language === 'tsx' || language === 'js' || language === 'javascript') {
    const placeholders: string[] = [];
    
    html = html.replace(/\/\*[\s\S]*?\*\//g, (match) => {
      placeholders.push(`<span class="text-emerald-500/80 italic">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });
    
    html = html.replace(/\/\/.*$/gm, (match) => {
      placeholders.push(`<span class="text-emerald-500/80 italic">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });
    
    html = html.replace(/(["'`])(?:\\.|[^\\])*?\1/g, (match) => {
      placeholders.push(`<span class="text-amber-300/90">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });
    
    const keywords = [
      'const', 'let', 'var', 'function', 'class', 'extends', 'implements', 
      'import', 'export', 'from', 'default', 'as', 'return', 'if', 'else', 
      'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'this', 
      'true', 'false', 'null', 'undefined', 'async', 'await', 'try', 'catch', 
      'finally', 'throw', 'interface', 'type', 'readonly', 'public', 'private', 
      'protected', 'static', 'get', 'set', 'of', 'in'
    ];
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    html = html.replace(keywordRegex, '<span class="text-purple-400 font-bold">$1</span>');
    
    const types = ['string', 'number', 'boolean', 'any', 'void', 'unknown', 'never', 'object', 'Record', 'Promise', 'ReactNode', 'React'];
    const typesRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'g');
    html = html.replace(typesRegex, '<span class="text-blue-400 font-semibold">$1</span>');
    
    for (let i = placeholders.length - 1; i >= 0; i--) {
      html = html.replace(`___PLACEHOLDER_${i}___`, placeholders[i]);
    }
  } else if (language === 'sql') {
    const placeholders: string[] = [];
    
    html = html.replace(/--.*$/gm, (match) => {
      placeholders.push(`<span class="text-emerald-500/80 italic">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });
    
    html = html.replace(/'(?:\\.|[^'])*?'/g, (match) => {
      placeholders.push(`<span class="text-amber-300/90">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });
    
    const sqlKeywords = [
      'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 
      'ALTER', 'DROP', 'INDEX', 'FOREIGN', 'KEY', 'PRIMARY', 'REFERENCES', 
      'UNIQUE', 'NOT', 'NULL', 'DEFAULT', 'INT', 'VARCHAR', 'TEXT', 'TIMESTAMP', 
      'BOOLEAN', 'DATE', 'UUID', 'DATABASE', 'SCHEMA', 'INTO', 'VALUES', 'SET', 
      'ON', 'DELETE', 'CASCADE', 'CONSTRAINT', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 
      'OUTER', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'AND', 
      'OR', 'IN', 'EXISTS', 'ANY', 'ALL'
    ];
    const sqlKeywordsRegex = new RegExp(`\\b(${sqlKeywords.join('|')})\\b`, 'gi');
    html = html.replace(sqlKeywordsRegex, '<span class="text-purple-400 font-bold">$1</span>');
    
    for (let i = placeholders.length - 1; i >= 0; i--) {
      html = html.replace(`___PLACEHOLDER_${i}___`, placeholders[i]);
    }
  } else if (language === 'json') {
    const placeholders: string[] = [];
    
    html = html.replace(/"(?:\\.|[^"])*?"/g, (match) => {
      placeholders.push(`<span class="text-amber-300/90">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });
    
    html = html.replace(/\b(true|false|null|\d+)\b/g, '<span class="text-blue-400">$1</span>');
    
    for (let i = placeholders.length - 1; i >= 0; i--) {
      html = html.replace(`___PLACEHOLDER_${i}___`, placeholders[i]);
    }
  }
  
  return html;
}

export function CodeStudio({ blueprint, blueprintId, blueprintContentKey, onRefineMessage, isRefining = false, codegen }: CodeStudioProps) {
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [refineInput, setRefineInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  
  // Destructure hook state passed from parent
  const {
    isGenerating,
    progress: codegenProgress,
    files: generatedFilesMap,
    generateCode,
    loadGeneratedFiles,
    saveFileContent
  } = codegen;
  const { selectedModel, setSelectedModel } = useModel();
  const { user } = useAuth();

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const ModelSelector = () => {
    const activeModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    
    return (
      <div className="relative inline-block text-left shrink-0">
        <button
          type="button"
          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 hover:border-purple-500/30 transition-all select-none font-mono-custom cursor-pointer active:scale-95"
        >
          <Cpu size={11} className="text-purple-400" />
          <span>{activeModelInfo ? activeModelInfo.label : selectedModel}</span>
          <ChevronDown size={10} className={`text-purple-400/70 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isModelDropdownOpen && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setIsModelDropdownOpen(false)} 
            />
            
            <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-white/10 bg-bg-surface2/95 backdrop-blur-md shadow-2xl p-1.5 z-40 space-y-0.5 animate-fade-in font-mono-custom text-[11px] origin-top-right">
              {AVAILABLE_MODELS.map((model) => {
                const isSelected = model.id === selectedModel;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.id as any);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-500/15 text-purple-300 font-bold'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{model.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                      isSelected 
                        ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' 
                        : 'bg-white/5 border-white/10 text-muted-foreground'
                    }`}>
                      {model.provider.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  // Load generated files when blueprint id or content changes (e.g. after refine)
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

  // DB/codegen files take priority; fall back to blueprint starter snippets for legacy view
  const hasDbGeneratedCode = Object.keys(generatedFilesMap).length > 0;
  const activeFilesMap = hasDbGeneratedCode
    ? generatedFilesMap
    : (blueprint.code?.files || {});

  const files: VirtualFile[] = [];

  if (Object.keys(activeFilesMap).length > 0) {
    Object.entries(activeFilesMap).forEach(([filePath, content]) => {
      const parts = filePath.split('/');
      const name = parts[parts.length - 1];
      const folder = parts.slice(0, -1).join('/') || '.';
      
      let language: VirtualFile['language'] = 'ts';
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext === 'tsx') language = 'tsx';
      else if (ext === 'ts') language = 'ts';
      else if (ext === 'sql') language = 'sql';
      else if (ext === 'json') language = 'json';
      else if (ext === 'md') language = 'md';
      else if (ext === 'js') language = 'js';
      
      files.push({
        path: filePath,
        name,
        folder,
        language,
        content: unescapeString(content as string),
        icon: ''
      });
    });
  } else {
    // Fallback template configurations
    files.push(
      {
        path: 'frontend/src/App.tsx',
        name: 'App.tsx',
        folder: 'frontend/src',
        language: 'tsx',
        content: unescapeString(blueprint.code?.frontend || ''),
        icon: '⚛️',
      },
      {
        path: 'frontend/package.json',
        name: 'package.json',
        folder: 'frontend',
        language: 'json',
        content: JSON.stringify(
          {
            name: `${(blueprint.appName || 'app').toLowerCase().replace(/\s+/g, '-')}-frontend`,
            version: '1.0.0',
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
              tailwindcss: '^3.3.0',
              'lucide-react': '^0.294.0',
              '@tanstack/react-query': '^5.14.0',
            },
          },
          null,
          2
        ),
        icon: '📦',
      },
      {
        path: 'backend/src/routes.ts',
        name: 'routes.ts',
        folder: 'backend/src',
        language: 'ts',
        content: unescapeString(blueprint.code?.backend || ''),
        icon: '🔌',
      },
      {
        path: 'backend/package.json',
        name: 'package.json',
        folder: 'backend',
        language: 'json',
        content: JSON.stringify(
          {
            name: `${(blueprint.appName || 'app').toLowerCase().replace(/\s+/g, '-')}-backend`,
            version: '1.0.0',
            dependencies: {
              express: '^4.18.2',
              jsonwebtoken: '^9.0.2',
              bcryptjs: '^2.4.3',
              ...(isMongo
                ? { mongoose: '^7.6.0' }
                : { pg: '^8.11.3' }),
              zod: '^3.22.4',
            },
          },
          null,
          2
        ),
        icon: '📦',
      },
      {
        path: `database/${isMongo ? 'schema.js' : 'schema.sql'}`,
        name: isMongo ? 'schema.js' : 'schema.sql',
        folder: 'database',
        language: isMongo ? 'javascript' : 'sql',
        content: getSchemaCode(),
        icon: '🗄️',
      },
      {
        path: 'README.md',
        name: 'README.md',
        folder: '.',
        language: 'md',
        content: unescapeString(`# ⚡ ${blueprint.appName || 'App'}\n\n${blueprint.description || ''}\n\n## Target Users\n${blueprint.targetUsers || ''}\n\n## Tech Stack\n- Frontend: ${blueprint.architecture?.frontend || 'React'}\n- Backend: ${blueprint.architecture?.backend || 'Node'}\n- Database: ${blueprint.architecture?.database || 'PostgreSQL'}\n- Auth: ${blueprint.architecture?.auth || 'JWT'}\n- Hosting: ${blueprint.architecture?.hosting || 'Vercel'}\n\n## Setup Instructions\n1. Import the schema inside database/${isMongo ? 'schema.js' : 'schema.sql'}\n2. Run npm install in frontend and backend\n3. Run npm run dev to start`),
        icon: '📝',
      }
    );
  }

  // Set default active file on load
  useEffect(() => {
    if (files.length > 0) {
      const validOpenFiles = openFiles.filter(path => files.some(f => f.path === path));
      let nextActivePath = activeFilePath;
      if (!activeFilePath || !files.some(f => f.path === activeFilePath)) {
        nextActivePath = files[0].path;
      }
      setActiveFilePath(nextActivePath);
      if (validOpenFiles.length === 0 && nextActivePath) {
        setOpenFiles([nextActivePath]);
      } else if (!validOpenFiles.includes(nextActivePath) && nextActivePath) {
        setOpenFiles([...validOpenFiles, nextActivePath]);
      } else {
        setOpenFiles(validOpenFiles);
      }
    } else {
      setActiveFilePath('');
      setOpenFiles([]);
    }
  }, [blueprint, generatedFilesMap]);

  const activeFile = openFiles.includes(activeFilePath)
    ? files.find((f) => f.path === activeFilePath)
    : undefined;



  const handleOpenFile = (path: string) => {
    setActiveFilePath(path);
    if (!openFiles.includes(path)) {
      setOpenFiles([...openFiles, path]);
    }
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

  // Determine if full code files are generated yet (DB/codegen only — not starter snippets)
  const hasGeneratedCode = hasDbGeneratedCode;

  if (codegenProgress.status === 'loading' && !hasGeneratedCode && !isGenerating) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-bg-surface text-center py-20 min-h-[480px]">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading generated code files…</p>
      </div>
    );
  }

  // ─── Render Code Generator Error State ────────────────────
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
            onClick={() => generateCode(blueprintId, selectedModel)}
            className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl text-sm font-semibold border border-purple-500/30 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // ─── Render Code Generator Splash Panel ───────────────────
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
                onClick={() => generateCode(blueprintId, selectedModel)}
                className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-display font-semibold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/20"
              >
                <Play size={16} fill="currentColor" />
                Start Code Generation
              </button>
              <div className="mt-4 flex items-center justify-center gap-2">
                <ModelSelector />
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

  // ─── Render Generation Progress Overlay ───────────────────
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
          {codegenProgress.currentFilePath || 'Connecting to model...'}
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
    <div className="flex flex-col md:flex-row rounded-2xl border border-white/10 bg-bg-surface overflow-hidden h-[calc(100vh-16rem)] min-h-[420px] max-h-[580px] md:h-[580px] md:max-h-none w-full">
      {/* File Tree Explorer (Left) */}
      <div className="w-full md:w-64 bg-bg-surface2 border-b md:border-b-0 md:border-r border-white/5 flex flex-col h-44 md:h-full shrink-0 select-none">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
          <span className="font-mono-custom text-[10px] text-muted-foreground font-bold tracking-wider uppercase truncate">
            Workspace
          </span>
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded hover:bg-purple-500/20 hover:text-purple-300 font-mono-custom flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50 whitespace-nowrap"
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
        <div className="flex-1 p-2 overflow-y-auto space-y-1.5 font-mono-custom text-xs">
          {renderTreeNodes(buildedTree)}
        </div>
      </div>

      {/* Editor & View Area (Center) */}
      <div className="flex-1 flex flex-col min-w-0 bg-black/45 min-h-0 md:h-full relative">
        {/* Editor Tabs & Actions */}
        <div className="h-10 bg-bg-surface2 border-b border-white/5 flex items-center justify-between select-none shrink-0 pr-2">
          <div className="flex items-center overflow-x-auto scrollbar-none h-full flex-1">
            {openFiles.map((path) => {
              const f = files.find((file) => file.path === path);
              if (!f) return null;
              const isSelected = activeFilePath === path;

              return (
                <div
                  key={path}
                  onClick={() => setActiveFilePath(path)}
                  className={`h-full px-4 border-r border-white/5 flex items-center gap-2 cursor-pointer transition-colors text-xs font-mono-custom ${
                    isSelected
                      ? 'bg-black/50 text-purple-300 border-t-2 border-t-purple-500'
                      : 'text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  {getFileIcon(f.name, 13)}
                  <span className="truncate max-w-[100px]">{f.name}</span>
                  <button
                    onClick={(e) => handleCloseFile(path, e)}
                    className="hover:bg-white/10 hover:text-white rounded-full p-0.5 flex items-center justify-center w-4 h-4 ml-1"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="flex items-center gap-2 pr-2">
            <ModelSelector />
            <div className="w-px h-4 bg-white/10 shrink-0" />
            <div className="flex items-center gap-1.5">
              {activeFile && (
              <>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-1 transition-colors text-xs font-medium shrink-0"
                  title="Copy file content"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </>
            )}
          </div>
        </div>
        </div>

        {/* Editor content */}
        <div className="flex-1 p-4 overflow-auto font-mono-custom text-xs text-white leading-relaxed relative min-h-0">
          {activeFile ? (
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
