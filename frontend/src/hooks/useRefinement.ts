import { useState, useCallback } from 'react';
import type { Blueprint } from '../lib/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface UseRefinementResult {
  messages: ChatMessage[];
  isRefining: boolean;
  error: string | null;
  refine: (message: string) => void;
  clearHistory: () => void;
}

export function useRefinement(
  blueprint: Blueprint | null,
  onBlueprintUpdate: (updated: Blueprint) => void
): UseRefinementResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refine = useCallback(
    async (message: string) => {
      if (!blueprint || isRefining) return;

      setError(null);

      // Add user message
      const userMsg: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsRefining(true);

      try {
        const BASE_URL = import.meta.env.VITE_API_URL ?? '';
        const response = await fetch(`${BASE_URL}/api/blueprint/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blueprint, message }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            (errData as { error?: string }).error || `Server error (${response.status})`
          );
        }

        const data = await response.json();
        const updatedBlueprint = (data as { data: Blueprint }).data;

        // Add assistant confirmation
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `✅ Blueprint updated! Changes applied to "${updatedBlueprint.appName}".`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Update the parent blueprint
        onBlueprintUpdate(updatedBlueprint);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Refinement failed';
        setError(errMsg);

        const errorReply: ChatMessage = {
          role: 'assistant',
          content: `❌ ${errMsg}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorReply]);
      } finally {
        setIsRefining(false);
      }
    },
    [blueprint, isRefining, onBlueprintUpdate]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isRefining, error, refine, clearHistory };
}
