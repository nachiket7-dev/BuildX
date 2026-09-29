import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { generateBlueprintStream, fetchBlueprint, SSEEvent } from '../lib/api';
import type { Blueprint, PartialBlueprint, SavedBlueprint, AgentEvent, PipelineStage, PipelineStageEvent, StackSpec } from '../lib/types';

import { jobClient, queuedJobsEnabled } from '../lib/jobClient';
import { jobProgressLabel, type PendingJob } from '../lib/durableJobs';

export type { AgentEvent };

interface UseStreamBlueprintOptions {
  onSaved?: (id: string) => void;
  ownerId?: string;
  recover?: boolean;
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
  activeStage: PipelineStage | null;
  pipelineEvents: PipelineStageEvent[];
  retryable: boolean;
  generate: (idea: string, model: string, stack?: StackSpec) => void;
  retry: () => void;
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
  const { onSaved, ownerId, recover } = options;
  const jobs = useMemo(() => queuedJobsEnabled && ownerId ? jobClient(ownerId) : null, [ownerId]);
  const queuedRef = useRef<PendingJob | null>(null);
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
  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineStageEvent[]>([]);
  const [retryable, setRetryable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamSavedForRouteRef = useRef<string | null>(null);
  const streamBlueprintRef = useRef<Blueprint | null>(null);
  const loadGenerationRef = useRef(0);
  const blueprintRef = useRef<Blueprint | null>(null);
  const lastRequestRef = useRef<{ idea: string; model: string; stack?: StackSpec } | null>(null);
  blueprintRef.current = blueprint;

  const detach = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    if (!jobs) { detach(); return; }
    const record = queuedRef.current ?? jobs.pending('blueprint');
    if (!record) { detach(); return; }
    void jobs.stop('blueprint', record).then(() => {
      detach(); queuedRef.current = null; setIsStreaming(false); setActiveStage(null);
    }).catch(err => { if (queuedRef.current === record) setError(err instanceof Error ? err.message : 'Cancellation failed. Try Stop again.'); });
  }, [jobs, detach]);

  useEffect(() => detach, [jobs, detach]);

  const generate = useCallback(async (idea: string, model: string, stack?: StackSpec) => {
    detach();
    lastRequestRef.current = { idea, model, stack };
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
    setActiveStage('PLANNING');
    setPipelineEvents([]);
    setRetryable(false);
    streamBlueprintRef.current = null;
    streamSavedForRouteRef.current = null;

    let gotComplete = false;
    let gotSaved = false;

    try {
      const queuedStream = async function* (): AsyncGenerator<SSEEvent> {
        if (!jobs) return;
        const record = jobs.begin('blueprint', '/api/agent/blueprint-jobs', { idea, model, ...(stack ? { stack } : {}) });
        queuedRef.current = record;
        let lastStatus = '';
        const result = await jobs.watch<{id: string; data: Blueprint}>('blueprint', record, controller.signal, job => {
          const status = `${job.status}:${job.nextAttemptAt || ''}`;
          if (status === lastStatus) return;
          lastStatus = status;
          setAgentEvents(prev => [...prev, { agent: 'pm', status: 'thinking', log: job.status === 'completed' ? 'Blueprint saved' : jobProgressLabel(job), timestamp: new Date().toLocaleTimeString() }]);
        });
        yield { event: 'complete', data: result.data };
        yield { event: 'saved', data: { id: result.id } };
        jobs.forget('blueprint', record);
        queuedRef.current = null;
      };
      const stream = jobs ? queuedStream() : generateBlueprintStream(idea, model, stack, controller.signal);
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

          case 'pipeline_stage': {
            const data = sseEvent.data as PipelineStageEvent;
            setActiveStage(data.stage);
            setPipelineEvents((prev) => [...prev, data]);
            break;
          }

          case 'agent_event': {
            const data = sseEvent.data as {
              agent: AgentEvent['agent'];
              status: AgentEvent['status'];
              log?: string;
              message?: string;
              stage?: PipelineStage;
            };
            if (data.stage) setActiveStage(data.stage);
            setAgentEvents((prev) => [
              ...prev,
              {
                agent: data.agent,
                status: data.status,
                log: data.log,
                message: data.message,
                stage: data.stage,
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
            queueMicrotask(() => onSavedRef.current?.(data.id));
            break;
          }

          case 'error': {
            const data = sseEvent.data as { message: string };
            throw new Error(data.message);
          }

          case 'pipeline_error': {
            setRetryable(true);
            break;
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
      if (controller.signal.aborted) return;
      setRetryable(true);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      if (abortRef.current === controller || !abortRef.current) {
        setIsStreaming(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  }, [detach, jobs]);

  useEffect(() => {
    if (!jobs || !recover) return;
    try {
      const record = jobs.pending('blueprint');
      if (record && (!abortRef.current || abortRef.current.signal.aborted)) {
        const request = record.body as {idea: string; model: string; stack?: StackSpec};
        void generate(request.idea, request.model, request.stack);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Recovery failed'); }
  }, [jobs, recover, generate]);

  const retry = useCallback(() => {
    const request = lastRequestRef.current;
    if (request) void generate(request.idea, request.model, request.stack);
  }, [generate]);

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

    detach();
    const generation = ++loadGenerationRef.current;

    setIsStreaming(true);
    setError(null);
    setBlueprint(null);
    setSavedMeta(null);
    setPartialBlueprint({});
    setBlueprintId(id);
    setProgress(0);
    setAgentEvents([]);
    setActiveStage(null);
    setPipelineEvents([]);
    setRetryable(false);
    streamBlueprintRef.current = null;
    streamSavedForRouteRef.current = null;

    try {
      const saved = await fetchBlueprint(id);
      if (generation !== loadGenerationRef.current) return;
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
  }, [detach, blueprintId]);

  const reset = useCallback(() => {
    detach();
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
    setActiveStage(null);
    setPipelineEvents([]);
    setRetryable(false);
  }, [detach]);

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
    activeStage,
    pipelineEvents,
    retryable,
    generate,
    retry,
    loadSaved,
    isStreamSavedRoute,
    updateBlueprint,
    reset,
    cancel,
  };
}
