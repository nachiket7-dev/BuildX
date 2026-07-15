import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useStreamBlueprint } from './useStreamBlueprint';
import { invalidateBlueprintQueries } from './useBlueprints';

type BlueprintSessionValue = ReturnType<typeof useStreamBlueprint>;

const BlueprintSessionContext = createContext<BlueprintSessionValue | null>(null);

export function BlueprintSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSaved = useCallback(
    (savedId: string) => {
      void invalidateBlueprintQueries(queryClient);
      navigate(`/blueprint/${savedId}`, { replace: true });
    },
    [navigate, queryClient]
  );

  const session = useStreamBlueprint({ onSaved: handleSaved });

  return (
    <BlueprintSessionContext.Provider value={session}>
      {children}
    </BlueprintSessionContext.Provider>
  );
}

export function useBlueprintSession(): BlueprintSessionValue {
  const ctx = useContext(BlueprintSessionContext);
  if (!ctx) {
    throw new Error('useBlueprintSession must be used within BlueprintSessionProvider');
  }
  return ctx;
}
