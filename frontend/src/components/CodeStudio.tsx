import React, { useState, useEffect } from 'react';
import type { Blueprint } from '../lib/types';
import { escapeHtml, formatSQL } from '../lib/utils';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileJson, 
  FileText, 
  Database,
  Sparkles
} from 'lucide-react';

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
  onRefineMessage?: (msg: string) => void;
  isRefining?: boolean;
}

interface VirtualFile {
  path: string;
  name: string;
  folder: string;
  language: 'tsx' | 'ts' | 'sql' | 'json' | 'md' | 'js' | 'javascript';
  content: string;
  icon: string;
}

export function CodeStudio({ blueprint, onRefineMessage, isRefining = false }: CodeStudioProps) {
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [refineInput, setRefineInput] = useState('');

  const isMongo = (blueprint.architecture?.database || '').toLowerCase().includes('mongo');

  const unescapeString = (str: string) => {
    if (!str) return '';
    // Handle multiple levels of escaping that can occur from AI → JSON.parse → SSE → JSON.parse
    let result = str;
    // First pass: handle double-escaped sequences (\\\\n → \\n → \n)
    // This catches cases where the AI double-escaped and JSON.parse only removed one level
    result = result.replace(/\\\\n/g, '\\n');
    result = result.replace(/\\\\t/g, '\\t');
    result = result.replace(/\\\\"/g, '\\"');
    // Second pass: handle single-escaped sequences (\\n → \n)
    result = result.replace(/\\n/g, '\n');
    result = result.replace(/\\t/g, '\t');
    result = result.replace(/\\"/g, '"');
    result = result.replace(/\\\\/g, '\\');
    return result;
  };

  /** Generate fallback Mongoose schema code from blueprint.schema (frontend-side) */
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

  // Get the schema/SQL code, with frontend fallback for MongoDB
  const getSchemaCode = (): string => {
    const raw = unescapeString(blueprint.code?.sql || '');
    if (raw.trim() && raw.trim() !== '-- No SQL generated') return isMongo ? raw : formatSQL(raw);
    if (isMongo) return generateFallbackMongooseCode();
    return raw || '-- No SQL generated';
  };

  const files: VirtualFile[] = [
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
    },
  ];

  // Set default active file on load
  useEffect(() => {
    if (!activeFilePath && files.length > 0) {
      setActiveFilePath(files[0].path);
      setOpenFiles([files[0].path]);
    }
  }, [blueprint]);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

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
    if (activeFilePath === path && filtered.length > 0) {
      setActiveFilePath(filtered[filtered.length - 1]);
    }
  };

  const handleSubmitRefine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim() || isRefining || !onRefineMessage) return;
    onRefineMessage(refineInput);
    setRefineInput('');
  };

  return (
    <div className="flex flex-col md:flex-row rounded-2xl border border-white/10 bg-bg-surface overflow-hidden h-[580px] w-full">
      {/* File Tree Explorer (Left) */}
      <div className="w-full md:w-64 bg-bg-surface2 border-r border-white/5 flex flex-col h-1/3 md:h-full shrink-0 select-none">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="font-mono-custom text-[10px] text-muted-foreground font-bold tracking-wider uppercase">
            Workspace Explorer
          </span>
          <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded font-mono-custom">
            React+Node
          </span>
        </div>

        {/* Tree items */}
        <div className="flex-1 p-2 overflow-y-auto space-y-1.5 font-mono-custom text-xs">
          {/* Folders & files rendering */}
          {['database', 'frontend', 'backend', '.'].map((folderName) => {
            const folderFiles = files.filter((f) => f.folder.startsWith(folderName) || (folderName === '.' && f.folder === '.'));
            if (folderFiles.length === 0) return null;

            return (
              <div key={folderName} className="space-y-1">
                {folderName !== '.' && (
                  <div className="px-2 py-1 text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Folder size={14} className="text-purple-400/80" />
                    <span className="truncate">{folderName}</span>
                  </div>
                )}
                <div className={folderName !== '.' ? 'pl-4 space-y-1' : 'space-y-1'}>
                  {folderFiles.map((f) => {
                    const isSelected = activeFilePath === f.path;
                    return (
                      <button
                        key={f.path}
                        onClick={() => handleOpenFile(f.path)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                          isSelected
                            ? 'bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-purple-500 rounded-l-none'
                            : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {getFileIcon(f.name, 14)}
                        <span className="truncate">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor & View Area (Center) */}
      <div className="flex-1 flex flex-col min-w-0 bg-black/45 h-2/3 md:h-full relative">
        {/* Editor Tabs */}
        <div className="h-10 bg-bg-surface2 border-b border-white/5 flex items-center overflow-x-auto select-none shrink-0 scrollbar-none">
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

        {/* Editor content */}
        <div className="flex-1 p-4 overflow-auto font-mono-custom text-xs text-white leading-relaxed relative">
          {activeFile ? (
            <pre className="whitespace-pre tab-size-2 scrollbar-thin">
              <code
                dangerouslySetInnerHTML={{
                  __html: escapeHtml(activeFile.content)
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
