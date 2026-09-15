import { useMemo } from 'react';

/**
 * Constellation — BuildX's signature visual element.
 *
 * Renders a deterministic "build constellation": nodes (artifact of the app —
 * tables, endpoints, screens) joined by hairline edges, drifting slowly.
 * Seeded per-blueprint so each project has a unique, stable identity.
 *
 * Pure SVG + CSS animations. No canvas, no libs, GPU-cheap.
 */

export interface ConstellationSpec {
  /** Number of schema/table nodes (cluster A, inner ring) */
  schema?: number;
  /** Number of API/endpoint nodes (cluster B, middle ring) */
  endpoints?: number;
  /** Number of UI/screen nodes (cluster C, outer ring) */
  screens?: number;
}

interface Node {
  x: number;
  y: number;
  r: number;
  cluster: 0 | 1 | 2;
  delay: number;
  hot: boolean; // brighter node (receives emerald accent occasionally)
}

interface Edge {
  a: number;
  b: number;
  cross: boolean; // cross-cluster link
  delay: number;
}

/* Mulberry32 — tiny deterministic PRNG */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildGraph(spec: Required<ConstellationSpec>, seed: number, size: number) {
  const rand = mulberry32(seed);
  const nodes: Node[] = [];
  const cx = size / 2;
  const cy = size / 2;

  const place = (count: number, innerR: number, outerR: number, cluster: 0 | 1 | 2, jitter = 0.18) => {
    const base = rand() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = base + (i / count) * Math.PI * 2 + (rand() - 0.5) * jitter * Math.PI;
      const radius = innerR + rand() * (outerR - innerR);
      nodes.push({
        x: cx + Math.cos(angle) * radius + (rand() - 0.5) * size * 0.04,
        y: cy + Math.sin(angle) * radius + (rand() - 0.5) * size * 0.04,
        r: 1.2 + rand() * 1.6,
        cluster,
        delay: nodes.length * 0.06,
        hot: rand() > 0.82,
      });
    }
  };

  const R = size * 0.46;
  place(spec.schema, R * 0.10, R * 0.38, 0);
  place(spec.endpoints, R * 0.40, R * 0.70, 1);
  place(spec.screens, R * 0.72, R * 1.0, 2);

  // Edges: nearest-neighbour chain per ring + a few cross-cluster links
  const edges: Edge[] = [];
  const link = (a: number, b: number, cross = false) =>
    edges.push({ a, b, cross, delay: 0.5 + edges.length * 0.05 });

  let start = 0;
  for (const count of [spec.schema, spec.endpoints, spec.screens]) {
    for (let i = 0; i < count; i++) {
      let best = -1, bestD = Infinity;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const dx = nodes[start + i].x - nodes[start + j].x;
        const dy = nodes[start + i].y - nodes[start + j].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best > -1 && i < best) link(start + i, start + best);
    }
    start += count;
  }

  // Cross-cluster bridges — the "data flow" spine
  const bridges = Math.max(2, Math.floor(nodes.length / 9));
  for (let k = 0; k < bridges; k++) {
    const a = Math.floor(rand() * nodes.length);
    let b = Math.floor(rand() * nodes.length);
    if (nodes[a].cluster === nodes[b].cluster) b = (b + 1) % nodes.length;
    link(a, b, true);
  }

  return { nodes, edges };
}

export interface ConstellationProps {
  /** Deterministic identity: blueprint id, app name, etc. */
  seed: string;
  spec?: ConstellationSpec;
  /** Render box in px (square) */
  size?: number;
  /** Root animation duration for the slow drift rotation (seconds) */
  driftSeconds?: number;
  className?: string;
  /** Dim variant for backgrounds */
  muted?: boolean;
  /** Skip the infinite drift rotation (thumbnails, dense grids) */
  static?: boolean;
}

export function Constellation({
  seed,
  spec = {},
  size = 420,
  driftSeconds = 90,
  className = '',
  muted = false,
  static: isStatic = false,
}: ConstellationProps) {
  const graph = useMemo(() => {
    const full: Required<ConstellationSpec> = {
      schema: spec.schema ?? 4,
      endpoints: spec.endpoints ?? 8,
      screens: spec.screens ?? 5,
    };
    return buildGraph(full, seedFromString(seed || 'buildx'), size);
  }, [seed, size, spec.schema, spec.endpoints, spec.screens]);

  const stroke = muted ? 'rgba(124,124,244,0.42)' : 'rgba(139,143,247,0.5)';
  const strokeCross = muted ? 'rgba(52,211,153,0.32)' : 'rgba(52,211,153,0.35)';
  const nodeFill = muted ? 'rgba(158,162,250,0.95)' : '#8B8FF7';
  const nodeHot = muted ? 'rgba(52,211,153,0.9)' : '#34D399';

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <g
        className={isStatic ? undefined : 'constellation-drift'}
        style={isStatic ? undefined : { transformOrigin: `${size / 2}px ${size / 2}px`, animationDuration: `${driftSeconds}s` }}
      >
        {graph.edges.map((e, i) => (
          <line
            key={i}
            x1={graph.nodes[e.a].x}
            y1={graph.nodes[e.a].y}
            x2={graph.nodes[e.b].x}
            y2={graph.nodes[e.b].y}
            stroke={e.cross ? strokeCross : stroke}
            strokeWidth={e.cross ? 0.9 : 0.6}
            className="constellation-edge"
            style={{ animationDelay: `${e.delay}s` }}
          />
        ))}
        {graph.nodes.map((n, i) => (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.hot ? n.r * 2.6 : n.r * 2.1}
              fill={n.hot ? nodeHot : nodeFill}
              opacity={0.14}
              className="constellation-node constellation-node--halo"
              style={{ animationDelay: `${n.delay}s` }}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.hot ? nodeHot : nodeFill}
              className="constellation-node"
              style={{ animationDelay: `${n.delay}s` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
