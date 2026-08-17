import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../lib/api';

export interface VFSFile {
  path: string;
  content: string;
  language: string;
}

export interface PendingDiff {
  filePath: string;
  originalCode: string;
  incomingCode: string;
  original?: string;
  modified?: string;
  incoming?: string;
  summary?: string;
}

export interface StagedDiff {
  filePath: string;
  originalCode: string;
  incomingCode: string;
  original?: string;
  incoming?: string;
  summary?: string;
}

interface VFSContextType {
  files: Record<string, string>;
  committedFiles: Record<string, string>;
  pendingDiff: PendingDiff | null;
  pendingDiffs: Record<string, PendingDiff>;
  stagedDiffs: Record<string, StagedDiff>;
  fileList: VFSFile[];
  activeFile: VFSFile | null;
  activeFilePath: string | null;
  setActiveFile: (file: VFSFile | string | null) => void;
  updateFile: (blueprintId: string, path: string, content: string) => Promise<void>;
  stageDiff: (filePath: string, incomingCode: string | PendingDiff) => void;
  stageFileDiff: (path: string, incomingCode: string, originalCode?: string) => void;
  acceptDiff: (blueprintIdOrPath?: string, path?: string) => Promise<void>;
  rejectDiff: (path?: string) => void;
  clearAllDiffs: () => void;
  initVFS: (blueprintId: string) => Promise<Record<string, string>>;
  loadVFS: (blueprintId: string) => Promise<Record<string, string>>;
  enhanceUi: (blueprintId: string) => Promise<Record<string, string>>;
  isLoadingVFS: boolean;
  isEnhancingUi: boolean;
}

