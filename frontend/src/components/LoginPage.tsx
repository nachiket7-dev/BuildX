import { Logo } from "./Logo";
import { Constellation } from "./constellation/Constellation";
import { useState } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Github } from './ui/icons';
import { useAuth } from "../hooks/useAuth";
import { startGithubOAuth } from "../lib/utils";
import { PageHead } from "./PageHead";
import { Button, Input, SegmentedControl } from "./ui";
type AuthTab = "login" | "signup";
export function LoginPage() {
  const [tab, setTab] = useState<AuthTab>(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup"
      ? "signup"
      : "login",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { user, authReady, login, signup, isLoading, error, clearError } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from?.startsWith(
    "/login",
  )
    ? "/create"
    : (location.state as { from?: string } | null)?.from || "/create";

  if (authReady && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      navigate(from, { replace: true });
    } catch {
      // Error surfaced via useAuth
    }
  }

  function switchTab(newTab: AuthTab) {
    setTab(newTab);
    clearError();
  }

  function handleGithubOAuth() {
    startGithubOAuth("login", from);
  }

  return (
    <main className="auth-page">
      <PageHead
        title={tab === "login" ? "Sign in — BuildX" : "Create account — BuildX"}
        description="Sign in to your BuildX workspace."
      />
      <aside className="auth-story page-grid">
        <Constellation seed="buildx-auth" size={480} static className="auth-constellation" />
        <Link className="brand-lockup" to="/">
          <Logo />
        </Link>
        <div>
          <p className="eyebrow">YOUR NEXT IDEA HAS A HOME</p>
          <h2>
            A little thought.
            <br />A lot of possibility.
          </h2>
          <p>
            Go from the first idea to a blueprint you understand and code you
            can make your own.
          </p>
          <div className="auth-steps">
            <span>
              01 <strong>Describe your idea</strong>
            </span>
            <span>
              02 <strong>Explore the blueprint</strong>
            </span>
            <span>
              03 <strong>Build in your workspace</strong>
            </span>
          </div>
        </div>
        <span>Made for the way ideas take shape.</span>
      </aside>
      <section className="auth-form-region page-grid">
        <Link className="landing-text-link" to="/">
          <ArrowLeft size={14} />
          Back to BuildX
        </Link>
        <div className="auth-form-card">
          <p className="eyebrow">LET’S GET YOU BUILDING</p>
          <h1>
            {tab === "login" ? "Welcome back." : "Make room for your ideas."}
          </h1>
          <p>
            {tab === "login"
              ? "Sign in to return to your projects."
              : "Create an account to start your first project."}
          </p>
          <SegmentedControl
            ariaLabel="Account action"
            value={tab}
            onChange={switchTab}
            options={[
              { value: "login", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />
          <form onSubmit={handleSubmit}>
            {tab === "signup" && (
              <Input
                label="Your name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            )}
            <Input
              type="email"
              label="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
            <div>
              <Input
                type={showPassword ? "text" : "password"}
                label="Password"
                autoComplete={
                  tab === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={tab === "signup" ? 8 : undefined}
                required
                disabled={isLoading}
              />
              <label className="auth-show-password">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show password
              </label>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
            >
              {tab === "login" ? "Sign in" : "Create account"}
              <ArrowRight size={16} />
            </Button>
          </form>
          <div className="auth-divider">or continue with</div>
          <Button onClick={handleGithubOAuth} disabled={isLoading} size="lg">
            <Github size={17} />
            GitHub
          </Button>
        </div>
      </section>
    </main>
  );
}
