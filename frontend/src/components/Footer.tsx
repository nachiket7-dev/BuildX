import { Logo } from "./Logo";
import { Link } from "react-router-dom";
import { ArrowUpRight, Github } from './ui/icons';
export function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-cta">
          <p className="eyebrow">FROM YOUR FIRST IDEA TO YOUR NEXT BUILD</p>
          <h2>
            Your next idea.
            <br />
            <span>A blueprint to build on.</span>
          </h2>
          <Link
            to="/create"
            className="ui-button ui-button--primary ui-button--lg"
          >
            Launch Studio <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="footer-bottom">
          <Link to="/" className="brand-lockup">
            <Logo />
          </Link>
          <span>© {new Date().getFullYear()} BuildX</span>
          <nav aria-label="Footer navigation">
            <a href="#features">Product</a>
            <Link to="/gallery">Gallery</Link>
            <a
              href="https://github.com/nachiket7-dev/BuildX"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={15} /> GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
