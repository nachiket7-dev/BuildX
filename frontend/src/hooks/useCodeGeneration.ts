import { useState, useCallback, useRef } from 'react';
import { generateCodeStream, fetchBlueprintFilesWithContent, saveBlueprintFile } from '../lib/api';

export interface CodegenProgress {
  totalFiles: number;
  currentFileIndex: number;
  currentFilePath: string;
  status: 'idle' | 'generating' | 'loading' | 'completed' | 'error';
  error: string | null;
}

export function useCodeGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<CodegenProgress>({
    totalFiles: 0,
    currentFileIndex: 0,
    currentFilePath: '',
    status: 'idle',
    error: null
  });
  const [files, setFiles] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const operationGenRef = useRef(0);

  const cancel = useCallback(() => {
    operationGenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setProgress(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const generateCode = useCallback(async (blueprintId: string, model: string) => {
    cancel();
    const generation = ++operationGenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setProgress({
      totalFiles: 0,
      currentFileIndex: 0,
      currentFilePath: 'Initializing generator...',
      status: 'generating',
      error: null
    });
    setFiles({});

    let sawDone = false;

    try {
      const stream = generateCodeStream(blueprintId, model, controller.signal);

      for await (const event of stream) {
        if (controller.signal.aborted || generation !== operationGenRef.current) break;

        switch (event.event) {
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
              status: 'completed'
            }));
            setIsGenerating(false);
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
            const isRateLimit =
              data.message?.toLowerCase().includes('rate limit') ||
              data.message?.toLowerCase().includes('resourceexhausted') ||
              data.message?.toLowerCase().includes('request limit');
            throw new Error(
              isRateLimit
                ? `Rate limit reached — switch to a different model (e.g. Gemini 2.5 Flash) or wait a minute and retry.`
                : data.message
            );
          }
        }
      }

      if (generation === operationGenRef.current && !controller.signal.aborted && !sawDone) {
        setIsGenerating(false);
        setProgress(prev => ({
          ...prev,
          status: 'error',
          error: 'Code generation stream ended unexpectedly. Please try again.',
        }));
      }
    } catch (err: unknown) {
      if (generation !== operationGenRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[Codegen Hook] Generation failed:', err);
      setIsGenerating(false);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Generation failed. Please try again.'
      }));
    } finally {
      abortRef.current = null;
    }
  }, [cancel]);

  const loadGeneratedFiles = useCallback(async (blueprintId: string) => {
    const generation = ++operationGenRef.current;
    setIsGenerating(false);
    setProgress({
      totalFiles: 0,
      currentFileIndex: 0,
      currentFilePath: 'Loading files...',
      status: 'loading',
      error: null,
    });

    try {
      const loaded = await fetchBlueprintFilesWithContent(blueprintId);
      if (generation !== operationGenRef.current) return;

      const loadedFiles: Record<string, string> = Object.fromEntries(
        loaded.map((file) => [file.path, file.content])
      );

      setFiles(loadedFiles);
      setProgress({
        totalFiles: loaded.length,
        currentFileIndex: loaded.length,
        currentFilePath: '',
        status: loaded.length > 0 ? 'completed' : 'idle',
        error: null
      });
    } catch (err: unknown) {
      if (generation !== operationGenRef.current) return;
      console.error('[Codegen Hook] Loading files failed:', err);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        error: 'Failed to load generated code files.'
      }));
    }
  }, []);

  const clearFiles = useCallback(() => {
    operationGenRef.current += 1;
    setFiles({});
    setProgress({
      totalFiles: 0,
      currentFileIndex: 0,
      currentFilePath: '',
      status: 'idle',
      error: null,
    });
  }, []);

  const saveFileContent = useCallback(async (blueprintId: string, path: string, content: string, language: string) => {
    try {
      await saveBlueprintFile(blueprintId, path, content, language);
      setFiles(prev => ({
        ...prev,
        [path]: content
      }));
    } catch (err) {
      console.error('[Codegen Hook] Save file failed:', err);
      throw err;
    }
  }, []);

  return {
    isGenerating,
    progress,
    files,
    generateCode,
    loadGeneratedFiles,
    clearFiles,
    saveFileContent,
    cancel
  };
}
