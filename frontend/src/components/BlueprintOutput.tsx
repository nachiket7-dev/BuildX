import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Download,
  Globe,
  Github,
  Link2,
  Lock,
  Plus,
  RefreshCw,
} from "./ui/icons";
import type { Blueprint, TabId, PartialBlueprint } from "../lib/types";
import { TabBar } from "./TabBar";
import { Dropdown, type DropdownItem } from "./ui/Dropdown";
import {
  FeaturesPanel,
  SchemaPanel,
  ApiPanel,
  UiPanel,
  ArchPanel,
  EffortPanel,
} from "./BlueprintPanels";
const DiagramsPanel = lazy(() =>
  import("./DiagramsPanel").then((m) => ({ default: m.DiagramsPanel })),
);
import { getAuthHeaders, regenerateBlueprintStream } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useVisibilityMutation } from "../hooks/useBlueprints";
import { useToast } from "../hooks/useToast";
import { AVAILABLE_MODELS, useModel } from "../hooks/useModel";
import { RefinementChat } from "./RefinementChat";
import { StreamingView } from "./StreamingView";
import type { AgentEvent } from "../hooks/useStreamBlueprint";
import type { ChatMessage } from "../hooks/useRefinement";
import { useCodeGeneration } from "../hooks/useCodeGeneration";

interface BlueprintOutputProps {
  blueprint: Blueprint;
  blueprintId: string | null;
  blueprintContentKey?: string;
  isPublic?: boolean;
  isOwner?: boolean;
  onReset: () => void;
  modelUsed?: string;
  onRefineMessage?: (msg: string) => void;
  isRefining?: boolean;
  onBlueprintUpdate?: (bp: Blueprint) => void;
  refinement?: {
    messages: ChatMessage[];
    isRefining: boolean;
    onSend: (message: string) => void;
    onClear: () => void;
    sidebarOpen: boolean;
  };
}

