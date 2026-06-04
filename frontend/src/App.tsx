import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Routes, Route, useParams, useNavigate, Navigate, Outlet, useOutletContext } from 'react-router-dom';
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
import { useStreamBlueprint } from './hooks/useStreamBlueprint';
import { useRefinement } from './hooks/useRefinement';
import { useAuth, useAuthProvider, AuthContext } from './hooks/useAuth';
import { useModel } from './hooks/useModel';
import { useToast } from './hooks/useToast';
import { invalidateBlueprintQueries } from './hooks/useBlueprints';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './components/LoginPage';
import { HomePage } from './components/HomePage';
import type { Blueprint } from './lib/types';

type AppShellOutletContext = { sidebarOpen: boolean };

function BlueprintPage() {
  const { sidebarOpen } = useOutletContext<AppShellOutletContext>();
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const celebratedRef = useRef(false);
  const handleSaved = useCallback(
    (savedId: string) => {
      void invalidateBlueprintQueries(queryClient);
      navigate(`/blueprint/${savedId}`, { replace: true });
    },
    [navigate, queryClient]
  );

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
    reset,
    cancel,
  } = useStreamBlueprint({ onSaved: handleSaved });

  const { selectedModel } = useModel();
  const [refinedBlueprint, setRefinedBlueprint] = useState<Blueprint | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const activeBlueprint = refinedBlueprint ?? blueprint;
  const effectiveId = blueprintId ?? routeId ?? null;

  const handleBlueprintUpdate = useCallback((updated: Blueprint) => {
    setRefinedBlueprint(updated);
  }, []);

  const { messages, isRefining, refine, clearHistory } = useRefinement(
    activeBlueprint,
    handleBlueprintUpdate,
    effectiveId
  );

  useEffect(() => {
    if (!routeId) {
      // Only clear when leaving a URL-loaded blueprint (/blueprint/:id → /create).
      // Do NOT reset after generating on home — blueprint may exist before navigate runs.
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

    if (isStreaming) return;
    if (routeId === loadedId && (blueprint || error)) return;
    if (routeId && blueprintId === routeId && blueprint) {
      if (loadedId !== routeId) setLoadedId(routeId);
      return;
    }

    cancel();
    setRefinedBlueprint(null);
    setModelUsed(null);
    setLoadedId(routeId);
    celebratedRef.current = false;
    loadSaved(routeId);
  }, [routeId, isStreaming, loadedId, blueprint, blueprintId, error, cancel, reset, clearHistory, loadSaved]);

  // Safety net: ensure URL updates after save when generation started on /
  useEffect(() => {
    if (!routeId && blueprintId && isComplete && !isStreaming && !loadedId) {
      invalidateBlueprintQueries(queryClient);
      navigate(`/blueprint/${blueprintId}`, { replace: true });
    }
  }, [routeId, blueprintId, isComplete, isStreaming, navigate, queryClient, loadedId]);

  useEffect(() => {
    if (blueprint && !routeId) {
      setRefinedBlueprint(null);
      clearHistory();
    }
  }, [blueprint, routeId, clearHistory]);

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
                isPublic={savedMeta?.isPublic ?? false}
                onReset={handleReset}
                modelUsed={modelUsed ?? undefined}
                onRefineMessage={(msg) => refine(msg, selectedModel)}
                isRefining={isRefining}
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

  useEffect(() => {
    if (window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      <SkipLink />
      <AmbientBackground />

      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div
        className={`app-shell-content relative z-10 flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden ${
          sidebarOpen ? 'app-shell-content--sidebar md:ml-[280px]' : ''
        }`}
      >
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle
          sidebarOpen={sidebarOpen}
        />

        <Outlet context={{ sidebarOpen } satisfies AppShellOutletContext} />

        <footer className="app-footer">
          <p>BuildX — Idea to deployable blueprint in one flow</p>
          <p className="app-footer__sub">Powered by Groq · PostgreSQL · React</p>
        </footer>
      </div>
    </div>
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
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/create" element={<BlueprintPageRoute />} />
          <Route path="/blueprint/:id" element={<BlueprintPageRoute />} />
          <Route path="/gallery" element={<GalleryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
