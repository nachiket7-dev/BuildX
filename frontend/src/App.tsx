import { LandingPreloader } from "./components/LandingPreloader";
import { RouteLoading } from "./components/ui/RouteLoading";
import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { useAuthProvider, AuthContext } from "./hooks/useAuth";
import { HomePage } from "./components/HomePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
const AppShell = lazy(() =>
  import("./components/AppShell").then((m) => ({ default: m.AppShell })),
);
const BlueprintPage = lazy(() =>
  import("./components/BlueprintPage").then((m) => ({
    default: m.BlueprintPage,
  })),
);
const GalleryPage = lazy(() =>
  import("./components/GalleryPage").then((m) => ({ default: m.GalleryPage })),
);
const AgentPage = lazy(() =>
  import("./components/AgentPage").then((m) => ({ default: m.AgentPage })),
);
const LoginPage = lazy(() =>
  import("./components/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const GithubCallbackPage = lazy(() =>
  import("./components/GithubCallbackPage").then((m) => ({
    default: m.GithubCallbackPage,
  })),
);
const ComponentPreview = import.meta.env.DEV
  ? lazy(() => import("./components/ComponentPreview"))
  : null;
function WorkspaceRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/agent/${id}` : "/agent"} replace />;
}
export default function App() {
  const [entering, setEntering] = useState(true);
  const content = useRef<HTMLDivElement>(null);
  const finishEntrance = useCallback(() => setEntering(false), []);
  useEffect(() => {
    if (content.current) content.current.inert = entering;
  }, [entering]);
  const auth = useAuthProvider();
  const { pathname } = useLocation();
  return (
    <AuthContext.Provider value={auth}>
      {entering && <LandingPreloader onComplete={finishEntrance} />}
      <div
        className={`boot-content ${entering ? "boot-content--entering" : ""}`}
        ref={content}
        aria-hidden={entering || undefined}
      >
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<HomePage ready={!entering} />} />
              {["/home", "/landing"].map((path) => (
                <Route
                  key={path}
                  path={path}
                  element={<Navigate to="/" replace />}
                />
              ))}
              <Route path="/login" element={<LoginPage />} />
              {["/auth", "/signin"].map((path) => (
                <Route
                  key={path}
                  path={path}
                  element={<Navigate to="/login" replace />}
                />
              ))}
              <Route
                path="/signup"
                element={<Navigate to="/login?mode=signup" replace />}
              />
              <Route path="/login/callback" element={<GithubCallbackPage />} />
              <Route
                path="/auth/callback"
                element={<Navigate to="/login/callback" replace />}
              />
              {ComponentPreview && (
                <Route path="/__components" element={<ComponentPreview />} />
              )}
              <Route element={<AppShell />}>
                <Route path="/create" element={<BlueprintPage />} />
                {["/blueprints/new", "/new", "/builder"].map((path) => (
                  <Route
                    key={path}
                    path={path}
                    element={<Navigate to="/create" replace />}
                  />
                ))}
                <Route path="/gallery" element={<GalleryPage />} />
                {[
                  "/blueprints",
                  "/dashboard",
                  "/projects",
                  "/community",
                  "/explore",
                ].map((path) => (
                  <Route
                    key={path}
                    path={path}
                    element={<Navigate to="/gallery" replace />}
                  />
                ))}
                <Route path="/blueprint/:id" element={<BlueprintPage />} />
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
                {["/ide", "/ide/:id", "/workspace", "/workspace/:id"].map(
                  (path) => (
                    <Route
                      key={path}
                      path={path}
                      element={<WorkspaceRedirect />}
                    />
                  ),
                )}
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </AuthContext.Provider>
  );
}
