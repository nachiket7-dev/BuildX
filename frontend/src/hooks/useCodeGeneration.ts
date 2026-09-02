import { useState, useCallback, useRef } from 'react';
import { generateCodeStream, fetchBlueprintFilesWithContent, saveBlueprintFile } from '../lib/api';
import type { PipelineErrorEvent, PipelineStage, PipelineStageEvent, PatchApplyEvent } from '../lib/types';

export interface CodegenProgress {
  totalFiles: number;
  currentFileIndex: number;
  currentFilePath: string;
  status: 'idle' | 'generating' | 'loading' | 'completed' | 'error';
  error: string | null;
  activeStage?: PipelineStage | null;
  retryable?: boolean;
  partialOutput?: boolean;
  failureStage?: PipelineStage;
}

export function useCodeGeneration() {
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

  const cancel = useCallback(() => {
    operationGenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setProgress(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles({});
  }, []);

  const generateCode = useCallback(async (blueprintId: string, model?: string) => {
    cancel();
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
  }, [cancel]);

  const retry = useCallback(() => {
    const request = lastRequestRef.current;
    if (request) void generateCode(request.blueprintId, request.model);
  }, [generateCode]);

  const loadExistingFiles = useCallback(async (blueprintId: string) => {
    cancel();
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
  }, [cancel]);

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
    files,
    pipelineEvents,
    patchEvents,
    generateCode,
    retry,
    loadExistingFiles,
    updateSingleFile,
    clearFiles,
    cancel
  };
}
