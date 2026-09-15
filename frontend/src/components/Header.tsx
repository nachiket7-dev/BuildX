import { Logo } from "./Logo";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Code2,
  Grid,
  LogOut,
  Menu,
  PanelLeft,
  Plus,
} from './ui/icons';
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Dropdown } from "./ui/Dropdown";
interface HeaderProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  sidebarOpen?: boolean;
  onDeploy?: () => void;
}
export function Header({
  onToggleSidebar,
  showSidebarToggle,
  sidebarOpen,
  onDeploy,
}: HeaderProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { to: "/create", label: "Studio", Icon: Plus },
    { to: "/gallery", label: "Gallery", Icon: Grid },
    ...(user ? [{ to: "/agent", label: "Workspace", Icon: Code2 }] : []),
  ];
  const active = (to: string) =>
    to === "/agent" ? pathname.startsWith("/agent") : pathname === to;
  return (
    <>
      <header className="app-header">
        <div className="app-header-left">
          {showSidebarToggle && (
            <button
              className="ui-icon-button"
              onClick={onToggleSidebar}
              aria-label={
                sidebarOpen ? "Close projects sidebar" : "Open projects sidebar"
              }
              aria-expanded={sidebarOpen}
            >
              <PanelLeft size={18} />
            </button>
          )}
          <Link to="/" className="brand-lockup" aria-label="BuildX home">
            <Logo />
          </Link>
          <span className="app-header-context">
            {pathname.startsWith("/blueprint/")
              ? "Project overview"
              : pathname.startsWith("/agent")
                ? "Workspace"
                : pathname === "/gallery"
                  ? "Your next inspiration"
                  : "Architecture studio"}
          </span>
        </div>
        <nav className="app-header-nav" aria-label="Main navigation">
          {links.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              aria-current={active(to) ? "page" : undefined}
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="app-header-actions">
          {onDeploy && (
            <Button variant="secondary" onClick={onDeploy}>
              Export <ArrowUpRight size={14} />
            </Button>
          )}
          {user ? (
            <Dropdown
              trigger={
                <button className="ui-icon-button" aria-label="Account menu">
                  <span className="account-avatar">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                </button>
              }
              items={[
                {
                  label: "Sign out",
                  icon: <LogOut size={14} />,
                  onClick: logout,
                  danger: true,
                },
              ]}
            />
          ) : (
            <Link
              className="ui-button ui-button--secondary"
              to="/login"
              state={{ from: pathname }}
            >
              Sign in
            </Link>
          )}
          <button
            className="ui-icon-button app-mobile-toggle"
            onClick={() => setMenuOpen(true)}
            aria-label="Open app navigation"
            aria-expanded={menuOpen}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
      <Modal
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Your workspace"
      >
        <nav className="mobile-nav-links" aria-label="Mobile app navigation">
          {links.map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setMenuOpen(false)}>
              {label}
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </nav>
      </Modal>
    </>
  );
}
