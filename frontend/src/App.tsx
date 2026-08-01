import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Routes, Route, useParams, useNavigate, Navigate, Outlet, useOutletContext, useLocation, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { StreamingView } from './components/StreamingView';
import { BlueprintOutput } from './components/BlueprintOutput';
import { ErrorBanner } from './components/ErrorBanner';
import { GalleryPage } from './components/GalleryPage';
import { Sidebar } from './components/Sidebar';
import { AmbientBackground } from './components/AmbientBackground';
import { SkipLink } from './components/SkipLink';
import { PageHead } from './components/PageHead';
import { PageTransition } from './components/PageTransition';
import { BlueprintLoadingSkeleton } from './components/BlueprintLoadingSkeleton';
import { useBlueprintSession, BlueprintSessionProvider } from './hooks/useBlueprintSession';
import { useRefinement } from './hooks/useRefinement';
import { useAuth, useAuthProvider, AuthContext } from './hooks/useAuth';
import { useModel } from './hooks/useModel';
import { useToast } from './hooks/useToast';
import { invalidateBlueprintQueries } from './hooks/useBlueprints';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './components/LoginPage';
import { GithubCallbackPage } from './components/GithubCallbackPage';
import { HomePage } from './components/HomePage';
import { AgentPage } from './components/AgentPage';
import type { Blueprint } from './lib/types';

type AppShellOutletContext = { sidebarOpen: boolean };

