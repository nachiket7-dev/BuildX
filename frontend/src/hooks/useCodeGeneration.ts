import { useState, useCallback, useRef, useEffect } from 'react';
import { generateCodeStream, fetchBlueprintFilesWithContent, saveBlueprintFile, getAuthHeaders } from '../lib/api';
import { useVFS } from '../context/VFSContext';
import { currentJobClient, queuedJobsEnabled } from '../lib/jobClient';
import type { PendingJob } from '../lib/durableJobs';
import type { PipelineErrorEvent, PipelineStage, PipelineStageEvent, PatchApplyEvent } from '../lib/types';

export interface CodegenProgress {
  totalFiles: number;
  currentFileIndex: number;
  currentFilePath: string;
  status: 'idle' | 'generating' | 'loading' | 'completed' | 'review' | 'error';
  error: string | null;
  activeStage?: PipelineStage | null;
  retryable?: boolean;
  partialOutput?: boolean;
  failureStage?: PipelineStage;
}

export function useCodeGeneration() {
  const vfs=useVFS();const latestVfs=useRef(vfs);latestVfs.current=vfs;
  const queued=useRef<{scope:string;record:PendingJob}|null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<CodegenProgress>({
    totalFiles: 0,
    currentFileIndex: 0,
    currentFilePath: '',
    status: 'idle',
    error: null,
    activeStage: null,
    retryable: false,
    partialOutput: false,
  });
  const [files, setFiles] = useState<Record<string, string>>({});
  const [pipelineEvents, setPipelineEvents] = useState<PipelineStageEvent[]>([]);
  const [patchEvents, setPatchEvents] = useState<PatchApplyEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const operationGenRef = useRef(0);
  const lastRequestRef = useRef<{ blueprintId: string; model?: string } | null>(null);

  const detach = useCallback(() => {
    operationGenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setProgress(prev => ({ ...prev, status: 'idle' }));
  }, []);

  useEffect(()=>()=>{abortRef.current?.abort();},[]);
  const cancel=useCallback(()=>{
    if(queuedJobsEnabled && queued.current){
      const {scope,record}=queued.current;
      void currentJobClient().stop(scope,record).then(()=>{detach();queued.current=null;})
        .catch(err=>setProgress(prev=>({...prev,error:err.message})));
    }else detach();
  },[detach]);

  const clearFiles = useCallback(() => {
    setFiles({});
  }, []);

  const generateCode = useCallback(async (blueprintId: string, model?: string) => {
    detach();
    lastRequestRef.current = { blueprintId, model };
    const generation = ++operationGenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setProgress({
      totalFiles: 0,
      currentFileIndex: 0,
      currentFilePath: 'Initializing generator...',
      status: 'generating',
      error: null,
      activeStage: 'INGESTION',
      retryable: false,
      partialOutput: false,
    });
    setFiles({});
    setPipelineEvents([]);
    setPatchEvents([]);

    let sawDone = false;
    let pipelineFailure: PipelineErrorEvent | null = null;

    try {
      if(queuedJobsEnabled){
        const client=currentJobClient();const scope=`workspace:${blueprintId}`;
        if(Object.keys(latestVfs.current.stagedDiffs).length)throw new Error('Review or discard the existing candidate first');
        const record=client.begin(scope,`/api/agent/${blueprintId}/jobs`,{kind:'codegen',prompt:'Implement the complete application described by the saved blueprint. Preserve existing working behavior, validate the application and return reviewed file changes.',...(model?{model}:{})});
        queued.current={scope,record};
        const result=await client.watch<{stagedDiffs:Record<string,{original:string;modified:string}>}>(scope,record,controller.signal,job=>setProgress(prev=>({...prev,currentFilePath:`Worker ${job.status} · attempt ${job.attempt}`})));
        client.forget(scope,record);
        const current=Object.fromEntries((await fetchBlueprintFilesWithContent(blueprintId)).map(file=>[file.path,file.content]));
        controller.signal.throwIfAborted();
        for(const [path,diff] of Object.entries(result.stagedDiffs)){
          if((current[path]??'')!==diff.original || (path in latestVfs.current.files && latestVfs.current.files[path]!==diff.original))throw new Error('Workspace changed. Recover the candidate from run history after resolving edits.');
        }
        for(const [path,diff] of Object.entries(result.stagedDiffs))latestVfs.current.stageFileDiff(path,diff.modified,diff.original);
        setFiles(Object.fromEntries(Object.entries(result.stagedDiffs).map(([path,diff])=>[path,diff.modified])));
        setProgress(prev=>({...prev,status:'review',activeStage:null,currentFilePath:'Candidate ready — review changes before accepting',totalFiles:Object.keys(result.stagedDiffs).length}));
        setIsGenerating(false);queued.current=null;return;
      }
      const stream = generateCodeStream(blueprintId, model, controller.signal);

      for await (const event of stream) {
        if (controller.signal.aborted || generation !== operationGenRef.current) break;

        switch (event.event) {
          case 'pipeline_stage': {
            const data = event.data as PipelineStageEvent;
            setProgress(prev => ({ ...prev, activeStage: data.stage }));
            setPipelineEvents(prev => [...prev, data]);
            break;
          }
          case 'patch_apply': {
            const data = event.data as PatchApplyEvent;
            setPatchEvents(prev => [...prev, data]);
            break;
          }
          case 'codegen_start': {
            const data = event.data as { totalFiles: number };
            setProgress(prev => ({
              ...prev,
              totalFiles: data.totalFiles,
              currentFileIndex: 0
            }));
            break;
          }
          case 'codegen_file_start': {
            const data = event.data as { path: string; index: number };
            setProgress(prev => ({
              ...prev,
              currentFilePath: data.path,
              currentFileIndex: data.index
            }));
            break;
          }
          case 'codegen_file_ready': {
            const data = event.data as { path: string; index: number };
            setProgress(prev => ({
              ...prev,
              currentFilePath: `Validated ${data.path} — waiting for final commit`,
              currentFileIndex: data.index,
            }));
            break;
          }
          case 'codegen_file_done': {
            const data = event.data as { path: string; content: string };
            setFiles(prev => ({
              ...prev,
              [data.path]: data.content
            }));
            break;
          }
          case 'codegen_done': {
            sawDone = true;
            setProgress(prev => ({
              ...prev,
              currentFilePath: 'Code generation completed!',
              status: 'completed',
              activeStage: null,
            }));
            setIsGenerating(false);
            break;
          }
          case 'pipeline_error': {
            pipelineFailure = event.data as PipelineErrorEvent;
            setProgress(prev => ({
              ...prev,
              currentFilePath: pipelineFailure?.message || 'Pipeline failed before commit.',
              retryable: pipelineFailure?.retryable,
              partialOutput: pipelineFailure?.partial,
              failureStage: pipelineFailure?.stage,
            }));
            break;
          }
          case 'codegen_retry': {
            const data = event.data as { message: string; waitSeconds: number };
            setProgress(prev => ({
              ...prev,
              currentFilePath: `⏳ ${data.message}`
            }));
            break;
          }
          case 'error': {
            const data = event.data as { message: string };
            throw new Error(data.message);
          }
        }
      }

      if (!sawDone && !controller.signal.aborted && generation === operationGenRef.current) {
        throw new Error(pipelineFailure?.message || 'Code generation stream closed before completing.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[useCodeGeneration] Error:', err);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        error: err.message || 'Failed to generate application code.',
        retryable: pipelineFailure?.retryable ?? true,
        partialOutput: pipelineFailure?.partial ?? false,
        failureStage: pipelineFailure?.stage,
      }));
      setIsGenerating(false);
    }
  }, [detach]);

  const retry = useCallback(() => {
    const request = lastRequestRef.current;
    if (request) void generateCode(request.blueprintId, request.model);
  }, [generateCode]);

  const loadExistingFiles = useCallback(async (blueprintId: string) => {
    if (queuedJobsEnabled && getAuthHeaders().Authorization) {
      const pending = currentJobClient().pending(`workspace:${blueprintId}`);
      if (pending?.body.kind === 'codegen') {
        await generateCode(blueprintId, typeof pending.body.model === 'string' ? pending.body.model : undefined);
        return;
      }
    }
    detach();
    const generation = ++operationGenRef.current;
    setIsGenerating(true);
    setProgress({
      totalFiles: 0,
      currentFileIndex: 0,
      currentFilePath: 'Loading files from server...',
      status: 'loading',
      error: null
    });

    try {
      const fetched = await fetchBlueprintFilesWithContent(blueprintId);
      if (generation !== operationGenRef.current) return;

      const fileMap: Record<string, string> = {};
      fetched.forEach(f => {
        fileMap[f.path] = f.content;
      });

      setFiles(fileMap);
      setProgress({
        totalFiles: fetched.length,
        currentFileIndex: fetched.length,
        currentFilePath: 'Loaded successfully',
        status: 'completed',
        error: null
      });
    } catch (err: any) {
      if (generation !== operationGenRef.current) return;
      console.error('[useCodeGeneration] Load error:', err);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        error: err.message || 'Failed to load project files.'
      }));
    } finally {
      if (generation === operationGenRef.current) {
        setIsGenerating(false);
      }
    }
  }, [detach, generateCode]);

  const updateSingleFile = useCallback(async (blueprintId: string, path: string, content: string, language: string) => {
    setFiles(prev => ({ ...prev, [path]: content }));
    try {
      await saveBlueprintFile(blueprintId, path, content, language);
    } catch (err) {
      console.error(`[useCodeGeneration] Error saving file ${path}:`, err);
    }
  }, []);

  return {
    isGenerating,
    progress,
    files: queuedJobsEnabled && progress.status==='review' ? Object.fromEntries(Object.entries(files).filter(([path])=>path in vfs.stagedDiffs || path in vfs.files)) : files,
    pipelineEvents,
    patchEvents,
    generateCode,
    retry,
    loadExistingFiles,
    loadGeneratedFiles: loadExistingFiles,
    updateSingleFile,
    clearFiles,
    cancel
  };
}
