import { useState } from "react";
import type { StackSpec } from "../lib/types";

export const STACK_LABELS: Record<string, string> = {
  next: "Next.js",
  express: "Express",
  fastify: "Fastify",
  postgres: "Postgres",
  supabase: "Supabase",
  mongo: "MongoDB",
  jwt: "JWT",
  clerk: "Clerk",
  nextauth: "NextAuth",
};
const layers = [
  {
    name: "Interface",
    detail: "Screens and components, mapped to what your users need.",
    file: "interface / screens",
    number: "01",
  },
  {
    name: "Logic",
    detail: "API routes and authentication that connect the experience.",
    file: "services / api",
    number: "02",
  },
  {
    name: "Data",
    detail: "A database schema that gives every relationship a place.",
    file: "database / schema",
    number: "03",
  },
];

/** An explorable illustration of blueprint outputs, never a generated preview. */
export function StudioBlueprint({ stack }: { stack: StackSpec }) {
  const [active, setActive] = useState(0);
  return (
    <figure
      className="studio-blueprint"
      aria-label="Explore the layers of a blueprint"
    >
      <div className="studio-scene" aria-hidden="true" data-layer={active}>
        <div className="studio-orbit" />
        <span className="studio-dimension studio-dimension--top">
          ANATOMY OF AN IDEA
        </span>
        <div className="studio-spine" />
        {[2, 1, 0].map((index) => (
          <div
            key={index}
            className={`studio-plane studio-plane--${index} ${active === index ? "is-active" : ""}`}
          >
            <div className="studio-plane-header">
              <span>{layers[index].file}</span>
              <span>{layers[index].number}</span>
            </div>
            {index === 0 ? (
              <div className="studio-wireframe">
                <div className="studio-wire-nav">
                  <b />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="studio-wire-main">
                  <div className="studio-wire-heading" />
                  <div className="studio-wire-cards">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="studio-wire-chart">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
            ) : index === 1 ? (
              <div className="studio-api-art">
                <div>
                  <b>GET</b>
                  <span>/api/projects</span>
                  <i />
                </div>
                <div>
                  <b>POST</b>
                  <span>/api/generate</span>
                  <i />
                </div>
                <p>
                  <span>◆</span> {STACK_LABELS[stack.auth]} authentication
                </p>
              </div>
            ) : (
              <div className="studio-data-art">
                <div>
                  <strong>projects</strong>
                  <span>
                    id <i>uuid</i>
                  </span>
                  <span>
                    owner_id <i>ref</i>
                  </span>
                </div>
                <b>─ ─</b>
                <div>
                  <strong>members</strong>
                  <span>
                    id <i>uuid</i>
                  </span>
                  <span>
                    role <i>text</i>
                  </span>
                </div>
              </div>
            )}
            <span className="studio-plane-tag">
              {index === 0
                ? "UI SCREENS"
                : index === 1
                  ? STACK_LABELS[stack.framework]
                  : STACK_LABELS[stack.db]}
            </span>
          </div>
        ))}
      </div>
      <figcaption>
        <div className="studio-layer-controls" aria-label="Blueprint layers">
          {layers.map((layer, index) => (
            <button
              type="button"
              key={layer.name}
              aria-pressed={active === index}
              onClick={() => setActive(index)}
            >
              <span>{layer.number}</span>
              {layer.name}
            </button>
          ))}
        </div>
        <p>{layers[active].detail}</p>
        <span className="studio-illustration-label">
          Illustrative architecture · Select a layer to explore
        </span>
      </figcaption>
    </figure>
  );
}
