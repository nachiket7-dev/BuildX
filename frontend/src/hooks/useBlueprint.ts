import { useMutation } from '@tanstack/react-query';
import { generateBlueprint } from '../lib/api';
import type { Blueprint } from '../lib/types';

interface UseBlueprintResult {
  blueprint: Blueprint | null;
  blueprintId: string | null;
  isLoading: boolean;
  error: string | null;
  generate: (idea: string, model?: string) => void;
  reset: () => void;
}

/**
 * Non-streaming fallback hook.
 * Prefer useStreamBlueprint for the primary flow.
 */
export function useBlueprint(): UseBlueprintResult {
  const mutation = useMutation({
    mutationFn: ({ idea, model }: { idea: string; model?: string }) =>
      generateBlueprint(idea, model),
  });

  return {
    blueprint: mutation.data?.blueprint ?? null,
    blueprintId: mutation.data?.id ?? null,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    generate: (idea: string, model?: string) => mutation.mutate({ idea, model }),
    reset: () => mutation.reset(),
  };
}
