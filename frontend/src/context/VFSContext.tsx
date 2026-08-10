import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../lib/api';

export interface VFSFile {
  path: string;
  content: string;
  language: string;
}

interface VFSContextType {
  files: Record<string, string>;
  fileList: VFSFile[];
  activeFile: VFSFile | null;
  activeFilePath: string | null;
  setActiveFile: (file: VFSFile | string | null) => void;
  updateFile: (blueprintId: string, path: string, content: string) => Promise<void>;
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
        fileList,
        activeFile,
        activeFilePath,
        setActiveFile: handleSetActiveFile,
        updateFile,
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
