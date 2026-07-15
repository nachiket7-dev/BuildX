import { useState, useCallback, useRef } from 'react';
import { generateBlueprintStream, fetchBlueprint, SSEEvent } from '../lib/api';
import type { Blueprint, PartialBlueprint, SavedBlueprint } from '../lib/types';

export interface AgentEvent {
  agent: 'pm' | 'architect' | 'api_dev' | 'designer' | 'coder' | 'qa';
  status: 'idle' | 'thinking' | 'writing' | 'correcting' | 'completed';
  log?: string;
  message?: string;
  timestamp: string;
}

interface UseStreamBlueprintOptions {
  onSaved?: (id: string) => void;
}

interface UseStreamBlueprintResult {
  blueprint: Blueprint | null;
  savedMeta: Pick<SavedBlueprint, 'isPublic' | 'views' | 'isOwner'> | null;
  partialBlueprint: PartialBlueprint;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  blueprintId: string | null;
  progress: number;
  agentEvents: AgentEvent[];
  generate: (idea: string, model: string) => void;
  loadSaved: (id: string) => void;
  isStreamSavedRoute: (id: string) => boolean;
  updateBlueprint: (next: Blueprint) => void;
  reset: () => void;
  cancel: () => void;
}

const SECTION_ORDER = [
  'appName', 'description', 'targetUsers', 'complexity',
  'features', 'schema', 'endpoints', 'screens',
  'architecture', 'code', 'effort',
] as const;

