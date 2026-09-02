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

export interface RuntimeErrorPayload {
  title?: string;
  message: string;
  line?: number;
  column?: number;
  path?: string;
}

interface VFSContextType {
  files: Record<string, string>;
  committedFiles: Record<string, string>;
  previewFiles: Record<string, string>;
  pendingDiff: PendingDiff | null;
  pendingDiffs: Record<string, PendingDiff>;
  stagedDiffs: Record<string, StagedDiff>;
  fileList: VFSFile[];
  activeFile: VFSFile | null;
  activeFilePath: string | null;
  activeFileLine: number | null;
  runtimeError: RuntimeErrorPayload | null;
  setRuntimeError: (err: RuntimeErrorPayload | null) => void;
  clearRuntimeError: () => void;
  setActiveFile: (file: VFSFile | string | null) => void;
  setActiveFileAndLine: (filePath: string, lineNumber?: number | null) => void;
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
  streamAgentPrompt: (
    blueprintId: string,
    prompt: string,
    model: string,
    callbacks?: AgentStreamCallbacks
  ) => Promise<void>;
  cancelAgentStream: () => void;
  isAgentExecuting: boolean;
}

export interface AgentStreamCallbacks {
  onThinking?: (step: string) => void;
  onTelemetry?: (telemetry: any) => void;
  onPlan?: (plan: string[]) => void;
  onPatch?: (patch: any) => void;
  onStagedDiff?: (diff: { path: string; original: string; modified: string }) => void;
  onPipelineHeartbeat?: (heartbeat: { elapsedMs: number; activeStage: string; activeModel: string }) => void;
  onPipelineStage?: (stagePayload: { stage: string; state: string; detail?: string }) => void;
  onDone?: (payload: any) => void;
  onError?: (error: string) => void;
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
  const [activeFileLine, setActiveFileLine] = useState<number | null>(null);
  const [runtimeError, setRuntimeError] = useState<RuntimeErrorPayload | null>(null);
  const [isLoadingVFS, setIsLoadingVFS] = useState<boolean>(false);
  const [isEnhancingUi, setIsEnhancingUi] = useState<boolean>(false);

  const clearRuntimeError = useCallback(() => {
    setRuntimeError((prev) => (prev ? null : prev));
  }, []);

  const setRuntimeErrorSafe = useCallback((err: RuntimeErrorPayload | null) => {
    setRuntimeError((prev) => {
      if (!prev && !err) return prev;
      if (
        prev &&
        err &&
        prev.message === err.message &&
        prev.title === err.title &&
        prev.path === err.path &&
        prev.line === err.line &&
        prev.column === err.column
      ) {
        return prev;
      }
      return err;
    });
  }, []);

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

    if (fileArray.length === 0) {
      setActiveFilePath('');
      return;
    }

    const activeFile = fileArray.find(f => f.path === activeFilePath);
    if (!activeFile) {
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
      if (data && Array.isArray(data.files)) {
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
      setRuntimeError(null);
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
    setActiveFileLine(null);
  }, []);

  const setActiveFileAndLine = useCallback((filePath: string, lineNumber?: number | null) => {
    setActiveFilePath(filePath);
    setActiveFileLine(lineNumber ?? 1);
  }, []);

  const activeFile = activeFilePath
    ? fileList.find(f => f.path === activeFilePath) || {
        path: activeFilePath,
        content: files[activeFilePath] || '',
        language: getLanguageFromPath(activeFilePath),
      }
    : null;

  // Unified previewFiles map: base files overlaid with any actively staged incoming diffs
  const previewFiles = React.useMemo(() => {
    const overlaid = { ...files };
    for (const [p, staged] of Object.entries(stagedDiffs)) {
      const incoming = staged.incomingCode || staged.incoming || (staged as any).modified;
      if (incoming !== undefined) {
        overlaid[p] = incoming;
      }
    }
    if (pendingDiff?.filePath) {
      const incoming = pendingDiff.incomingCode || pendingDiff.incoming || (pendingDiff as any).modified;
      if (incoming !== undefined) {
        overlaid[pendingDiff.filePath] = incoming;
      }
    }
    return overlaid;
  }, [files, stagedDiffs, pendingDiff]);

  const agentAbortRef = React.useRef<AbortController | null>(null);
  const [isAgentExecuting, setIsAgentExecuting] = useState(false);
  const agentLockRef = React.useRef(false);

  const cancelAgentStream = useCallback(() => {
    if (agentAbortRef.current) {
      agentAbortRef.current.abort();
      agentAbortRef.current = null;
    }
    agentLockRef.current = false;
    setIsAgentExecuting(false);
  }, []);

