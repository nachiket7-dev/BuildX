import { ArrowUpRight, Database, GitBranch, Layers } from "../ui/icons";
import { Link } from "react-router-dom";
import { Constellation } from "../constellation/Constellation";
const examples = [
  {
    name: "Team workspace",
    seed: "workspace",
    title: "The structure behind teamwork.",
    text: "Projects, members, and tasks—connected through a shared data model.",
    entities: ["teams", "projects", "tasks"],
    path: "POST /api/projects",
    screen: "Project overview",
  },
  {
    name: "Analytics dashboard",
    seed: "analytics",
    title: "From events to understanding.",
    text: "A clear path from incoming events to the metrics your team needs.",
    entities: ["events", "reports", "metrics"],
    path: "GET /api/reports",
    screen: "Metrics dashboard",
  },
  {
    name: "Booking platform",
    seed: "booking",
    title: "Every appointment, accounted for.",
    text: "Availability, customers, and bookings with explicit relationships.",
    entities: ["services", "slots", "bookings"],
    path: "POST /api/bookings",
    screen: "Booking calendar",
  },
];
export function ProofSection() {
  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="section-intro section-intro--row">
          <div>
            <p className="eyebrow">
              03 / DIFFERENT IDEAS. CONNECTED FOUNDATIONS.
            </p>
            <h2>
              See the architecture
              <br />
              behind the possibility.
            </h2>
          </div>
          <Link className="landing-text-link" to="/gallery">
            Explore the gallery <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="example-grid">
          {examples.map((example) => (
            <article key={example.seed} className="blueprint-example">
              <div className="example-blueprint-art">
                <Constellation seed={example.seed} static size={260} />
                <span>{example.name}</span>
                <div className="example-entities">
                  {example.entities.map((entity) => (
                    <span key={entity}>
                      <Database size={12} />
                      {entity}
                    </span>
                  ))}
                </div>
                <div className="example-artifact-row">
                  <GitBranch size={13} />
                  <code>{example.path}</code>
                </div>
                <div className="example-artifact-row">
                  <Layers size={13} />
                  {example.screen}
                </div>
              </div>
              <div className="example-copy">
                <small>ILLUSTRATIVE BLUEPRINT</small>
                <h3>{example.title}</h3>
                <p>{example.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
