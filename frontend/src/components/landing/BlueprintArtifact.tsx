import {
  Check,
  Database,
  FileCode2,
  Lock,
  ArrowRight,
  Layers,
} from "../ui/icons";
import { demoBlueprint as bp } from "./demoData";
export type DemoArtifact =
  "features" | "schema" | "api" | "ui" | "architecture" | "code";

export function BlueprintArtifact({ view }: { view: DemoArtifact }) {
  if (view === "schema")
    return (
      <div className="blueprint-schema">
        {bp.schema.map((table, index) => (
          <div
            className="blueprint-table artifact-enter"
            key={table.table}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="blueprint-table-title">
              <Database size={16} />
              <strong>{table.table}</strong>
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>
            {table.columns.map((column) => (
              <div className="blueprint-field" key={column.name}>
                <span>{column.name}</span>
                <small>{column.type}</small>
              </div>
            ))}
            {index > 0 && (
              <div className="blueprint-relation">
                <span />
                {index === 1 ? "user_id → users.id" : "link_id → links.id"}
              </div>
            )}
          </div>
        ))}
        <p className="artifact-footnote">
          Each link belongs to a user. Every click belongs to a link.
        </p>
      </div>
    );
  if (view === "api")
    return (
      <div className="blueprint-endpoints">
        {bp.endpoints.map((endpoint, index) => (
          <div
            className="blueprint-endpoint artifact-enter"
            key={endpoint.path + endpoint.method}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span
              className={`endpoint-method method-${endpoint.method.toLowerCase()}`}
            >
              {endpoint.method}
            </span>
            <div>
              <code>{endpoint.path}</code>
              <small>{endpoint.description}</small>
            </div>
            {"auth" in endpoint && (
              <Lock size={13} aria-label="Authentication required" />
            )}
          </div>
        ))}
      </div>
    );
  if (view === "ui")
    return (
      <div className="blueprint-screens">
        {bp.screens.map((screen, index) => (
          <div
            className="blueprint-screen artifact-enter"
            key={screen.name}
            style={{ animationDelay: `${index * 130}ms` }}
          >
            <div
              className={`screen-wireframe screen-wireframe--${index}`}
              aria-hidden="true"
            >
              <div className="wire-nav">
                <i />
                <i />
                <i />
              </div>
              <div className="wire-content">
                <b />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div>
              <strong>
                <Layers size={14} />
                {screen.name}
              </strong>
              <p>{screen.components}</p>
            </div>
          </div>
        ))}
        <p className="artifact-footnote">
          Screen definitions connect your features to the interface.
        </p>
      </div>
    );
  if (view === "code")
    return (
      <div className="blueprint-code-layout">
        <div className="blueprint-code-files">
          {Object.keys(bp.code.files).map((file, i) => (
            <div className={i === 0 ? "is-selected" : ""} key={file}>
              <FileCode2 size={14} />
              <span>{file}</span>
            </div>
          ))}
        </div>
        <div className="blueprint-code-content">
          <span>
            src/pages/Links.tsx <small>EXCERPT</small>
          </span>
          <pre>
            {bp.code.files["src/pages/Links.tsx"].split("\n").map((line, i) => (
              <div
                className="artifact-enter"
                key={i}
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <b>{String(i + 1).padStart(2, "0")}</b>
                <code>{line || " "}</code>
              </div>
            ))}
          </pre>
        </div>
      </div>
    );
  if (view === "architecture")
    return (
      <div className="blueprint-architecture">
        <div className="architecture-flow">
          {[
            bp.architecture.frontend,
            bp.architecture.backend,
            bp.architecture.database,
          ].map((name, i) => (
            <div
              key={name}
              className="artifact-enter"
              style={{ animationDelay: `${i * 160}ms` }}
            >
              <span>{["INTERFACE", "API LAYER", "PERSISTENCE"][i]}</span>
              <strong>{name}</strong>
              {i < 2 && <ArrowRight size={17} className="architecture-arrow" />}
            </div>
          ))}
        </div>
        <div className="architecture-note">
          <Lock size={17} />
          <div>
            <strong>Authentication travels with the request.</strong>
            <p>
              JWT sessions protect saved links and analytics. Public short links
              resolve through a separate route.
            </p>
          </div>
        </div>
        <div className="blueprint-summary">
          {[
            [bp.schema.length, "tables"],
            [bp.endpoints.length, "endpoints"],
            [bp.screens.length, "screens"],
          ].map(([count, label]) => (
            <span key={label}>
              <strong>{count}</strong>
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  return (
    <div className="blueprint-features">
      <div className="blueprint-feature-intro">
        <span>PROJECT BRIEF</span>
        <h4>{bp.description}</h4>
        <p>A focused workspace for {bp.targetUsers.toLowerCase()}.</p>
      </div>
      <div className="blueprint-feature-list">
        {bp.features.core.map((feature, index) => (
          <div
            className="artifact-enter"
            key={feature}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <span>
              <Check size={14} />
            </span>
            <div>
              <strong>{feature}</strong>
              <p>
                {
                  [
                    "Turn a destination URL into a shareable short link.",
                    "Keep a searchable collection in your own workspace.",
                    "Understand how your shared links are being used.",
                  ][index]
                }
              </p>
            </div>
            <small>0{index + 1}</small>
          </div>
        ))}
      </div>
      <div className="blueprint-auth">
        <Lock size={13} /> Sign-in and owner-scoped access included in the plan
      </div>
    </div>
  );
}
