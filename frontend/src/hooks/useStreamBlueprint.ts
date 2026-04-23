import { useState, useCallback, useRef } from 'react';
import { generateBlueprintStream, fetchBlueprint, SSEEvent } from '../lib/api';
import type { Blueprint, PartialBlueprint } from '../lib/types';

interface UseStreamBlueprintResult {
  blueprint: Blueprint | null;
  partialBlueprint: PartialBlueprint;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  blueprintId: string | null;
  progress: number; // 0-100
  generate: (idea: string) => void;
  loadSaved: (id: string) => void;
  reset: () => void;
}

const SECTION_ORDER = [
  'appName', 'description', 'targetUsers', 'complexity',
  'features', 'schema', 'endpoints', 'screens',
  'architecture', 'code', 'effort',
] as const;

export function useStreamBlueprint(): UseStreamBlueprintResult {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [partialBlueprint, setPartialBlueprint] = useState<PartialBlueprint>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  const generate = useCallback(async (idea: string) => {
    setIsStreaming(true);
    setIsComplete(false);
    setError(null);
    setBlueprint(null);
    setPartialBlueprint({});
    setBlueprintId(null);
    setProgress(0);
    abortRef.current = false;

    try {
      const stream = generateBlueprintStream(idea);
      let sectionsReceived = 0;

      for await (const event of stream) {
        if (abortRef.current) break;

        switch ((event as SSEEvent).event) {
          case 'progress': {
            const data = (event as SSEEvent).data as { chars: number };
            // Estimate progress: typical blueprint is ~4000-6000 chars
            const estimated = Math.min(90, Math.round((data.chars / 5000) * 90));
            setProgress(estimated);
            break;
          }

          case 'section': {
            const data = (event as SSEEvent).data as { key: string; value: unknown };
            sectionsReceived++;
            const sectionProgress = Math.min(
              90,
              Math.round((sectionsReceived / SECTION_ORDER.length) * 90)
            );
            setProgress(sectionProgress);
            setPartialBlueprint(prev => ({ ...prev, [data.key]: data.value }));
            break;
          }

          case 'complete': {
            const data = (event as SSEEvent).data as Blueprint;
            setBlueprint(data);
            setPartialBlueprint(data);
            setProgress(95);
            break;
          }

          case 'saved': {
            const data = (event as SSEEvent).data as { id: string };
            setBlueprintId(data.id);
            setProgress(100);
            break;
          }

          case 'error': {
            const data = (event as SSEEvent).data as { message: string };
            throw new Error(data.message);
          }

          case 'status':
          case 'done':
            break;
        }
      }

      setIsComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const loadSaved = useCallback(async (id: string) => {
    setIsStreaming(true);
    setIsComplete(false);
    setError(null);
    setBlueprint(null);
    setPartialBlueprint({});
    setBlueprintId(id);
    setProgress(0);

    try {
      const saved = await fetchBlueprint(id);
      setBlueprint(saved);
      setPartialBlueprint(saved);
      setProgress(100);
      setIsComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blueprint.');
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setBlueprint(null);
    setPartialBlueprint({});
    setIsStreaming(false);
    setIsComplete(false);
    setError(null);
    setBlueprintId(null);
    setProgress(0);
  }, []);

  return {
    blueprint,
    partialBlueprint,
    isStreaming,
    isComplete,
    error,
    blueprintId,
    progress,
    generate,
    loadSaved,
    reset,
  };
}
