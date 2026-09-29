import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useStreamBlueprint } from './useStreamBlueprint';
import { invalidateBlueprintQueries } from './useBlueprints';

type BlueprintSessionValue = ReturnType<typeof useStreamBlueprint>;

const BlueprintSessionContext = createContext<BlueprintSessionValue | null>(null);

export function BlueprintSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, authReady } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleSaved = useCallback(
    (savedId: string) => {
      void invalidateBlueprintQueries(queryClient);
      navigate(`/blueprint/${savedId}`, { replace: true });
    },
    [navigate, queryClient]
  );

  const session = useStreamBlueprint({ onSaved: handleSaved, ownerId: authReady ? user?.id : undefined, recover: authReady && location.pathname === '/create' });

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