const VFSContext = createContext<VFSContextType | undefined>(undefined);

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export const VFSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);
  const [pendingDiffs, setPendingDiffs] = useState<Record<string, PendingDiff>>({});
  const [stagedDiffs, setStagedDiffs] = useState<Record<string, StagedDiff>>({});
  const [fileList, setFileList] = useState<VFSFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [isLoadingVFS, setIsLoadingVFS] = useState<boolean>(false);
  const [isEnhancingUi, setIsEnhancingUi] = useState<boolean>(false);

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'json':
        return 'json';
      case 'sql':
        return 'sql';
      case 'md':
        return 'markdown';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      default:
        return 'plaintext';
    }
  };

  const syncFilesState = (fileArray: VFSFile[]) => {
    const map: Record<string, string> = {};
    for (const f of fileArray) {
      map[f.path] = f.content;
    }
    setFiles(map);
    setFileList(fileArray);

    if (fileArray.length > 0 && !activeFilePath) {
      const first = fileArray.find(
        f => f.path !== 'preview.html' && (f.path.endsWith('.tsx') || f.path.endsWith('.ts'))
      ) || fileArray[0];
      if (first) setActiveFilePath(first.path);
    }
  };

  const loadVFS = useCallback(async (blueprintId: string): Promise<Record<string, string>> => {
    setIsLoadingVFS(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/blueprints/${blueprintId}/vfs`, {
        headers: getAuthHeaders(),
      });
      const data = res.data?.data;
      if (data && data.files && data.files.length > 0) {
        syncFilesState(data.files);
        return data.fileTree || {};
      }
      return {};
    } catch (err) {
      console.error('[VFSContext] Failed to load VFS', err);
      return {};
    } finally {
      setIsLoadingVFS(false);
    }
  }, []);

  const initVFS = useCallback(async (blueprintId: string): Promise<Record<string, string>> => {
    setIsLoadingVFS(true);
    try {
      const res = await axios.post(
        `${BASE_URL}/api/blueprints/${blueprintId}/vfs/init`,
        {},
        { headers: getAuthHeaders() }
      );
      const data = res.data?.data;
      if (data && data.files) {
        syncFilesState(data.files);
        return data.fileTree || {};
      }
      return {};
    } catch (err) {
      console.error('[VFSContext] Failed to init VFS', err);
      throw err;
    } finally {
      setIsLoadingVFS(false);
    }
  }, []);

  const updateFile = useCallback(
    async (blueprintId: string, path: string, content: string): Promise<void> => {
      try {
        await axios.put(
          `${BASE_URL}/api/blueprints/${blueprintId}/vfs/file`,
          { path, content },
          { headers: getAuthHeaders() }
        );

        setFiles(prev => ({ ...prev, [path]: content }));
        setFileList(prev => {
          const lang = getLanguageFromPath(path);
          const idx = prev.findIndex(f => f.path === path);
          if (idx > -1) {
            const copy = [...prev];
            copy[idx] = { path, content, language: lang };
            return copy;
          }
          return [...prev, { path, content, language: lang }];
        });
      } catch (err) {
        console.error('[VFSContext] Failed to update file', err);
        throw err;
      }
    },
    []
  );

  const stageFileDiff = useCallback((path: string, incomingCode: string, originalCode?: string) => {
    const orig = originalCode !== undefined ? originalCode : (files[path] || '');
    const diffObj: PendingDiff = {
      filePath: path,
      originalCode: orig,
      incomingCode,
      original: orig,
      modified: incomingCode,
      incoming: incomingCode,
    };
    setPendingDiff(diffObj);
    setStagedDiffs(prev => ({ ...prev, [path]: diffObj as any }));
    setPendingDiffs(prev => ({ ...prev, [path]: diffObj }));
    setActiveFilePath(path);
  }, [files]);

  const stageDiff = useCallback((filePath: string, incoming: string | PendingDiff) => {
    const orig = files[filePath] || '';
    const incomingCode = typeof incoming === 'string'
      ? incoming
      : (incoming.incomingCode || (incoming as any).modified || '');
    const originalCode = typeof incoming === 'object' && (incoming.originalCode || incoming.original) !== undefined
      ? (incoming.originalCode || incoming.original || '')
      : orig;

    const diffObj: PendingDiff = {
      filePath,
      originalCode,
      incomingCode,
      original: originalCode,
      modified: incomingCode,
      incoming: incomingCode,
    };
    setPendingDiff(diffObj);
    setPendingDiffs(prev => ({ ...prev, [filePath]: diffObj }));
    setStagedDiffs(prev => ({ ...prev, [filePath]: diffObj as any }));
    setActiveFilePath(filePath);
  }, [files]);

  const acceptDiff = useCallback(async (blueprintIdOrPath?: string, pathParam?: string): Promise<void> => {
    // Determine path and optional blueprintId from arguments or pendingDiff
    let path = pathParam;
    let blueprintId: string | undefined;

    if (pathParam && blueprintIdOrPath) {
      blueprintId = blueprintIdOrPath;
      path = pathParam;
    } else if (blueprintIdOrPath) {
      if (files[blueprintIdOrPath] !== undefined || stagedDiffs[blueprintIdOrPath] || pendingDiffs[blueprintIdOrPath]) {
        path = blueprintIdOrPath;
      } else {
        blueprintId = blueprintIdOrPath;
        path = pendingDiff?.filePath;
      }
    } else {
      path = pendingDiff?.filePath;
    }

    if (!path) return;

    const staged = stagedDiffs[path] || pendingDiffs[path] || (pendingDiff?.filePath === path ? pendingDiff : undefined);
    const codeToCommit = staged?.incomingCode || staged?.incoming || (staged as any)?.modified;
    if (codeToCommit === undefined) return;

    try {
      // Persist to backend database strictly upon acceptance if blueprintId is available
      if (blueprintId) {
        await axios.put(
          `${BASE_URL}/api/blueprints/${blueprintId}/vfs/file`,
          { path, content: codeToCommit },
          { headers: getAuthHeaders() }
        );
      }

      setFiles(prev => ({ ...prev, [path!]: codeToCommit }));
      setFileList(prev => {
        const lang = getLanguageFromPath(path!);
        const idx = prev.findIndex(f => f.path === path);
        if (idx > -1) {
          const copy = [...prev];
          copy[idx] = { path: path!, content: codeToCommit, language: lang };
          return copy;
        }
        return [...prev, { path: path!, content: codeToCommit, language: lang }];
      });

      // Clear diff from staged and pending maps
      setStagedDiffs(prev => {
        const copy = { ...prev };
        delete copy[path!];
        return copy;
      });
      setPendingDiffs(prev => {
        const copy = { ...prev };
        delete copy[path!];
        return copy;
      });
      setPendingDiff(prev => (prev?.filePath === path ? null : prev));
    } catch (err) {
      console.error('[VFSContext] Failed to accept and persist diff', err);
      throw err;
    }
  }, [files, stagedDiffs, pendingDiffs, pendingDiff]);

  const rejectDiff = useCallback((pathParam?: string) => {
    const path = pathParam || pendingDiff?.filePath;
    if (path) {
      setStagedDiffs(prev => {
        const copy = { ...prev };
        delete copy[path];
        return copy;
      });
      setPendingDiffs(prev => {
        const copy = { ...prev };
        delete copy[path];
        return copy;
      });
    }
    setPendingDiff(prev => (!path || prev?.filePath === path ? null : prev));
  }, [pendingDiff]);

  const clearAllDiffs = useCallback(() => {
    setStagedDiffs({});
    setPendingDiffs({});
    setPendingDiff(null);
  }, []);

  const enhanceUi = useCallback(async (blueprintId: string): Promise<Record<string, string>> => {
    setIsEnhancingUi(true);
    try {
      const res = await axios.post(
        `${BASE_URL}/api/blueprints/${blueprintId}/enhance-ui`,
        {},
        { headers: getAuthHeaders() }
      );
      const data = res.data?.data;
      if (data && data.files) {
        syncFilesState(data.files);
        return data.fileTree || {};
      }
      return {};
    } catch (err) {
      console.error('[VFSContext] Failed to enhance UI', err);
      throw err;
    } finally {
      setIsEnhancingUi(false);
    }
  }, []);

  const handleSetActiveFile = useCallback((file: VFSFile | string | null) => {
    if (!file) {
      setActiveFilePath(null);
    } else if (typeof file === 'string') {
      setActiveFilePath(file);
    } else {
      setActiveFilePath(file.path);
    }
  }, []);

  const activeFile = activeFilePath
    ? fileList.find(f => f.path === activeFilePath) || {
        path: activeFilePath,
        content: files[activeFilePath] || '',
        language: getLanguageFromPath(activeFilePath),
      }
    : null;

  return (
    <VFSContext.Provider
      value={{
        files,
        committedFiles: files,
        pendingDiff,
        pendingDiffs,
        stagedDiffs,
        fileList,
        activeFile,
        activeFilePath,
        setActiveFile: handleSetActiveFile,
        updateFile,
        stageDiff,
        stageFileDiff,
        acceptDiff,
        rejectDiff,
        clearAllDiffs,
        initVFS,
        loadVFS,
        enhanceUi,
        isLoadingVFS,
        isEnhancingUi,
      }}
    >
      {children}
    </VFSContext.Provider>
  );
};

export const useVFS = () => {
  const context = useContext(VFSContext);
  if (!context) {
    throw new Error('useVFS must be used within a VFSProvider');
  }
  return context;
};

export default VFSContext;
