"use client";

// Geographic proximity as a network graph (#6). We have no coordinates — only
// location names + time zones — so proximity is APPROXIMATE: members in the same
// location are clustered tightly and linked with equal-thickness lines, clusters
// are spread around the circle, and same-time-zone clusters are placed next to
// each other (secondary pull). Unplaced members are shown to the side by the
// caller. Mirrors the visual language of CoordinationMap.

import type { Networks } from "./types";

type Geo = Networks["geographic"];

export default function GeographicMap({ geo }: { geo: Geo }) {
  const groups = [...(geo.location_groups ?? [])];
  if (groups.length === 0) return null;

  // time zone per location (from any node placed there)
  const tzOf = new Map<string, string | null>();
  for (const n of geo.nodes ?? []) {
    if (n.location && !tzOf.has(n.location)) tzOf.set(n.location, n.timezone);
  }
  // same-time-zone clusters end up adjacent
  groups.sort((a, b) => {
    const ta = tzOf.get(a.location) ?? "~", tb = tzOf.get(b.location) ?? "~";
    return ta === tb ? a.location.localeCompare(b.location) : ta.localeCompare(tb);
  });

  const cx = 250, cy = 250, nodeR = 17;
  const N = groups.length;
  const clusterR = N <= 1 ? 0 : 165;

  type Node = { code: string; x: number; y: number };
  const clusters = groups.map((g, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    const gx = cx + clusterR * Math.cos(a);
    const gy = cy + clusterR * Math.sin(a);
    const codes = g.private_codes ?? [];
    const m = codes.length;
    const ring = m <= 1 ? 0 : Math.min(48, 14 + m * 5);
    const nodes: Node[] = codes.map((c, j) => {
      if (m === 1) return { code: c, x: gx, y: gy };
      const a2 = (j / m) * 2 * Math.PI - Math.PI / 2;
      return { code: c, x: gx + ring * Math.cos(a2), y: gy + ring * Math.sin(a2) };
    });
    // push the label outward from the middle so it clears the nodes
    const labelR = clusterR + ring + 16;
    const lx = N <= 1 ? cx : cx + labelR * Math.cos(a);
    const ly = N <= 1 ? cy - ring - 16 : cy + labelR * Math.sin(a);
    return { location: g.location, tz: tzOf.get(g.location) ?? null, gx, gy, ring, nodes, lx, ly };
  });

  return (
    <svg viewBox="0 0 500 500" className="w-full max-w-md mx-auto" aria-label="Team geographic network">
      {/* intra-cluster links — equal thickness; co-located members are bound together */}
      {clusters.map((cl, ci) =>
        cl.nodes.map((a, j) =>
          cl.nodes.slice(j + 1).map((b, k) => (
            <line key={`${ci}-${j}-${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#9CA3AF" strokeWidth={1.25} strokeOpacity={0.5} />
          ))
        )
      )}
      {/* cluster labels */}
      {clusters.map((cl, ci) => (
        <text key={`lbl-${ci}`} x={cl.lx} y={cl.ly} textAnchor="middle"
          fontSize={11} fontFamily="DM Sans, sans-serif" fontWeight="600" fill="#1A1A2E">
          {cl.location}
          {cl.tz ? <tspan x={cl.lx} dy="13" fontSize={9} fontWeight="400" fill="#6B7280">{cl.tz}</tspan> : null}
        </text>
      ))}
      {/* member nodes — unlabeled circles; location cluster label identifies the group */}
      {clusters.map((cl, ci) =>
        cl.nodes.map((nd, ni) => (
          <circle key={`${ci}-${ni}`} cx={nd.x} cy={nd.y} r={nodeR}
            fill="rgba(255,255,255,0.9)" stroke="#1A1A2E" strokeWidth={2} />
        ))
      )}
    </svg>
  );
}
