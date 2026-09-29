import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { refineBlueprint } from '../lib/api';
import { currentJobClient, queuedJobsEnabled } from '../lib/jobClient';
import { stopSpecJob } from '../lib/specJobs';
import { jobProgressLabel } from '../lib/durableJobs';
import { useToast } from './useToast';
import type { Blueprint } from '../lib/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  modelUsed?: string;
  wasFallback?: boolean;
  telemetry?: {
    planner?: { modelUsed: string; executionTimeMs?: number; wasFallback?: boolean };
    patches?: Array<{ filePath: string; modelUsed: string; executionTimeMs?: number; wasFallback?: boolean }>;
  };
}

function listNewItems(before: string[], after: string[]): string[] {
  return after.filter((item) => !before.includes(item));
}

function buildRefineSummary(
  original: Blueprint,
  updated: Blueprint,
  userRequest: string
): string {
  const details: string[] = [];

  const origArch = original.architecture ?? {
    frontend: '', backend: '', database: '', auth: '', hosting: '', flow: '',
  };
  const updArch = updated.architecture ?? origArch;

  const archFields: Array<keyof Blueprint['architecture']> = [
    'frontend',
    'backend',
    'database',
    'auth',
    'hosting',
  ];

  for (const field of archFields) {
    if (updArch[field] !== origArch[field]) {
      details.push(
        `${field} moved from ${origArch[field]} to ${updArch[field]}`
      );
    }
  }

  if (updated.complexity !== original.complexity) {
    details.push(`complexity revised from ${original.complexity} to ${updated.complexity}`);
  }

  const origFeatures = original.features ?? { authentication: [], core: [], admin: [], optional: [] };
  const updFeatures = updated.features ?? origFeatures;

  const featureGroups: Array<keyof Blueprint['features']> = [
    'authentication',
    'core',
    'admin',
    'optional',
  ];

  for (const group of featureGroups) {
    const added = listNewItems(origFeatures[group] ?? [], updFeatures[group] ?? []);
    if (added.length > 0) {
      const label = group === 'core' ? 'core features' : `${group} features`;
      details.push(`added ${label}: ${added.join(', ')}`);
    }
  }

  const origSchema = original.schema ?? [];
  const updSchema = updated.schema ?? [];

  if (updSchema.length !== origSchema.length) {
    details.push(
      `data model now includes ${updSchema.length} table${updSchema.length === 1 ? '' : 's'} (previously ${origSchema.length})`
    );
  } else {
    const renamedTables = updSchema.filter(
      (table, index) => table.table !== origSchema[index]?.table
    );
    if (renamedTables.length > 0) {
      details.push(`schema tables updated (${renamedTables.map((t) => t.table).join(', ')})`);
    }
  }

  const origEndpoints = original.endpoints ?? [];
  const updEndpoints = updated.endpoints ?? [];

  if (updEndpoints.length !== origEndpoints.length) {
    details.push(
      `API expanded to ${updEndpoints.length} endpoint${updEndpoints.length === 1 ? '' : 's'} (was ${origEndpoints.length})`
    );
  }

  const origScreens = (original.screens ?? []).map((s) => s.name);
  const updScreens = (updated.screens ?? []).map((s) => s.name);
  const newScreens = listNewItems(origScreens, updScreens);
  if (newScreens.length > 0) {
    details.push(`new screens added: ${newScreens.join(', ')}`);
  }

  const intro = `Your request for "${updated.appName}" has been applied.`;

  if (details.length === 0) {
    return `${intro} Based on "${userRequest}", the blueprint description, architecture notes, and related sections were refreshed. Open the Architecture, Schema, API, and Screens tabs to review the updated plan in full.`;
  }

  const changeList = details.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join('. ');
  return `${intro} ${changeList}. Check the updated tabs to explore the full blueprint.`;
}

interface UseRefinementResult {
  messages: ChatMessage[];
  isRefining: boolean;
  progress: string | null;
  error: string | null;
  refine: (message: string, model: string) => void;
  clearHistory: () => void;
  stop: () => void;
}

function historyStorageKey(blueprintId?: string | null): string {
  return blueprintId ? `buildx_refine_history_${blueprintId}` : 'buildx_refine_history_draft';
}

function loadStoredMessages(key: string): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.filter((m) => m?.content && m?.role) : [];
  } catch {
    return [];
  }
}

