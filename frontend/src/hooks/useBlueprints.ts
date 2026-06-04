import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBlueprint,
  fetchMyBlueprints,
  fetchPublicBlueprints,
  setBlueprintVisibility,
} from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { SavedBlueprint } from '../lib/types';

export function useBlueprintList(scope: 'public' | 'mine', enabled = true) {
  return useQuery({
    queryKey: queryKeys.blueprints.list(scope),
    queryFn: () => (scope === 'mine' ? fetchMyBlueprints() : fetchPublicBlueprints()),
    enabled,
    staleTime: 60_000,
  });
}

export function useBlueprintDetail(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.blueprints.detail(id ?? ''),
    queryFn: () => fetchBlueprint(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  });
}

export function useVisibilityMutation(blueprintId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isPublic: boolean) => {
      if (!blueprintId) throw new Error('No blueprint id');
      return setBlueprintVisibility(blueprintId, isPublic);
    },
    onSuccess: (_data, isPublic) => {
      if (!blueprintId) return;
      queryClient.setQueryData<SavedBlueprint>(
        queryKeys.blueprints.detail(blueprintId),
        (old) => (old ? { ...old, isPublic } : old)
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.blueprints.all });
    },
  });
}

export function invalidateBlueprintQueries(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.blueprints.all });
}