export function BlueprintOutput({
  blueprint,
  blueprintId,
  isPublic = false,
  isOwner = false,
  onReset,
  modelUsed,
  onBlueprintUpdate,
  refinement,
}: BlueprintOutputProps) {
  const [activeTab, setActiveTab] = useState<TabId>("features");
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsAnchorRef = useRef<HTMLDivElement>(null);
  const previousTab = useRef(activeTab);
  useLayoutEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    const scroll = scrollRef.current;
    const anchor = tabsAnchorRef.current;
    if (!scroll || !anchor) return;
    // Keep the new section heading below its sticky navigation after a deep scroll.
    const offset = anchor.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    scroll.scrollTop = Math.max(0, scroll.scrollTop + offset);
  }, [activeTab]);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [exportingGithub, setExportingGithub] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenStreaming, setRegenStreaming] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [regenPartial, setRegenPartial] = useState<PartialBlueprint>({});
  const [regenAgentEvents, setRegenAgentEvents] = useState<AgentEvent[]>([]);
  const regenAbortRef = useRef<AbortController | null>(null);
  const { selectedModel } = useModel();
  const effectiveModel = modelUsed ?? selectedModel;
  const { user } = useAuth();
  const { toast } = useToast();
  const codegen = useCodeGeneration();
  const visibility = useVisibilityMutation(blueprintId);
  const [publicState, setPublicState] = useState(isPublic);
  const sectionRef = useRef<HTMLElement>(null);
  const [repoExists, setRepoExists] = useState<boolean | null>(null);
  const [checkingRepo, setCheckingRepo] = useState(false);

  useEffect(() => {
    setPublicState(isPublic);
  }, [isPublic, blueprintId]);

  useEffect(() => {
    if (!user) {
      setRepoExists(null);
      return;
    }

    let isMounted = true;
    async function checkRepo() {
      setCheckingRepo(true);
      try {
        const BASE_URL = import.meta.env.VITE_API_URL ?? "";
        const response = await fetch(
          `${BASE_URL}/api/blueprint/check-github-repo`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              githubUrl: blueprint.githubUrl,
              appName: blueprint.appName,
              id: blueprintId,
            }),
          },
        );
        if (!response.ok) throw new Error("Check failed");
        const data = await response.json();
        if (isMounted) {
          setRepoExists(data.exists);
          if (
            data.exists &&
            data.repoUrl &&
            blueprint.githubUrl !== data.repoUrl
          ) {
            if (onBlueprintUpdate) {
              onBlueprintUpdate({ ...blueprint, githubUrl: data.repoUrl });
            }
          }
        }
      } catch (err) {
        console.error("Error checking github repo existence:", err);
        if (isMounted) {
          setRepoExists(null);
        }
      } finally {
        if (isMounted) {
          setCheckingRepo(false);
        }
      }
    }

    checkRepo();
    return () => {
      isMounted = false;
    };
  }, [blueprintId, blueprint, user, onBlueprintUpdate]);

  const hasRepo = blueprint.githubUrl && repoExists !== false;

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? "";
      const url = blueprintId
        ? `${BASE_URL}/api/blueprint/export?id=${blueprintId}`
        : `${BASE_URL}/api/blueprint/export`;

      const response = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: blueprintId ? undefined : JSON.stringify(blueprint),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${blueprint.appName.toLowerCase().replace(/\s+/g, "-")}-scaffold.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast("Scaffold ZIP downloaded", "success");
    } catch {
      setDownloadError("Download failed. Try again.");
      toast("Export failed — try again", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function handleGithubExport() {
    if (!user) {
      toast(
        "Please log in and connect your GitHub account to export repositories.",
        "error",
      );
      return;
    }
    if (!user.githubLinked) {
      toast(
        "Please connect your GitHub account before exporting repositories.",
        "error",
      );
      return;
    }
    setExportingGithub(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${BASE_URL}/api/blueprint/export-github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ blueprint, id: blueprintId }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch (e) {
        // Fallback for non-JSON error pages (like 502 Bad Gateway)
      }

      if (!response.ok) {
        throw new Error(
          data.error || `GitHub export failed (Status: ${response.status})`,
        );
      }

      if (data.success && data.repoUrl) {
        toast(
          data.message || "Successfully exported blueprint to GitHub!",
          "success",
        );
        window.open(data.repoUrl, "_blank");
        if (onBlueprintUpdate) {
          onBlueprintUpdate({ ...blueprint, githubUrl: data.repoUrl });
        }
        setRepoExists(true);
      } else {
        throw new Error("Invalid response");
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "GitHub export failed — try again",
        "error",
      );
    } finally {
      setExportingGithub(false);
    }
  }

  async function handleRegenerate() {
    if (!blueprintId) return;

    regenAbortRef.current?.abort();
    const controller = new AbortController();
    regenAbortRef.current = controller;

    setRegenerating(true);
    setRegenStreaming(true);
    setRegenProgress(0);
    setRegenPartial({});
    setRegenAgentEvents([]);

    let gotComplete = false;
    let resultBlueprint: Blueprint | null = null;

    try {
      const stream = regenerateBlueprintStream(
        blueprintId,
        effectiveModel,
        controller.signal,
      );

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        switch (event.event) {
          case "progress": {
            const data = event.data as { percent?: number };
            if (data.percent !== undefined) setRegenProgress(data.percent);
            break;
          }
          case "agent_event": {
            const data = event.data as AgentEvent;
            setRegenAgentEvents((prev) => [
              ...prev,
              { ...data, timestamp: new Date().toLocaleTimeString() },
            ]);
            break;
          }
          case "section": {
            const data = event.data as { key: string; value: unknown };
            setRegenPartial((prev) => ({ ...prev, [data.key]: data.value }));
            break;
          }
          case "complete": {
            resultBlueprint = event.data as Blueprint;
            gotComplete = true;
            setRegenProgress(95);
            break;
          }
          case "saved": {
            setRegenProgress(100);
            break;
          }
          case "error": {
            const data = event.data as { message: string };
            throw new Error(data.message);
          }
          default:
            break;
        }
      }

      if (!controller.signal.aborted && gotComplete && resultBlueprint) {
        const withModel: Blueprint = {
          ...resultBlueprint,
          modelUsed: effectiveModel,
          ...(blueprint.githubUrl ? { githubUrl: blueprint.githubUrl } : {}),
        };
        toast("Blueprint regenerated successfully!", "success");
        codegen.clearFiles();
        if (onBlueprintUpdate) {
          onBlueprintUpdate(withModel);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast(
        (err as Error).message || "Regeneration failed — try again",
        "error",
      );
    } finally {
      setRegenerating(false);
      setRegenStreaming(false);
      regenAbortRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      regenAbortRef.current?.abort();
    };
  }, []);

  function handleShare() {
    if (!blueprintId) return;
    const url = `${window.location.origin}/blueprint/${blueprintId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        toast("Share link copied to clipboard", "success");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        window.prompt("Copy this link:", url);
      });
  }

  function handleToggleVisibility() {
    if (!blueprintId || !user) return;
    const next = !publicState;
    visibility.mutate(next, {
      onSuccess: () => {
        setPublicState(next);
        toast(
          next
            ? "Blueprint is now public in Gallery"
            : "Blueprint is now private",
          "success",
        );
      },
      onError: () => toast("Could not update visibility", "error"),
    });
  }

  const modelLabel = effectiveModel
    ? AVAILABLE_MODELS.find((m) => m.id === effectiveModel)?.label ||
      effectiveModel
    : null;

  if (regenStreaming) {
    return (
      <StreamingView
        progress={regenProgress}
        partialBlueprint={regenPartial}
        agentEvents={regenAgentEvents}
      />
    );
  }

  return (
    <div ref={scrollRef} className="blueprint-scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
      {/* Studio stage — blueprint grid + top accent glow, quiet */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(124,124,244,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,124,244,0.04) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse 85% 55% at 50% 0%, black 15%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 85% 55% at 50% 0%, black 15%, transparent 80%)",
          }}
        />
        <div
          className="absolute top-[-220px] left-1/2 -translate-x-1/2 w-[720px] h-[420px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(124,124,244,0.10), transparent 72%)",
            filter: "blur(18px)",
          }}
        />
      </div>
      <section
        ref={sectionRef}
        className="blueprint-stage px-4 sm:px-6 mx-auto relative"
        aria-labelledby="blueprint-title"
      >
        <div className="flex flex-col gap-4 sm:gap-6 py-5 sm:py-8">
          <header className="blueprint-heading">
            <p className="eyebrow">PROJECT BLUEPRINT</p>
            <h1 id="blueprint-title">{blueprint.appName}</h1>
            <p>{blueprint.description}</p>
            <div className="blueprint-facts">
              <span>{blueprint.schema?.length ?? 0} tables</span>
              <span>{blueprint.endpoints?.length ?? 0} endpoints</span>
              <span>{blueprint.screens?.length ?? 0} screens</span>
              <span>{blueprint.complexity} complexity</span>
            </div>
            <p className="blueprint-audience">
              For {blueprint.targetUsers}
              {modelLabel && <span> · Generated with {modelLabel}</span>}
            </p>
          </header>

          <div
            className="bp-actions"
            role="toolbar"
            aria-label="Blueprint actions"
          >
            {blueprintId && isOwner && (
              <Link
                className="ui-button ui-button--primary"
                to={`/agent/${blueprintId}`}
              >
                Open workspace
              </Link>
            )}
            {blueprintId && (
              <button
                type="button"
                onClick={handleShare}
                className="bp-action"
                aria-label={copied ? "Link copied" : "Copy share link"}
              >
                {copied ? <Check size={15} /> : <Link2 size={15} />}{" "}
                {copied ? "Copied" : "Share link"}
              </button>
            )}
            {blueprintId && isOwner && (
              <button
                type="button"
                className="bp-action"
                onClick={handleToggleVisibility}
                disabled={visibility.isPending}
                aria-pressed={publicState}
                aria-label={
                  publicState
                    ? "Make blueprint private"
                    : "Make blueprint public"
                }
              >
                {publicState ? <Globe size={15} /> : <Lock size={15} />}{" "}
                {publicState ? "Public" : "Private"}
              </button>
            )}
            <Dropdown
              trigger={
                <button type="button" className="bp-action">
                  Project actions
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
              }
              items={
                [
                  {
                    label: downloading
                      ? "Preparing download…"
                      : "Download project",
                    icon: <Download size={15} />,
                    onClick: handleDownload,
                    disabled: downloading,
                  },
                  ...(isOwner
                    ? [
                        {
                          label: exportingGithub
                            ? "Exporting…"
                            : checkingRepo
                              ? "Checking repository…"
                              : hasRepo
                                ? "Update on GitHub"
                                : "Export to GitHub",
                          icon: <Github size={15} />,
                          onClick: handleGithubExport,
                          disabled: exportingGithub || checkingRepo,
                        },
                        ...(hasRepo
                          ? [
                              {
                                label: "View on GitHub",
                                icon: <Github size={15} />,
                                onClick: () =>
                                  window.open(
                                    blueprint.githubUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  ),
                              },
                            ]
                          : []),
                        ...(blueprintId
                          ? [
                              {
                                label: regenerating
                                  ? "Regenerating…"
                                  : "Regenerate blueprint",
                                icon: <RefreshCw size={15} />,
                                onClick: handleRegenerate,
                                disabled: regenerating,
                              },
                            ]
                          : []),
                      ]
                    : []),
                  {
                    label: "New project",
                    icon: <Plus size={15} />,
                    onClick: onReset,
                  },
                ] satisfies DropdownItem[]
              }
            />
          </div>
        </div>

        {downloadError && (
          <p
            className="text-xs mb-4 font-sans"
            style={{ color: "var(--coral)" }}
            role="alert"
          >
            {downloadError}
          </p>
        )}

        {visibility.isError && (
          <p
            className="text-xs mb-4 font-sans"
            style={{ color: "var(--coral)" }}
            role="alert"
          >
            Could not update visibility. Try again.
          </p>
        )}

        <div ref={tabsAnchorRef} aria-hidden="true" />
        <div className="tab-bar-sticky">
          <TabBar activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div
          id="blueprint-content"
          role="tabpanel"
          aria-labelledby={`blueprint-tab-${activeTab}`}
          className="blueprint-content"
          key={activeTab}
        >
          {activeTab === "features" && <FeaturesPanel blueprint={blueprint} />}
          {activeTab === "schema" && <SchemaPanel blueprint={blueprint} />}
          {activeTab === "api" && <ApiPanel blueprint={blueprint} />}
          {activeTab === "ui" && <UiPanel blueprint={blueprint} />}
          {activeTab === "architecture" && <ArchPanel blueprint={blueprint} />}
          {activeTab === "diagrams" && (
            <Suspense
              fallback={<p className="p-8 text-zinc-400">Loading diagrams…</p>}
            >
              <DiagramsPanel blueprint={blueprint} />
            </Suspense>
          )}

          {activeTab === "effort" && <EffortPanel blueprint={blueprint} />}
        </div>
        {refinement && isOwner && (
          <RefinementChat
            anchorRef={sectionRef}
            blueprint={blueprint}
            layoutSyncKey={refinement.sidebarOpen}
            messages={refinement.messages}
            isRefining={refinement.isRefining}
            onSend={refinement.onSend}
            onClear={refinement.onClear}
          />
        )}
      </section>
    </div>
  );
}