export function useStreamBlueprint(options: UseStreamBlueprintOptions = {}): UseStreamBlueprintResult {
  const { onSaved } = options;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [savedMeta, setSavedMeta] = useState<Pick<SavedBlueprint, 'isPublic' | 'views' | 'isOwner'> | null>(null);
  const [partialBlueprint, setPartialBlueprint] = useState<PartialBlueprint>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  /** Set synchronously on SSE `saved` so route load can skip before blueprintId state commits */
  const streamSavedForRouteRef = useRef<string | null>(null);
  /** Set synchronously on SSE `complete` so route load never clobbers streamed content */
  const streamBlueprintRef = useRef<Blueprint | null>(null);
  const loadGenerationRef = useRef(0);
  const blueprintRef = useRef<Blueprint | null>(null);
  blueprintRef.current = blueprint;

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const generate = useCallback(async (idea: string, model: string) => {
    cancel();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setIsComplete(false);
    setError(null);
    setBlueprint(null);
    setSavedMeta(null);
    setPartialBlueprint({});
    setBlueprintId(null);
    setProgress(0);
    setAgentEvents([]);
    streamBlueprintRef.current = null;
    streamSavedForRouteRef.current = null;

    let gotComplete = false;
    let gotSaved = false;

    try {
      const stream = generateBlueprintStream(idea, model, controller.signal);
      let sectionsReceived = 0;

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        const sseEvent = event as SSEEvent;

        switch (sseEvent.event) {
          case 'progress': {
            const data = sseEvent.data as { percent?: number; chars?: number };
            if (data.percent !== undefined) {
              setProgress(data.percent);
            } else if (data.chars !== undefined) {
              const estimated = Math.min(90, Math.round((data.chars / 5000) * 90));
              setProgress(estimated);
            }
            break;
          }

          case 'agent_event': {
            const data = sseEvent.data as {
              agent: AgentEvent['agent'];
              status: AgentEvent['status'];
              log?: string;
              message?: string;
            };
            setAgentEvents((prev) => [
              ...prev,
              {
                agent: data.agent,
                status: data.status,
                log: data.log,
                message: data.message,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
            break;
          }

          case 'section': {
            const data = sseEvent.data as { key: string; value: unknown };
            sectionsReceived++;
            const sectionProgress = Math.min(
              90,
              Math.round((sectionsReceived / SECTION_ORDER.length) * 90)
            );
            setProgress(sectionProgress);
            setPartialBlueprint((prev) => ({ ...prev, [data.key]: data.value }));
            break;
          }

          case 'complete': {
            const data = sseEvent.data as Blueprint;
            streamBlueprintRef.current = data;
            setBlueprint(data);
            setPartialBlueprint(data);
            setProgress(95);
            gotComplete = true;
            break;
          }

          case 'saved': {
            const data = sseEvent.data as { id: string };
            streamSavedForRouteRef.current = data.id;
            setBlueprintId(data.id);
            setProgress(100);
            gotSaved = true;
            // Defer navigation so React commits the `complete` blueprint before the route effect runs
            queueMicrotask(() => onSavedRef.current?.(data.id));
            break;
          }

          case 'error': {
            const data = sseEvent.data as { message: string };
            throw new Error(data.message);
          }

          case 'status':
          case 'done':
            break;
        }
      }

      if (!controller.signal.aborted && gotComplete && gotSaved) {
        setIsComplete(true);
      } else if (!controller.signal.aborted && gotComplete && !gotSaved) {
        setError('Blueprint generated but could not be saved. Check your database connection.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [cancel]);

  const isStreamSavedRoute = useCallback(
    (id: string) => streamSavedForRouteRef.current === id,
    []
  );

  const updateBlueprint = useCallback((next: Blueprint) => {
    streamBlueprintRef.current = next;
    setBlueprint(next);
    setPartialBlueprint(next);
    setIsComplete(true);
  }, []);

  const loadSaved = useCallback(async (id: string) => {
    const existingBlueprint = blueprintRef.current ?? streamBlueprintRef.current;
    const isSessionBlueprint = Boolean(
      existingBlueprint && (blueprintId === id || streamSavedForRouteRef.current === id)
    );

    // Keep in-memory streamed blueprint — only refresh ownership/meta from API
    if (isSessionBlueprint) {
      const generation = ++loadGenerationRef.current;
      setError(null);
      setBlueprintId(id);
      setProgress(100);
      setIsComplete(true);
      setIsStreaming(false);
      if (!blueprintRef.current && streamBlueprintRef.current) {
        setBlueprint(streamBlueprintRef.current);
        setPartialBlueprint(streamBlueprintRef.current);
      }
      try {
        const saved = await fetchBlueprint(id);
        if (generation !== loadGenerationRef.current) return;
        // Never replace a freshly streamed blueprint with the API parse path
        if (streamSavedForRouteRef.current === id || streamBlueprintRef.current) {
          streamSavedForRouteRef.current = null;
          setSavedMeta({
            isPublic: saved.isPublic ?? false,
            views: saved.views,
            isOwner: saved.isOwner ?? false,
          });
          return;
        }
        setSavedMeta({
          isPublic: saved.isPublic ?? false,
          views: saved.views,
          isOwner: saved.isOwner ?? false,
        });
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load blueprint.');
      }
      return;
    }

    cancel();
    const generation = ++loadGenerationRef.current;

    setIsStreaming(true);
    setError(null);
    setBlueprint(null);
    setSavedMeta(null);
    setPartialBlueprint({});
    setBlueprintId(id);
    setProgress(0);
    setAgentEvents([]);
    streamBlueprintRef.current = null;
    streamSavedForRouteRef.current = null;

    try {
      const saved = await fetchBlueprint(id);
      if (generation !== loadGenerationRef.current) return;
      // A stream handoff finished while this fetch was in flight — keep streamed content
      if (streamBlueprintRef.current && streamSavedForRouteRef.current === id) {
        setBlueprint(streamBlueprintRef.current);
        setPartialBlueprint(streamBlueprintRef.current);
        streamSavedForRouteRef.current = null;
        setSavedMeta({
          isPublic: saved.isPublic ?? false,
          views: saved.views,
          isOwner: saved.isOwner ?? false,
        });
        setProgress(100);
        setIsComplete(true);
        return;
      }
      setBlueprint(saved);
      setPartialBlueprint(saved);
      setSavedMeta({
        isPublic: saved.isPublic ?? false,
        views: saved.views,
        isOwner: saved.isOwner ?? false,
      });
      setProgress(100);
      setIsComplete(true);
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load blueprint.');
    } finally {
      if (generation === loadGenerationRef.current) {
        setIsStreaming(false);
      }
    }
  }, [cancel, blueprintId]);

  const reset = useCallback(() => {
    cancel();
    loadGenerationRef.current += 1;
    streamSavedForRouteRef.current = null;
    streamBlueprintRef.current = null;
    setBlueprint(null);
    setSavedMeta(null);
    setPartialBlueprint({});
    setIsStreaming(false);
    setIsComplete(false);
    setError(null);
    setBlueprintId(null);
    setProgress(0);
    setAgentEvents([]);
  }, [cancel]);

  return {
    blueprint,
    savedMeta,
    partialBlueprint,
    isStreaming,
    isComplete,
    error,
    blueprintId,
    progress,
    agentEvents,
    generate,
    loadSaved,
    isStreamSavedRoute,
    updateBlueprint,
    reset,
    cancel,
  };
}
