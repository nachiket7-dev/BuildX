import { Logo } from "./Logo";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu } from './ui/icons';
import { NavOverlay } from "./NavOverlay";
import { DesktopDownload } from "./DesktopDownload";
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="marketing-header">
        <div className="landing-container marketing-header-inner">
          <Link className="brand-lockup" to="/" aria-label="BuildX home">
            <Logo />
          </Link>
          <nav className="marketing-nav" aria-label="Main navigation">
            <a href="#features">Product</a>
            <a href="#how-it-works">How it works</a>
            <Link to="/gallery">Gallery</Link>
            <a
              href="https://github.com/nachiket7-dev/BuildX#readme"
              target="_blank"
              rel="noreferrer"
            >
              Docs <ArrowUpRight size={12} />
            </a>
          </nav>
          <div className="marketing-header-actions">
            <div className="hidden sm:block"><DesktopDownload /></div>
            <Link to="/create" className="ui-button ui-button--secondary">
              Launch Studio <ArrowUpRight size={15} />
            </Link>
            <button
              className="ui-icon-button marketing-menu-toggle"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>
      <NavOverlay isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