  const streamAgentPrompt = useCallback(
    async (
      blueprintId: string,
      prompt: string,
      model: string,
      callbacks?: AgentStreamCallbacks
    ): Promise<void> => {
      if (agentLockRef.current || isAgentExecuting) {
        console.warn('[VFSContext] Agent pipeline already active; ignoring concurrent trigger');
        return;
      }
      agentLockRef.current = true;
      setIsAgentExecuting(true);

      const controller = new AbortController();
      agentAbortRef.current = controller;

      const token = localStorage.getItem('buildx_token');
      let gotDone = false;

      try {
        const response = await fetch(`${BASE_URL}/api/agent/${blueprintId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            prompt,
            model,
            activeFilePath,
            activeFileContent: activeFilePath ? files[activeFilePath] : undefined,
            previewErrors: runtimeError ? [runtimeError] : undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const errBody = await response.text().catch(() => '');
          throw new Error(errBody || `Agent request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          if (controller.signal.aborted) {
            console.warn('[VFSContext:DIAG] Reader loop exiting: controller.signal.aborted=true');
            break;
          }
          const { done, value } = await reader.read();
          if (done) {
            console.log(`[VFSContext:DIAG] Reader loop exiting: done=true, gotDone=${gotDone}, aborted=${controller.signal.aborted}`);
            break;
          }
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let pendingEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              pendingEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              try {
                const payload = JSON.parse(raw);
                if (pendingEvent === 'thinking') {
                  callbacks?.onThinking?.(payload.step ?? '');
                } else if (pendingEvent === 'pipeline_heartbeat') {
                  callbacks?.onPipelineHeartbeat?.(payload);
                } else if (pendingEvent === 'pipeline_stage') {
                  callbacks?.onPipelineStage?.(payload);
                } else if (pendingEvent === 'agent_telemetry') {
                  callbacks?.onTelemetry?.(payload);
                } else if (pendingEvent === 'agent_plan') {
                  callbacks?.onPlan?.(payload.plan || []);
                } else if (pendingEvent === 'file_patch' || pendingEvent === 'agent_patch') {
                  callbacks?.onPatch?.(payload);
                  if (payload.filePath && payload.content) {
                    const orig = files[payload.filePath] || '';
                    if (orig.length > 200 && payload.content.length < 100) {
                      console.warn(`[VFSContext] Refusing to stage corrupt patch (<100 chars) for ${payload.filePath}`);
                    } else {
                      stageFileDiff(payload.filePath, payload.content, orig);
                    }
                  }
                } else if (pendingEvent === 'staged_diff') {
                  callbacks?.onStagedDiff?.(payload);
                  if (payload.path && payload.modified) {
                    const orig = payload.original || files[payload.path] || '';
                    if (orig.length > 200 && payload.modified.length < 100) {
                      console.warn(`[VFSContext] Refusing to stage corrupt diff (<100 chars) for ${payload.path}`);
                    } else {
                      stageFileDiff(payload.path, payload.modified, orig);
                    }
                  }
                } else if (pendingEvent === 'done' || pendingEvent === 'agent_complete') {
                  if (!gotDone) {
                    gotDone = true;
                    callbacks?.onDone?.(payload);
                  }
                } else if (pendingEvent === 'error') {
                  gotDone = true;
                  callbacks?.onError?.(payload.error || 'Agent encountered an error');
                }
              } catch {
                // ignore individual SSE parse lines
              }
            } else if (line === '') {
              pendingEvent = '';
            }
          }
        }

        if (!gotDone && !controller.signal.aborted) {
          console.error('[VFSContext:DIAG] Stream ended without done event. gotDone=false, aborted=false. This means the server closed the connection prematurely.');
          callbacks?.onError?.(
            'Connection closed before the agent finished. Try switching to Gemini 3.5 Flash for faster responses.'
          );
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          console.log('[VFSContext] Agent stream aborted by user action.');
        } else {
          callbacks?.onError?.(err.message || 'Failed to connect to agent');
        }
      } finally {
        agentLockRef.current = false;
        setIsAgentExecuting(false);
        if (agentAbortRef.current === controller) {
          agentAbortRef.current = null;
        }
        // Auto-sync files from backend to guarantee fresh workspace state
        loadVFS(blueprintId).catch(() => {});
      }
    },
    [files, stageFileDiff, isAgentExecuting]
  );

  return (
    <VFSContext.Provider
      value={{
        files,
        committedFiles: files,
        previewFiles,
        pendingDiff,
        pendingDiffs,
        stagedDiffs,
        fileList,
        activeFile,
        activeFilePath,
        activeFileLine,
        runtimeError,
        setRuntimeError: setRuntimeErrorSafe,
        clearRuntimeError,
        setActiveFile: handleSetActiveFile,
        setActiveFileAndLine,
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
        streamAgentPrompt,
        cancelAgentStream,
        isAgentExecuting,
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
