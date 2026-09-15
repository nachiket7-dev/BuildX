import { Link } from "react-router-dom";
import { ArrowUpRight } from './ui/icons';
import { Modal } from "./ui/Modal";
export function NavOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Explore BuildX">
      <nav className="mobile-nav-links" aria-label="Mobile navigation">
        <a href="/#features" onClick={onClose}>
          Product <ArrowUpRight size={18} />
        </a>
        <a href="/#how-it-works" onClick={onClose}>
          How it works <ArrowUpRight size={18} />
        </a>
        <Link to="/gallery" onClick={onClose}>
          Gallery <ArrowUpRight size={18} />
        </Link>
        <Link to="/create" onClick={onClose}>
          Launch Studio <ArrowUpRight size={18} />
        </Link>
        <a
          href="https://github.com/nachiket7-dev/BuildX#readme"
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
        >
          Documentation <ArrowUpRight size={18} />
        </a>
      </nav>
    </Modal>
  );
}