function migrateDraftHistory(blueprintId: string): void {
  const draftKey = 'buildx_refine_history_draft';
  const idKey = historyStorageKey(blueprintId);
  const draft = sessionStorage.getItem(draftKey);
  if (!draft || sessionStorage.getItem(idKey)) return;
  sessionStorage.setItem(idKey, draft);
  sessionStorage.removeItem(draftKey);
}

export function useRefinement(
  blueprint: Blueprint | null,
  onBlueprintUpdate: (updated: Blueprint) => void,
  blueprintId?: string | null
): UseRefinementResult {
  const storageKey = historyStorageKey(blueprintId);
  const hasBlueprint=Boolean(blueprint);
  const [recovering,setRecovering]=useState(false);
  const [progress,setProgress]=useState<string|null>(null);
  const activeId=useRef(blueprintId);activeId.current=blueprintId;
  const onUpdate=useRef(onBlueprintUpdate);onUpdate.current=onBlueprintUpdate;
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages(storageKey));
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const blueprintRef = useRef(blueprint);
  blueprintRef.current = blueprint;
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (blueprintId) migrateDraftHistory(blueprintId);
  }, [blueprintId]);

  useEffect(() => {
    setMessages(loadStoredMessages(storageKey));
    setError(null);
  }, [storageKey]);

  useEffect(() => {
    if (messages.length === 0) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    sessionStorage.setItem(storageKey, JSON.stringify(messages));
  }, [storageKey, messages]);

  const mutation = useMutation({
    mutationFn: ({ message, model, id, original, controller }: { message: string; model: string; id: typeof blueprintId; original: Blueprint; controller: AbortController }) =>
      refineBlueprint(original, message, model, id, controller.signal, setProgress),
    onMutate: ({ message }) => {
      setError(null);
      setProgress(null);
      const userMsg: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
    },
    onSuccess: (updatedBlueprint, { message, original, id, controller }) => {
      if (controller.signal.aborted || activeId.current !== id) return;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: buildRefineSummary(original, updatedBlueprint, message),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onBlueprintUpdate(updatedBlueprint);
      toast('Blueprint refined successfully', 'success');
    },
    onError: (err, { id, controller }) => {
      if (controller.signal.aborted || activeId.current !== id) return;
      const errMsg = err instanceof Error ? err.message : 'Refinement failed';
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errMsg,
          timestamp: Date.now(),
        },
      ]);
    },
    onSettled: () => setProgress(null),
  });

  useEffect(() => {
    setRecovering(false);
    if (!blueprintId || !queuedJobsEnabled || !hasBlueprint) return;
    const controller=new AbortController();
    try {
      const client=currentJobClient();const scope=`spec:${blueprintId}`;const record=client.pending(scope);
      if(record){
        setRecovering(true);
        void client.watch<{id:string;data:Blueprint}>(scope,record,controller.signal,job=>setProgress(jobProgressLabel(job)))
          .then(result=>{if(!controller.signal.aborted && activeId.current===blueprintId){onUpdate.current(result.data);setMessages(previous=>[...previous,{role:'assistant',content:'Recovered the completed blueprint update. Review the updated specification above.',timestamp:Date.now()}]);client.forget(scope,record);}})
          .catch(err=>{if(!controller.signal.aborted){setError(err.message);toast(err.message,'error');}})
          .finally(()=>{if(!controller.signal.aborted){setRecovering(false);setProgress(null);}});
      }
    }catch(err){setError(err instanceof Error?err.message:'Recovery failed');}
    return ()=>{controller.abort();abortControllerRef.current?.abort();};
  },[blueprintId,hasBlueprint,toast]);

  useEffect(()=>()=>{abortControllerRef.current?.abort();},[]);

  const stop=useCallback(()=>{
    if(!blueprintId)return;
    if (!queuedJobsEnabled) { abortControllerRef.current?.abort(); return; }
    void stopSpecJob(blueprintId).catch(err=>{setError(err.message);toast(err.message,'error');});
  },[blueprintId,toast]);

  const refine = useCallback(
    (message: string, model: string) => {
      if (!blueprintRef.current || (mutation.isPending || recovering)) return;
      const controller=new AbortController();abortControllerRef.current=controller;
      mutation.mutate({ message, model, id:blueprintId, original:blueprintRef.current, controller });
    },
    [mutation, recovering, blueprintId]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    messages,
    isRefining: mutation.isPending || recovering,
    progress,
    stop,
    error,
    refine,
    clearHistory,
  };
}
