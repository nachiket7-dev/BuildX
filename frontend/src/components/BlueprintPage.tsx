import { useEffect, useState, useCallback, useRef } from "react";
import {
  useParams,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CreateProjectForm } from "./CreateProjectForm";
import { StreamingView } from "./StreamingView";
import { BlueprintOutput } from "./BlueprintOutput";
import { ErrorBanner } from "./ErrorBanner";
import { PageHead } from "./PageHead";
import { PageTransition } from "./PageTransition";
import { BlueprintLoadingSkeleton } from "./BlueprintLoadingSkeleton";
import { useBlueprintSession } from "../hooks/useBlueprintSession";
import { useRefinement } from "../hooks/useRefinement";
import { useModel } from "../hooks/useModel";
import { useToast } from "../hooks/useToast";
import { invalidateBlueprintQueries } from "../hooks/useBlueprints";
import type { Blueprint } from "../lib/types";
import type { AppShellOutletContext } from "./AppShell";
export function BlueprintPage() {
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
    activeStage,
    pipelineEvents,
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
  const [refinedBlueprint, setRefinedBlueprint] = useState<Blueprint | null>(
    null,
  );
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const blueprintContentKey = `${blueprint?.appName ?? ""}:${blueprint?.schema?.length ?? 0}:${blueprint?.endpoints?.length ?? 0}`;

  const activeBlueprint = refinedBlueprint ?? blueprint;
  const effectiveId = blueprintId ?? routeId ?? null;

  const handleBlueprintUpdate = useCallback(
    (updated: Blueprint) => {
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
          updated.features?.core,
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
    },
    [blueprint, updateBlueprint],
  );

  const { messages, isRefining, refine, clearHistory } = useRefinement(
    activeBlueprint,
    handleBlueprintUpdate,
    effectiveId,
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
  }, [
    routeId,
    blueprintId,
    blueprint,
    loadedId,
    isStreaming,
    savedMeta,
    error,
    cancel,
    reset,
    clearHistory,
    loadSaved,
    isStreamSavedRoute,
  ]);

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
  }, [
    routeId,
    blueprint,
    blueprintId,
    isComplete,
    isStreaming,
    navigate,
    queryClient,
    loadedId,
    isStreamSavedRoute,
  ]);

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
      toast(
        `"${activeBlueprint.appName}" is ready — explore tabs or refine below`,
        "success",
      );
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
    navigate("/create");
  };

  // Detect ?new=1 param from Sidebar "New Blueprint" button
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1") {
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

  const isLoadingFromUrl = Boolean(
    routeId && isStreaming && !activeBlueprint && !error,
  );
  const showHero =
    !isStreaming && !activeBlueprint && !routeId && !isLoadingFromUrl;
  const showStreaming = isStreaming && !isLoadingFromUrl;
  const showOutput = !isStreaming && Boolean(activeBlueprint);

  const viewKey = showHero
    ? "hero"
    : showStreaming
      ? "stream"
      : isLoadingFromUrl
        ? "loading"
        : showOutput
          ? `output-${effectiveId}`
          : "empty";

  return (
    <>
      <PageHead
        title={activeBlueprint?.appName}
        description={activeBlueprint?.description}
      />

      {error && (
        <div className="max-w-3xl w-full mx-auto px-6 pt-4">
          <ErrorBanner
            message={error}
            onDismiss={handleReset}
            onRetry={retryable ? retry : undefined}
          />
        </div>
      )}

      <main
        className={`blueprint-page flex-1 flex flex-col min-h-0 w-full overflow-x-hidden ${showOutput ? "blueprint-page--output" : "page-grid"}`}
        tabIndex={-1}
      >
        <PageTransition viewKey={viewKey}>
          {showHero && (
            <CreateProjectForm
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
              activeStage={activeStage}
              pipelineEvents={pipelineEvents}
              onCancel={cancel}
            />
          )}
          {showOutput && activeBlueprint && (
            <>
              <BlueprintOutput
                blueprint={activeBlueprint}
                blueprintId={effectiveId}
                blueprintContentKey={blueprintContentKey}
                isPublic={savedMeta?.isPublic ?? false}
                isOwner={
                  savedMeta?.isOwner ?? (!routeId && Boolean(blueprintId))
                }
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