function BlueprintPage() {
  const { sidebarOpen } = useOutletContext<AppShellOutletContext>();
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const celebratedRef = useRef(false);
  const loadAttemptRef = useRef<string | null>(null);

  const {
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
  } = useBlueprintSession();

  const { selectedModel } = useModel();
  const [refinedBlueprint, setRefinedBlueprint] = useState<Blueprint | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const blueprintContentKey = `${blueprint?.appName ?? ''}:${blueprint?.schema?.length ?? 0}:${blueprint?.endpoints?.length ?? 0}`;

  const activeBlueprint = refinedBlueprint ?? blueprint;
  const effectiveId = blueprintId ?? routeId ?? null;

  const handleBlueprintUpdate = useCallback((updated: Blueprint) => {
    setRefinedBlueprint((prev) => {
      const base = prev ?? blueprint;
      if (!base) {
        updateBlueprint(updated);
        return updated;
      }
      // Full blueprint from refine/regenerate — replace entirely
      const isFullUpdate = Boolean(
        updated.appName &&
        Array.isArray(updated.schema) &&
        Array.isArray(updated.endpoints) &&
        updated.features?.core
      );
      const next = isFullUpdate
        ? updated
        : {
            ...base,
            ...updated,
            features: updated.features ?? base.features,
            schema: updated.schema ?? base.schema,
            endpoints: updated.endpoints ?? base.endpoints,
            screens: updated.screens ?? base.screens,
            architecture: updated.architecture ?? base.architecture,
            code: updated.code ?? base.code,
            effort: updated.effort ?? base.effort,
            diagrams: updated.diagrams ?? base.diagrams,
          };
      updateBlueprint(next);
      return next;
    });
  }, [blueprint, updateBlueprint]);

  const { messages, isRefining, refine, clearHistory } = useRefinement(
    activeBlueprint,
    handleBlueprintUpdate,
    effectiveId
  );

  useEffect(() => {
    if (!routeId) {
      loadAttemptRef.current = null;
      if (loadedId && !isStreaming) {
        cancel();
        reset();
        setRefinedBlueprint(null);
        setModelUsed(null);
        clearHistory();
        setLoadedId(null);
        celebratedRef.current = false;
      }
      return;
    }

    // Stream handoff: never fetch from API until the streamed blueprint is in state
    if (isStreamSavedRoute(routeId)) {
      if (!blueprint) return;
      if (loadedId !== routeId) setLoadedId(routeId);
      loadAttemptRef.current = routeId;
      if (!savedMeta) void loadSaved(routeId);
      return;
    }

    // Already have this blueprint in session (e.g. just generated, then navigated here)
    if (blueprint && blueprintId === routeId) {
      if (loadedId !== routeId) setLoadedId(routeId);
      loadAttemptRef.current = routeId;
      if (!savedMeta) void loadSaved(routeId);
      return;
    }

    // Avoid duplicate fetches for the same route
    if (loadAttemptRef.current === routeId) {
      return;
    }

    // Allow retry after a failed load
    if (error && !blueprint && !isStreaming) {
      loadAttemptRef.current = null;
    }

    loadAttemptRef.current = routeId;
    setRefinedBlueprint(null);
    setModelUsed(null);
    setLoadedId(routeId);
    celebratedRef.current = false;
    loadSaved(routeId);
  }, [routeId, blueprintId, blueprint, loadedId, isStreaming, savedMeta, error, cancel, reset, clearHistory, loadSaved, isStreamSavedRoute]);

  // Safety net: ensure URL updates after save when generation started on /create
  useEffect(() => {
    if (
      !routeId &&
      blueprint &&
      blueprintId &&
      isComplete &&
      !isStreaming &&
      !loadedId &&
      !isStreamSavedRoute(blueprintId)
    ) {
      invalidateBlueprintQueries(queryClient);
      navigate(`/blueprint/${blueprintId}`, { replace: true });
    }
  }, [routeId, blueprint, blueprintId, isComplete, isStreaming, navigate, queryClient, loadedId, isStreamSavedRoute]);

  useEffect(() => {
    if (blueprint && !routeId) {
      setRefinedBlueprint(null);
      clearHistory();
    }
  }, [blueprint, routeId, clearHistory]);

  useEffect(() => {
    if (activeBlueprint?.modelUsed) {
      setModelUsed(activeBlueprint.modelUsed);
    }
  }, [activeBlueprint?.modelUsed, loadedId]);

  useEffect(() => {
    if (isComplete && activeBlueprint && !celebratedRef.current && modelUsed) {
      celebratedRef.current = true;
      toast(`"${activeBlueprint.appName}" is ready — explore tabs or refine below`, 'success');
    }
  }, [isComplete, activeBlueprint, modelUsed, toast]);

  const handleReset = () => {
    cancel();
    reset();
    setRefinedBlueprint(null);
    setModelUsed(null);
    clearHistory();
    setLoadedId(null);
    celebratedRef.current = false;
    navigate('/create');
  };

  // Detect ?new=1 param from Sidebar "New Blueprint" button
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      cancel();
      reset();
      setRefinedBlueprint(null);
      setModelUsed(null);
      clearHistory();
      setLoadedId(null);
      celebratedRef.current = false;
      // Clean the param from URL without pushing new history entry
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoadingFromUrl = Boolean(routeId && isStreaming && !activeBlueprint && !error);
  const showHero = !isStreaming && !activeBlueprint && !routeId && !isLoadingFromUrl;
  const showStreaming = isStreaming && !isLoadingFromUrl;
  const showOutput = !isStreaming && Boolean(activeBlueprint);

  const viewKey = showHero
    ? 'hero'
    : showStreaming
      ? 'stream'
      : isLoadingFromUrl
        ? 'loading'
        : showOutput
          ? `output-${effectiveId}`
          : 'empty';

  return (
    <>
      <PageHead
        title={activeBlueprint?.appName}
        description={activeBlueprint?.description}
      />

      {error && (
        <div className="max-w-3xl w-full mx-auto px-6 pt-4">
          <ErrorBanner message={error} onDismiss={handleReset} />
        </div>
      )}

      <main id="main-content" className="flex-1 flex flex-col w-full overflow-x-hidden" tabIndex={-1}>
        <PageTransition viewKey={viewKey}>
          {showHero && (
            <Hero
              onGenerate={(idea) => {
                celebratedRef.current = false;
                setModelUsed(selectedModel);
                generate(idea, selectedModel);
              }}
              isLoading={isStreaming}
            />
          )}
          {isLoadingFromUrl && <BlueprintLoadingSkeleton />}
          {showStreaming && (
            <StreamingView
              progress={progress}
              partialBlueprint={partialBlueprint}
              agentEvents={agentEvents}
            />
          )}
          {showOutput && activeBlueprint && (
            <>
              <BlueprintOutput
                blueprint={activeBlueprint}
                blueprintId={effectiveId}
                blueprintContentKey={blueprintContentKey}
                isPublic={savedMeta?.isPublic ?? false}
                isOwner={savedMeta?.isOwner ?? (!routeId && Boolean(blueprintId))}
                onReset={handleReset}
                modelUsed={modelUsed ?? activeBlueprint.modelUsed}
                onRefineMessage={(msg) => refine(msg, selectedModel)}
                isRefining={isRefining}
                onBlueprintUpdate={handleBlueprintUpdate}
                refinement={{
                  messages,
                  isRefining,
                  onSend: (msg) => refine(msg, selectedModel),
                  onClear: clearHistory,
                  sidebarOpen,
                }}
              />
            </>
          )}
        </PageTransition>
      </main>
    </>
  );
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  // Agent workspace pages need a fixed-height, no-scroll shell so the internal
  // chat column can scroll independently. All other pages retain min-h-screen.
  const isAgentPage = pathname.startsWith('/agent');

  useEffect(() => {
    if (window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  return (
    <BlueprintSessionProvider>
      <div className="flex flex-col relative overflow-x-hidden min-h-screen">
        <SkipLink />
        <AmbientBackground />

        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        <div
          className="app-shell-content relative z-10 flex flex-col min-h-screen"
          style={{ marginLeft: sidebarOpen ? undefined : 0 }}
        >
          <motion.div
            animate={{ marginLeft: sidebarOpen ? '280px' : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            className="flex flex-col flex-1 min-w-0"
            style={{ willChange: 'margin' }}
          >
          <Header
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            showSidebarToggle
            sidebarOpen={sidebarOpen}
          />

          <Outlet context={{ sidebarOpen } satisfies AppShellOutletContext} />

          {/* Footer is hidden on agent pages — it would push the shell beyond 100vh */}
          {!isAgentPage && (
            <footer className="app-footer">
              <p>BuildX — Idea to deployable blueprint in one flow</p>
              <p className="app-footer__sub">Powered by Groq · PostgreSQL · React</p>
            </footer>
          )}
          </motion.div>
        </div>
      </div>
    </BlueprintSessionProvider>
  );
}

function BlueprintPageRoute() {
  return <BlueprintPage />;
}

export default function App() {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/callback" element={<GithubCallbackPage />} />
        <Route element={<AppShell />}>
          <Route path="/blueprint/:id" element={<BlueprintPageRoute />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route
            path="/agent"
            element={
              <ProtectedRoute>
                <AgentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/:id"
            element={
              <ProtectedRoute>
                <AgentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <BlueprintPageRoute />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
