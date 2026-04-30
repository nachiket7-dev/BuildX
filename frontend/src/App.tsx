import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { StreamingView } from './components/StreamingView';
import { BlueprintOutput } from './components/BlueprintOutput';
import { RefinementChat } from './components/RefinementChat';
import { ErrorBanner } from './components/ErrorBanner';
import { GalleryPage } from './components/GalleryPage';
import { Sidebar } from './components/Sidebar';
import { useStreamBlueprint } from './hooks/useStreamBlueprint';
import { useRefinement } from './hooks/useRefinement';
import { useAuth, useAuthProvider, AuthContext } from './hooks/useAuth';
import { useModel } from './hooks/useModel';
import type { Blueprint } from './lib/types';

function BlueprintPage({ sidebarOffset = 0 }: { sidebarOffset?: number }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    blueprint,
    partialBlueprint,
    isStreaming,
    isComplete,
    error,
    blueprintId,
    progress,
    generate,
    loadSaved,
    reset,
  } = useStreamBlueprint();
  const { selectedModel } = useModel();

  // Local override for refined blueprints
  const [refinedBlueprint, setRefinedBlueprint] = useState<Blueprint | null>(null);
  // Track which model was used for the current generation
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // The "active" blueprint is the refined one if available, otherwise the original
  const activeBlueprint = refinedBlueprint ?? blueprint;

  const handleBlueprintUpdate = useCallback((updated: Blueprint) => {
    setRefinedBlueprint(updated);
  }, []);

  const { messages, isRefining, refine, clearHistory } = useRefinement(
    activeBlueprint,
    handleBlueprintUpdate
  );

  // Track which blueprint ID is currently loaded
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Load saved blueprint from URL — handles sidebar switching
  useEffect(() => {
    if (!id) {
      // Navigated to / — reset state so Hero shows
      if (blueprint || loadedId) {
        reset();
        setRefinedBlueprint(null);
        setModelUsed(null);
        clearHistory();
        setLoadedId(null);
      }
      return;
    }
    if (isStreaming) return;

    // Already loaded this exact blueprint
    if (id === loadedId && blueprint) return;

    // Reset state for a new blueprint
    reset();
    setRefinedBlueprint(null);
    setModelUsed(null);
    clearHistory();
    setLoadedId(id);
    loadSaved(id);
  }, [id]);

  const handleReset = () => {
    reset();
    setRefinedBlueprint(null);
    setModelUsed(null);
    clearHistory();
    setLoadedId(null);
    navigate('/');
  };

  // Clear refined state when a new blueprint is generated
  useEffect(() => {
    if (blueprint) {
      setRefinedBlueprint(null);
      clearHistory();
    }
  }, [blueprint, clearHistory]);

  const showHero = !isStreaming && !activeBlueprint && !id;
  const showStreaming = isStreaming;
  const showOutput = !isStreaming && Boolean(activeBlueprint);

  return (
    <>
      {/* Error banner — shown above content in all states */}
      {error && (
        <div className="max-w-3xl w-full mx-auto px-6 pt-4">
          <ErrorBanner message={error} onDismiss={handleReset} />
        </div>
      )}

      <main className="flex-1 flex flex-col">
        {showHero && <Hero onGenerate={(idea) => { setModelUsed(selectedModel); generate(idea, selectedModel); }} isLoading={isStreaming} />}
        {showStreaming && <StreamingView progress={progress} partialBlueprint={partialBlueprint} />}
        {showOutput && activeBlueprint && (
          <>
            <BlueprintOutput
              blueprint={activeBlueprint}
              blueprintId={blueprintId}
              onReset={handleReset}
              modelUsed={modelUsed ?? undefined}
            />
            {/* Floating refinement chat */}
            <RefinementChat
              messages={messages}
              isRefining={isRefining}
              onSend={(msg) => refine(msg, selectedModel)}
              onClear={clearHistory}
              sidebarOffset={sidebarOffset}
            />
            {/* Spacer so content isn't hidden behind the floating chat */}
            <div className="h-24" />
          </>
        )}
      </main>
    </>
  );
}

function AppContent() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-open sidebar on desktop when logged in
  useEffect(() => {
    if (user && window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
    if (!user) {
      setSidebarOpen(false);
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background effects */}
      <div className="grid-bg" />
      <div
        className="orb w-[500px] h-[500px]"
        style={{
          background: 'var(--accent)',
          top: '-150px',
          right: '-100px',
        }}
      />
      <div
        className="orb w-[400px] h-[400px]"
        style={{
          background: 'var(--green)',
          bottom: '-100px',
          left: '-80px',
        }}
      />

      {/* Sidebar */}
      {user && (
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      )}

      {/* App shell — shifts right when sidebar is open on desktop */}
      <div
        className={`relative z-10 flex flex-col min-h-screen transition-all duration-300 ${
          user && sidebarOpen ? 'md:ml-[280px]' : ''
        }`}
      >
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle={!!user}
          sidebarOpen={sidebarOpen}
        />

        <Routes>
          <Route path="/" element={<BlueprintPage sidebarOffset={user && sidebarOpen ? 280 : 0} />} />
          <Route path="/blueprint/:id" element={<BlueprintPage sidebarOffset={user && sidebarOpen ? 280 : 0} />} />
          <Route path="/gallery" element={<GalleryPage />} />
        </Routes>

        {/* Footer */}
        <footer
          className="text-center py-6 font-mono-custom text-xs"
          style={{
            color: 'var(--text3)',
            borderTop: '1px solid var(--border)',
          }}
        >
          AI-powered · Multi-Model · Turn any idea into a deployable blueprint
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <AppContent />
    </AuthContext.Provider>
  );
}
