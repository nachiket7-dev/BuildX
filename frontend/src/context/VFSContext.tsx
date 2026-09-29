import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { jobClient, queuedJobsEnabled } from '../lib/jobClient';
import { jobProgressLabel, type PendingJob } from '../lib/durableJobs';
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
    callbacks?: AgentStreamCallbacks,
    resumeRunId?: string
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
  const { user } = useAuth();
  const jobs = React.useMemo(() => queuedJobsEnabled && user ? jobClient(user.id) : null, [user]);
  const queuedRef = React.useRef<{ scope: string; record: PendingJob } | null>(null);
  const onCancelError = React.useRef<((error: string) => void) | undefined>();
  const [files, setFiles] = useState<Record<string, string>>({});
  const latestFiles = React.useRef(files);
  latestFiles.current = files;
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

  const syncFilesState = useCallback((fileArray: VFSFile[]) => {
    setFiles(Object.fromEntries(fileArray.map(file=>[file.path,file.content])));
    setFileList(fileArray);
    setActiveFilePath(current=>fileArray.some(file=>file.path===current) ? current : (fileArray.find(file=>file.path!=='preview.html' && /\.tsx?$/.test(file.path)) || fileArray[0])?.path || '');
  }, []);

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
  }, [syncFilesState]);

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
  }, [syncFilesState]);

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
          { path, content: codeToCommit, expectedContent: staged?.originalCode ?? files[path] ?? '' },
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
  const activeRunRef = React.useRef<{ blueprintId: string; runId: string } | null>(null);

  const cancelRequestedRef = React.useRef(false);
  const cancelAgentStream = useCallback(() => {
    cancelRequestedRef.current = true;
    if (jobs && queuedRef.current) {
      const { scope, record } = queuedRef.current;
      void jobs.stop(scope, record).catch(error => onCancelError.current?.(error instanceof Error ? error.message : 'Stop failed. Try again.'));
      return;
    }
    const run = activeRunRef.current;
    // Keep the connection until acknowledgement so Stop cannot leave a hidden run.
    if (run) void axios.post(`${BASE_URL}/api/agent/${run.blueprintId}/runs/${run.runId}/cancel`, {}, { headers: getAuthHeaders() })
      .catch(error => console.error('[VFSContext] Cancellation failed', error));
  }, [jobs]);

  React.useEffect(() => () => { agentAbortRef.current?.abort(); }, []);

  const streamAgentPrompt = useCallback(
    async (
      blueprintId: string,
      prompt: string,
      model: string,
      callbacks?: AgentStreamCallbacks,
    resumeRunId?: string
    ): Promise<void> => {
      if (agentLockRef.current || isAgentExecuting) {
        console.warn('[VFSContext] Agent pipeline already active; ignoring concurrent trigger');
        return;
      }
      if (Object.keys(stagedDiffs).length) {
        callbacks?.onError?.('Review or discard the staged changes before starting another run.');
        return;
      }
      agentLockRef.current = true;
      setIsAgentExecuting(true);

      cancelRequestedRef.current = false;
      const controller = new AbortController();
      agentAbortRef.current = controller;

      const token = localStorage.getItem('buildx_token');
      let gotDone = false;

      let sequence = 0;
      const dispatch = (event: string, payload: any) => {
                if (event === 'run_started') {
                  activeRunRef.current = { blueprintId, runId: payload.runId };
                  if (cancelRequestedRef.current) cancelAgentStream();
                } else if (event === 'thinking') {
                  callbacks?.onThinking?.(payload.step ?? '');
                } else if (event === 'pipeline_heartbeat') {
                  callbacks?.onPipelineHeartbeat?.(payload);
                } else if (event === 'pipeline_stage') {
                  callbacks?.onPipelineStage?.(payload);
                } else if (event === 'agent_telemetry') {
                  callbacks?.onTelemetry?.(payload);
                } else if (event === 'agent_plan') {
                  callbacks?.onPlan?.(payload.plan || []);
                } else if (event === 'file_patch' || event === 'agent_patch') {
                  callbacks?.onPatch?.(payload);
                  if (payload.filePath && payload.content) {
                    const orig = files[payload.filePath] || '';
                    if (orig.length > 200 && payload.content.length < 100) {
                      console.warn(`[VFSContext] Refusing to stage corrupt patch (<100 chars) for ${payload.filePath}`);
                    } else {
                      stageFileDiff(payload.filePath, payload.content, orig);
                    }
                  }
                } else if (event === 'staged_diff') {
                  callbacks?.onStagedDiff?.(payload);
                  if (payload.path && typeof payload.modified === 'string') {
                    stageFileDiff(payload.path, payload.modified, payload.original ?? files[payload.path] ?? '');
                  }
                } else if (event === 'done' || event === 'agent_complete') {
                  if (!gotDone) {
                    gotDone = true;
                    callbacks?.onDone?.(payload);
                  }
                } else if (event === 'error') {
                  gotDone = true;
                  callbacks?.onError?.(payload.error || 'Agent encountered an error');
                }
      };
      const recover = async () => {
        const run = activeRunRef.current;
        if (!run) throw new Error('Connection interrupted before the run was acknowledged. Check run history.');
        callbacks?.onThinking?.('Reconnecting to the saved run');
        const deadline = Date.now() + 9 * 60_000;
        while (!controller.signal.aborted && Date.now() < deadline) {
          const response = await fetch(`${BASE_URL}/api/agent/${blueprintId}/runs/${run.runId}?after=${sequence}`, { headers: getAuthHeaders(), signal: controller.signal });
          if (!response.ok) throw new Error('Could not retrieve saved run');
          const saved = await response.json();
          for (const item of saved.events || []) {
            if (item.sequence <= sequence) continue;
            dispatch(item.event, item.data);
            sequence = item.sequence;
          }
          if (gotDone) return;
          if (saved.status === 'completed' && saved.result) {
            for (const [path, diff] of Object.entries(saved.result.stagedDiffs || {})) dispatch('staged_diff', { path, ...(diff as object) });
            dispatch('done', saved.result); return;
          }
          if (saved.status !== 'running') throw new Error(saved.error || 'Run interrupted. Resume it from run history.');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!controller.signal.aborted) throw new Error('Run is still pending. Check run history.');
      };
      try {
        if (jobs && (!resumeRunId || resumeRunId.startsWith('job:'))) {
          const scope = `workspace:${blueprintId}`;
          const endpoint = `/api/agent/${blueprintId}/jobs`;
          const body = { kind: 'chat', prompt, model, ...(activeFilePath ? { activeFilePath } : {}), ...(runtimeError ? { previewErrors: [runtimeError] } : {}) };
          const record = resumeRunId
            ? await jobs.attach(scope, { key: crypto.randomUUID(), endpoint, body, jobId: resumeRunId.slice(4) })
            : jobs.begin(scope, endpoint, body);
          queuedRef.current = { scope, record };
          onCancelError.current = callbacks?.onError;
          if (cancelRequestedRef.current) cancelAgentStream();
          const result = await jobs.watch<{message: string; stagedDiffs: Record<string, {original: string; modified: string}>}>(scope, record, controller.signal, job => {
            callbacks?.onThinking?.(jobProgressLabel(job));
          });
          // The completed result remains available in server history, even when
          // current edits prevent staging it. Release the local submission slot.
          jobs.forget(scope, record);
          const currentResponse = await fetch(`${BASE_URL}/api/blueprints/${blueprintId}/vfs`, { headers: getAuthHeaders(), signal: controller.signal });
          if (!currentResponse.ok) throw new Error('Cannot verify current files before staging');
          const current = (await currentResponse.json()).data.fileTree;
          for (const [path, diff] of Object.entries(result.stagedDiffs)) {
            if ((latestFiles.current[path] ?? '') !== diff.original || (current[path] ?? '') !== diff.original)
              throw new Error('Workspace changed. Review saved changes from history after resolving local edits.');
          }
          for (const [path, diff] of Object.entries(result.stagedDiffs)) dispatch('staged_diff', { path, ...diff });
          dispatch('done', result);
          return;
        }
        const response = await fetch(`${BASE_URL}/api/agent/${blueprintId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            prompt,
            model,
            resumeRunId,
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
        // SSE event name persists across chunks: an `event:` line and its `data:`
        // line may arrive in different network chunks, so this must NOT be reset
        // per read — only after the blank line that terminates an SSE message.
        let pendingEvent = '';
        let pendingSequence = sequence;

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

          for (const line of lines) {
            if (line.startsWith('id: ')) {
              pendingSequence = Number(line.slice(4)) || sequence;
            } else if (line.startsWith('event: ')) {
              pendingEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              try {
                dispatch(pendingEvent, JSON.parse(raw));
                sequence = pendingSequence;
              } catch {
                // ignore individual SSE parse lines
              }
            } else if (line === '') {
              pendingEvent = '';
            }
          }
        }

        if (!gotDone && !controller.signal.aborted) await recover();
      } catch (err: any) {
        if (!controller.signal.aborted) {
          try { if (!gotDone && activeRunRef.current) await recover(); else throw err; }
          catch (recoveryError) { callbacks?.onError?.(recoveryError instanceof Error ? recoveryError.message : 'Failed to recover run'); }
        }
      } finally {
        activeRunRef.current = null;
        queuedRef.current = null;
        onCancelError.current = undefined;
        agentLockRef.current = false;
        setIsAgentExecuting(false);
        if (agentAbortRef.current === controller) {
          agentAbortRef.current = null;
        }
        // Auto-sync files from backend to guarantee fresh workspace state
        if (!jobs || (resumeRunId && !resumeRunId.startsWith('job:'))) loadVFS(blueprintId).catch(() => {});
      }
    },
    [files, stagedDiffs, stageFileDiff, isAgentExecuting, activeFilePath, runtimeError, loadVFS, cancelAgentStream, jobs]
  );

  const enhanceUi = useCallback(async (blueprintId: string): Promise<Record<string, string>> => {
    if (agentLockRef.current || isAgentExecuting) throw new Error('Another agent request is already running');
    setIsEnhancingUi(true);
    try {
      if (jobs) {
        let failure: string | undefined;
        await streamAgentPrompt(blueprintId, 'Improve the interface hierarchy, spacing, accessibility and responsive behavior. Preserve the application identity and working features. Inspect the actual files, validate the changes, and stage them for review.', 'pipeline', {onError:message=>{failure=message;}});
        if (failure) throw new Error(failure);
        return {};
      }
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
  }, [syncFilesState, jobs, streamAgentPrompt, isAgentExecuting]);

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
