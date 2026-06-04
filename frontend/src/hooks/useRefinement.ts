import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { refineBlueprint } from '../lib/api';
import { useToast } from './useToast';
import type { Blueprint } from '../lib/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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

  const archFields: Array<keyof Blueprint['architecture']> = [
    'frontend',
    'backend',
    'database',
    'auth',
    'hosting',
  ];

  for (const field of archFields) {
    if (updated.architecture[field] !== original.architecture[field]) {
      details.push(
        `${field} moved from ${original.architecture[field]} to ${updated.architecture[field]}`
      );
    }
  }

  if (updated.complexity !== original.complexity) {
    details.push(`complexity revised from ${original.complexity} to ${updated.complexity}`);
  }

  const featureGroups: Array<keyof Blueprint['features']> = [
    'authentication',
    'core',
    'admin',
    'optional',
  ];

  for (const group of featureGroups) {
    const added = listNewItems(original.features[group], updated.features[group]);
    if (added.length > 0) {
      const label = group === 'core' ? 'core features' : `${group} features`;
      details.push(`added ${label}: ${added.join(', ')}`);
    }
  }

  if (updated.schema.length !== original.schema.length) {
    details.push(
      `data model now includes ${updated.schema.length} table${updated.schema.length === 1 ? '' : 's'} (previously ${original.schema.length})`
    );
  } else {
    const renamedTables = updated.schema.filter(
      (table, index) => table.table !== original.schema[index]?.table
    );
    if (renamedTables.length > 0) {
      details.push(`schema tables updated (${renamedTables.map((t) => t.table).join(', ')})`);
    }
  }

  if (updated.endpoints.length !== original.endpoints.length) {
    details.push(
      `API expanded to ${updated.endpoints.length} endpoint${updated.endpoints.length === 1 ? '' : 's'} (was ${original.endpoints.length})`
    );
  }

  const newScreens = listNewItems(
    original.screens.map((s) => s.name),
    updated.screens.map((s) => s.name)
  );
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
  error: string | null;
  refine: (message: string, model: string) => void;
  clearHistory: () => void;
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages(storageKey));
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const blueprintRef = useRef(blueprint);
  blueprintRef.current = blueprint;

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
    mutationFn: ({ message, model }: { message: string; model: string }) => {
      if (!blueprint) throw new Error('No blueprint loaded');
      return refineBlueprint(blueprint, message, model, blueprintId);
    },
    onMutate: ({ message }) => {
      setError(null);
      const userMsg: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
    },
    onSuccess: (updatedBlueprint, { message }) => {
      const original = blueprintRef.current;
      if (!original) return;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: buildRefineSummary(original, updatedBlueprint, message),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onBlueprintUpdate(updatedBlueprint);
      toast('Blueprint refined successfully', 'success');
    },
    onError: (err) => {
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
  });

  const refine = useCallback(
    (message: string, model: string) => {
      if (!blueprint || mutation.isPending) return;
      mutation.mutate({ message, model });
    },
    [blueprint, mutation, toast]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    messages,
    isRefining: mutation.isPending,
    error,
    refine,
    clearHistory,
  };
}
