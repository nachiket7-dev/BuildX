import { useEffect, useState, useCallback, useRef } from 'react';
import { Routes, Route, useParams, useNavigate, Navigate, Outlet, useOutletContext, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { StreamingView } from './components/StreamingView';
import { BlueprintOutput } from './components/BlueprintOutput';
import { ErrorBanner } from './components/ErrorBanner';
import { GalleryPage } from './components/GalleryPage';
import { Sidebar } from './components/Sidebar';
import { CommandPalette, type PaletteAction } from './components/CommandPalette';
import { SkipLink } from './components/SkipLink';
import { PageHead } from './components/PageHead';
import { PageTransition } from './components/PageTransition';
import { BlueprintLoadingSkeleton } from './components/BlueprintLoadingSkeleton';
import { useBlueprintSession, BlueprintSessionProvider } from './hooks/useBlueprintSession';
import { useRefinement } from './hooks/useRefinement';
import { useAuthProvider, AuthContext } from './hooks/useAuth';
import { useModel } from './hooks/useModel';
import { useToast } from './hooks/useToast';
import { invalidateBlueprintQueries } from './hooks/useBlueprints';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './components/LoginPage';
import { GithubCallbackPage } from './components/GithubCallbackPage';
import { HomePage } from './components/HomePage';
import { AgentPage } from './components/AgentPage';
import { DeployModal } from './components/DeployModal';
import type { Blueprint } from './lib/types';

import { VFSProvider } from './context/VFSContext';

type AppShellOutletContext = { sidebarOpen: boolean; onDeploy?: () => void };

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
    retryable,
    generate,
    retry,
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
  }, [searchParams, setSearchParams, cancel, reset, clearHistory]);

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
          <ErrorBanner message={error} onDismiss={handleReset} onRetry={retryable ? retry : undefined} />
        </div>
      )}

      <main id="main-content" className="flex-1 flex flex-col w-full overflow-x-hidden" tabIndex={-1}>
        <PageTransition viewKey={viewKey}>
          {showHero && (
            <Hero
              onGenerate={(idea, stack) => {
                celebratedRef.current = false;
                setModelUsed(selectedModel);
                generate(idea, selectedModel, stack);
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

const FULL_BLEED_ROUTES = ['/agent', '/gallery'];

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isGlobalPaletteOpen, setIsGlobalPaletteOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Full-bleed routes (Cortex IDE & Community Gallery) hide the global sidebar
  // to maximize workspace real estate and stretch to 100% viewport width.
  const isFullBleed = FULL_BLEED_ROUTES.some(route => pathname.startsWith(route));
  const isAgentPage = pathname.startsWith('/agent');
  const routeIdMatch = pathname.match(/\/(?:agent|blueprint)\/([^/]+)/);
  const routeId = routeIdMatch ? routeIdMatch[1] : undefined;

  useEffect(() => {
    if (window.innerWidth >= 768 && !isFullBleed) {
      setSidebarOpen(true);
    }
  }, [isFullBleed]);

  // Global Cmd+K for non-agent pages (agent pages have their own handler)
  useEffect(() => {
    if (isAgentPage) return; // Agent page manages its own palette
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAgentPage]);

  const handleGlobalPaletteAction = useCallback((action: PaletteAction) => {
    switch (action.type) {
      case 'action':
        if (action.id === 'deploy-github' || action.id === 'export-zip') {
          setIsDeployModalOpen(true);
        } else if (action.id === 'toggle-preview') {
          navigate('/agent');
        }
        break;
      case 'prompt':
        navigate('/create');
        break;
      default:
        break;
    }
  }, [navigate]);

  return (
    <VFSProvider>
      <BlueprintSessionProvider>
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0A0A0B] text-white relative">
          <SkipLink />

          {/* ── GLOBAL HEADER: Fixed top anchor (h-16 shrink-0 z-30) ── */}
          <Header
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            showSidebarToggle={!isFullBleed}
            sidebarOpen={!isFullBleed && sidebarOpen}
            onDeploy={() => setIsDeployModalOpen(true)}
          />

          {/* ── BELOW-HEADER LAYOUT: Fixed Sidebar + Main Workspace Scroll ── */}
          <div className="flex-1 flex min-h-0 w-full overflow-hidden min-w-0 relative z-10">
            {!isFullBleed && (
              <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
            )}

            <motion.div
              animate={{ marginLeft: (!isFullBleed && sidebarOpen) ? '280px' : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
              className={`flex-1 h-full min-h-0 min-w-0 ${
                isFullBleed ? 'w-full m-0 p-0' : ''
              } ${
                isAgentPage ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'
              } flex flex-col relative z-10`}
              style={{ willChange: 'margin' }}
            >
              <Outlet context={{ sidebarOpen: !isFullBleed && sidebarOpen, onDeploy: () => setIsDeployModalOpen(true) } satisfies AppShellOutletContext} />

              {/* Footer is hidden on full-bleed workspace/gallery pages */}
              {!isFullBleed && (
                <footer className="app-footer shrink-0">
                  <p>BuildX — Idea to deployable blueprint in one flow</p>
                  <p className="app-footer__sub">Powered by Groq · PostgreSQL · React</p>
                </footer>
              )}
            </motion.div>
          </div>

          <DeployModal
            isOpen={isDeployModalOpen}
            onClose={() => setIsDeployModalOpen(false)}
            blueprintId={routeId}
          />

          {/* Global Command Palette (non-agent pages) */}
          {!isAgentPage && (
            <CommandPalette
              isOpen={isGlobalPaletteOpen}
              onClose={() => setIsGlobalPaletteOpen(false)}
              onAction={handleGlobalPaletteAction}
              appName="BuildX"
            />
          )}
        </div>
      </BlueprintSessionProvider>
    </VFSProvider>
  );
}

export default function App() {
  const auth = useAuthProvider();

  // NOTE: deliberately NOT wrapped in a pathname-keyed <AnimatePresence>.
  // AppShell — and therefore VFSProvider and BlueprintSessionProvider — lives
  // inside these Routes, so keying on location.pathname would unmount and
  // recreate the whole provider graph on every navigation, discarding IDE state
  // and defeating the stream handoff. Pages that want a mount animation wrap
  // their own content in <PageTransition>, as BlueprintPage does.
  return (
    <AuthContext.Provider value={auth}>
      <div className="flex-1 flex flex-col min-h-screen">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/signin" element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="/login/callback" element={<GithubCallbackPage />} />
          <Route path="/auth/callback" element={<Navigate to="/login/callback" replace />} />
          <Route element={<AppShell />}>
            <Route path="/create" element={<BlueprintPage />} />
            <Route path="/blueprints/new" element={<Navigate to="/create" replace />} />
            <Route path="/new" element={<Navigate to="/create" replace />} />
            <Route path="/builder" element={<Navigate to="/create" replace />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/blueprints" element={<Navigate to="/gallery" replace />} />
            <Route path="/dashboard" element={<Navigate to="/gallery" replace />} />
            <Route path="/projects" element={<Navigate to="/gallery" replace />} />
            <Route path="/blueprint/:id" element={<BlueprintPage />} />
            <Route path="/community" element={<Navigate to="/gallery" replace />} />
            <Route path="/explore" element={<Navigate to="/gallery" replace />} />
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
            <Route path="/ide" element={<Navigate to="/agent" replace />} />
            <Route path="/ide/:id" element={<Navigate to="/agent" replace />} />
            <Route path="/workspace" element={<Navigate to="/agent" replace />} />
            <Route path="/workspace/:id" element={<Navigate to="/agent" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthContext.Provider>
  );
}
