import { RouteLoading } from "./ui/RouteLoading";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { BlueprintSessionProvider } from "../hooks/useBlueprintSession";
import { VFSProvider } from "../context/VFSContext";
import { useAuth } from "../hooks/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { ErrorBoundary } from "./ErrorBoundary";
import type { PaletteAction } from "./CommandPalette";
import type { ExportTarget } from "./DeployModal";
const DeployModal = lazy(() =>
  import("./DeployModal").then((m) => ({ default: m.DeployModal })),
);
const CommandPalette = lazy(() =>
  import("./CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
export type AppShellOutletContext = {
  sidebarOpen: boolean;
  onDeploy?: (target?: ExportTarget) => void;
};
const FULL_BLEED_ROUTES = ["/agent", "/gallery"];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTarget>("zip");
  const [isGlobalPaletteOpen, setIsGlobalPaletteOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, authReady } = useAuth();
  const desktop = useMediaQuery("(min-width: 1024px)");

  // Full-bleed routes (Cortex IDE & Community Gallery) hide the global sidebar
  // to maximize workspace real estate and stretch to 100% viewport width.
  const isFullBleed = FULL_BLEED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const isAgentPage = pathname.startsWith("/agent");
  const canShowSidebar = Boolean(user && authReady && !isFullBleed);
  const sidebarVisible = canShowSidebar && sidebarOpen;
  const routeIdMatch = pathname.match(/\/(?:agent|blueprint)\/([^/]+)/);
  const routeId = routeIdMatch ? routeIdMatch[1] : undefined;
  // Only the IDE owns internal scroll panes; the project picker is a normal page.
  const isAgentWorkspace = isAgentPage && Boolean(routeId);
  const openExport = useCallback((target: ExportTarget = "zip") => {
    setExportTarget(target);
    setIsDeployModalOpen(true);
  }, []);

  useEffect(() => {
    setSidebarOpen(desktop && canShowSidebar);
  }, [desktop, canShowSidebar]);
  useEffect(() => {
    if (!desktop) setSidebarOpen(false);
  }, [pathname, desktop]);
  useEffect(() => {
    setIsDeployModalOpen(false);
  }, [routeId]);

  // Global Cmd+K for non-agent pages (agent pages have their own handler)
  useEffect(() => {
    if (isAgentPage) return; // Agent page manages its own palette
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsGlobalPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAgentPage]);

  const handleGlobalPaletteAction = useCallback(
    (action: PaletteAction) => {
      switch (action.type) {
        case "action":
          if (action.id === "deploy-github" || action.id === "export-zip") {
            if (routeId) openExport(action.id === "deploy-github" ? "github" : "zip");
          } else if (action.id === "open-studio") {
            navigate("/create");
          } else if (action.id === "open-gallery") {
            navigate("/gallery");
          } else if (action.id === "open-workspace") {
            navigate("/agent");
          }
          break;
        default:
          break;
      }
    },
    [navigate, routeId, openExport],
  );

  return (
    <VFSProvider key={`${user?.id ?? "guest"}:${routeId ?? "none"}`}>
      <BlueprintSessionProvider>
        <div className="app-shell">
          <SkipLink />

          {/* ── GLOBAL HEADER: Fixed top anchor (h-16 shrink-0 z-30) ── */}
          <Header
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            showSidebarToggle={canShowSidebar}
            sidebarOpen={sidebarVisible}
            onDeploy={
              routeId && user ? () => openExport() : undefined
            }
          />

          {/* ── BELOW-HEADER LAYOUT: Fixed Sidebar + Main Workspace Scroll ── */}
          <div className="flex-1 flex min-h-0 w-full overflow-hidden min-w-0 relative z-10">
            {canShowSidebar && (
              <Sidebar
                isOpen={sidebarVisible}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            )}

            <div
              id="main-content"
              tabIndex={-1}
              className={`app-shell__main flex-1 h-full min-h-0 min-w-0 ${
                isFullBleed ? "w-full m-0 p-0" : ""
              } ${
                isAgentWorkspace
                  ? "overflow-hidden"
                  : "overflow-y-auto custom-scrollbar"
              } flex flex-col relative z-10`}
              style={{ marginLeft: sidebarVisible && desktop ? 280 : 0 }}
            >
              <ErrorBoundary resetKey={pathname}>
                <Suspense
                  fallback={<RouteLoading label="Opening your project" />}
                >
                  <Outlet
                    context={
                      {
                        sidebarOpen: sidebarVisible && desktop,
                        onDeploy:
                          routeId && user ? openExport : undefined,
                      } satisfies AppShellOutletContext
                    }
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>

          <Suspense fallback={null}>
            {isDeployModalOpen && (
              <DeployModal
                isOpen={isDeployModalOpen}
                onClose={() => setIsDeployModalOpen(false)}
                blueprintId={routeId}
                initialTarget={exportTarget}
              />
            )}

            {/* Global Command Palette (non-agent pages) */}
            {!isAgentPage && isGlobalPaletteOpen && (
              <CommandPalette
                isOpen={isGlobalPaletteOpen}
                onClose={() => setIsGlobalPaletteOpen(false)}
                onAction={handleGlobalPaletteAction}
                appName="BuildX"
                scope="global"
                canExport={Boolean(routeId && user)}
              />
            )}
          </Suspense>
        </div>
      </BlueprintSessionProvider>
    </VFSProvider>
  );
}
