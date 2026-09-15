import { ArrowDown, ArrowUpRight } from "../ui/icons";
import { Link } from "react-router-dom";
import { ProductDemo } from "./ProductDemo";
export function LandingHero({ ready = true }: { ready?: boolean }) {
  return (
    <section className="landing-hero" id="product">
      <div className="landing-container">
        <div className="landing-hero-copy">
          <div>
            <p className="eyebrow">
              <span className="eyebrow-line" /> YOUR IDEA. EVERY LAYER.
              CONNECTED.
            </p>
            <h1>
              Think it through.
              <br />
              <span>Build it out.</span>
            </h1>
          </div>
          <div className="landing-hero-aside">
            <p>
              Watch your idea become a connected blueprint. Six specialist
              agents work through the data, APIs, screens, and code—ready for
              you to review and refine.
            </p>
            <div className="landing-hero-actions">
              <Link
                to="/create"
                className="ui-button ui-button--primary ui-button--lg"
              >
                Launch Studio <ArrowUpRight size={18} />
              </Link>
              <a href="#product-demo" className="landing-text-link">
                Watch it take shape <ArrowDown size={15} />
              </a>
            </div>
          </div>
        </div>
        <div id="product-demo">
          <ProductDemo ready={ready} />
        </div>
        <div className="landing-output-rail">
          <span>ONE CONNECTED WORKFLOW</span>
          <p>Database schemas</p>
          <i />
          <p>API architecture</p>
          <i />
          <p>Editable code</p>
          <i />
          <p>App previews</p>
        </div>
      </div>
    </section>
  );
}
