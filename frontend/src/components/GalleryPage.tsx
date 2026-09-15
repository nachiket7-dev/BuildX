import { Constellation } from "./constellation/Constellation";
import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useBlueprintList } from "../hooks/useBlueprints";
import { BlueprintCardSkeleton } from "./BlueprintCardSkeleton";
import { PageHead } from "./PageHead";
import { useAuth } from "../hooks/useAuth";
import { ArrowRight, Database, Layers, Code2, Eye, Lock } from "./ui/icons";
import { SegmentedControl, Button, Modal, Input } from "./ui";
import type { BlueprintListItem } from "../lib/types";

function ProjectMap({ item }: { item: BlueprintListItem }) {
  return (
    <div className="project-map" aria-label="Architecture summary">
      <Constellation
        seed={item.id}
        spec={{
          schema: Math.min(item.schemaCount || 3, 12),
          endpoints: Math.min(item.endpointsCount || 5, 16),
          screens: Math.min(item.screensCount || 3, 12),
        }}
        size={260}
        static
        className="project-constellation"
      />
      <span>BLUEPRINT STRUCTURE</span>
      <div>
        {[
          { Icon: Layers, label: "Screens", count: item.screensCount },
          { Icon: Code2, label: "Endpoints", count: item.endpointsCount },
          { Icon: Database, label: "Tables", count: item.schemaCount },
        ].map(({ Icon, label, count }) => (
          <div key={label}>
            <Icon size={19} />
            <strong>{count ?? "—"}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const FILTER_TABS = ["All", "Full-Stack", "AI Agents", "Dashboards"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

export function classifyBlueprintCategory(item: {
  appName?: string;
  description?: string;
  idea?: string;
}): "Full-Stack" | "AI Agents" | "Dashboards" {
  const text =
    `${item?.appName || ""} ${item?.description || ""} ${item?.idea || ""}`.toLowerCase();

  if (
    /\b(ai|agent|agents|llm|gpt|assistant|bot|rag|cortex|neural|prompt|copilot|automation|ml|model)\b/i.test(
      text,
    )
  ) {
    return "AI Agents";
  }
  if (
    /\b(dashboard|dashboards|admin|analytics|metrics|monitoring|tracker|crm|portal|visualizer|booking|calendar|management)\b/i.test(
      text,
    )
  ) {
    return "Dashboards";
  }
  return "Full-Stack";
}

interface GalleryPageProps {
  defaultScope?: "mine" | "public";
}

export function GalleryPage({ defaultScope }: GalleryPageProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [complexityFilter, setComplexityFilter] = useState<
    "All" | "Low" | "Medium" | "High"
  >("All");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [previewItem, setPreviewItem] = useState<BlueprintListItem | null>(
    null,
  );

  // Compute active scope from searchParam (?scope=mine) or defaultScope prop
  const queryScope = searchParams.get("scope") as "mine" | "public" | null;
  const requestedScope =
    queryScope === "mine" || queryScope === "public"
      ? queryScope
      : (defaultScope ?? "public");
  const isPersonal = Boolean(user && requestedScope === "mine");
  const scope: "mine" | "public" =
    requestedScope === "mine" && user ? "mine" : "public";
  const isViewingMineUnauthenticated = requestedScope === "mine" && !user;

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useBlueprintList(scope, scope === "mine" ? Boolean(user) : true);

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      All: items.length,
      "Full-Stack": 0,
      "AI Agents": 0,
      Dashboards: 0,
    };
    items.forEach((item: BlueprintListItem) => {
      const cat = classifyBlueprintCategory(item);
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      }
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item: BlueprintListItem) => {
      // 1. Search Query Match
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item?.appName ?? "").toLowerCase().includes(q) ||
        (item?.description ?? item?.idea ?? "").toLowerCase().includes(q) ||
        (item?.id ?? "").toLowerCase().includes(q);

      // 2. Complexity Filter Match (case-insensitive)
      const itemComplexity = (item?.complexity ?? "Medium").toLowerCase();
      const matchesComplexity =
        complexityFilter === "All" ||
        itemComplexity === complexityFilter.toLowerCase();

      // 3. Archetype / Category Tab Filter Match
      const category = classifyBlueprintCategory(item);
      const matchesCategory =
        activeFilter === "All" || category === activeFilter;

      return matchesSearch && matchesComplexity && matchesCategory;
    });
  }, [items, searchQuery, complexityFilter, activeFilter]);

  const handleScopeChange = (newScope: "mine" | "public") => {
    if (newScope === "mine") {
      setSearchParams({ scope: "mine" });
    } else {
      setSearchParams({ scope: "public" });
    }
  };

  return (
    <div className="project-gallery page-grid">
      <PageHead
        title={isPersonal ? "My projects — BuildX" : "Project gallery — BuildX"}
        description="Explore application blueprints, data models, and screen plans made with BuildX."
      />
      <div className="gallery-heading">
        <div>
          <p className="eyebrow">THE PROJECT LIBRARY</p>
          <h1>
            {isPersonal
              ? "Your next idea starts here."
              : "See what’s taking shape."}
          </h1>
          <p>
            {isPersonal
              ? "Return to a project, review its blueprint, or start something new."
              : "Explore community projects and the architecture behind them."}
          </p>
        </div>
        <Link to="/create" className="ui-button ui-button--primary">
          New project <ArrowRight size={15} />
        </Link>
      </div>
      <SegmentedControl
        ariaLabel="Gallery scope"
        value={requestedScope}
        onChange={handleScopeChange}
        options={[
          { value: "public", label: "Community gallery" },
          { value: "mine", label: "My projects" },
        ]}
      />
      {!isViewingMineUnauthenticated && (
        <div className="gallery-filters">
          <Input
            label="Search projects"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or idea…"
          />
          <label className="gallery-complexity">
            Complexity
            <select
              value={complexityFilter}
              onChange={(e) =>
                setComplexityFilter(e.target.value as typeof complexityFilter)
              }
            >
              {["All", "Low", "Medium", "High"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="gallery-categories" aria-label="Project category">
            {FILTER_TABS.map((tab) => (
              <button
                type="button"
                key={tab}
                aria-pressed={activeFilter === tab}
                onClick={() => setActiveFilter(tab)}
              >
                {tab}
                <span>{tabCounts[tab]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {isViewingMineUnauthenticated ? (
        <div className="gallery-empty">
          <Lock size={28} />
          <h2>Your projects, all in one place.</h2>
          <p>Sign in to pick up where you left off.</p>
          <Link
            to="/login"
            state={{ from: "/gallery?scope=mine" }}
            className="ui-button ui-button--primary"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
          {isLoading && (
            <div
              className="project-grid"
              aria-busy="true"
              aria-label="Loading projects"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <BlueprintCardSkeleton key={i} />
              ))}
            </div>
          )}
          {isError && (
            <div className="gallery-empty" role="alert">
              <h2>Couldn’t load projects</h2>
              <p>Please try again. Your filters are still here.</p>
              <Button onClick={() => refetch()}>Try again</Button>
            </div>
          )}
          {!isLoading && !isError && !filteredItems.length && (
            <div className="gallery-empty">
              <Layers size={28} />
              <h2>
                {items.length
                  ? "No matching projects"
                  : "A little space for your next idea."}
              </h2>
              <p>
                {items.length
                  ? "Try a different search or reset the filters."
                  : "New projects will appear here when they’re available."}
              </p>
              {items.length > 0 ? (
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("All");
                    setComplexityFilter("All");
                  }}
                >
                  Reset filters
                </Button>
              ) : (
                <Link to="/create" className="ui-button ui-button--primary">
                  Create a project
                </Link>
              )}
            </div>
          )}
          {!isLoading && !isError && filteredItems.length > 0 && (
            <>
              <p className="gallery-results" role="status">
                {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "project" : "projects"}
              </p>
              <div className="project-grid">
                {filteredItems.map((item) => (
                  <article className="project-card" key={item.id}>
                    <ProjectMap item={item} />
                    <div className="project-card-body">
                      <div className="project-card-meta">
                        <span>{classifyBlueprintCategory(item)}</span>
                        <span>
                          {item.complexity || "Unspecified"} complexity
                        </span>
                      </div>
                      <h2>
                        <Link to={`/blueprint/${item.id}`}>
                          {item.appName || "Untitled project"}
                        </Link>
                      </h2>
                      <p>{item.description || item.idea}</p>
                      <div className="project-card-date">
                        <time dateTime={item.createdAt}>
                          {timeAgo(item.createdAt)}
                        </time>
                        {isPersonal && (
                          <span>{item.isPublic ? "Public" : "Private"}</span>
                        )}
                      </div>
                      <div className="project-card-actions">
                        <Link
                          to={`/blueprint/${item.id}`}
                          className="ui-button ui-button--secondary"
                        >
                          Open project <ArrowRight size={14} />
                        </Link>
                        <Button
                          variant="ghost"
                          onClick={() => setPreviewItem(item)}
                          aria-label={`Preview ${item.appName}`}
                        >
                          <Eye size={15} />
                          Preview
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <Modal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.appName || "Project preview"}
        description="A quick look at this project’s blueprint."
        size="lg"
      >
        {previewItem && (
          <div className="gallery-preview">
            <ProjectMap item={previewItem} />
            <p>{previewItem.description || previewItem.idea}</p>
            <Link
              to={`/blueprint/${previewItem.id}`}
              className="ui-button ui-button--primary"
              onClick={() => setPreviewItem(null)}
            >
              Open project <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
