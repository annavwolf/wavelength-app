"use client";

import { NEU_YELLOW, type CoordinationPair, type AsymmetricPair } from "./types";

// Colorblind-safe (Okabe-Ito) palette + widened thickness steps, so coordination
// frequency is legible by BOTH hue and line weight. Exported so the legend in
// TeamConnectivityPanel renders the exact same swatches.
export const FREQ_COLOR: Record<string, string> = {
  daily: "#0072B2",        // blue
  weekly: "#009E73",       // bluish green
  occasionally: "#E69F00", // orange
  rarely: "#999999",       // grey (recessive)
};
export const FREQ_WIDTH: Record<string, number> = {
  daily: 4,
  weekly: 2.75,
  occasionally: 1.75,
  rarely: 1,
};

// SVG circular coordination network. Unchanged behaviour from the old dashboard,
// lifted into its own component for reuse in the Team Connectivity panel.
export default function CoordinationMap({
  pairs,
  codes,
  peripheralCodes,
  asymmetricPairs,
}: {
  pairs: CoordinationPair[];
  codes: string[];
  peripheralCodes: string[];
  asymmetricPairs: AsymmetricPair[];
}) {
  const n = codes.length;
  if (n === 0) return null;
  const cx = 250, cy = 250, R = 175, nodeR = 22;

  const pos: Record<string, { x: number; y: number }> = {};
  codes.forEach((c, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos[c] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  const asymSet = new Set(
    asymmetricPairs.flatMap((ap) => [
      `${ap.high_freq_private_code}:${ap.low_freq_private_code}`,
      `${ap.low_freq_private_code}:${ap.high_freq_private_code}`,
    ])
  );
  return (
    <svg viewBox="0 0 500 500" className="w-full max-w-md mx-auto" aria-label="Team coordination network">
      {pairs.filter((p) => p.to_private_code).map((p, i) => {
        const f = pos[p.from_private_code], t = pos[p.to_private_code!];
        if (!f || !t) return null;
        const isAsym = asymSet.has(`${p.from_private_code}:${p.to_private_code}`);
        // Keep the frequency colour/thickness readable; mark asymmetry with a
        // dashed stroke + the ⚠ glyph rather than recolouring the whole line.
        return (
          <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
            stroke={FREQ_COLOR[p.frequency] ?? "#999999"}
            strokeWidth={FREQ_WIDTH[p.frequency] ?? 1}
            strokeOpacity={p.frequency === "rarely" ? 0.45 : 0.8}
            strokeDasharray={isAsym ? "5 4" : undefined}
          />
        );
      })}
      {codes.map((c) => {
        const p = pos[c];
        if (!p) return null;
        const isPeri = peripheralCodes.includes(c);
        return (
          <g key={c}>
            <circle cx={p.x} cy={p.y} r={nodeR}
              fill="rgba(255,255,255,0.88)"
              stroke={isPeri ? "#9CA3AF" : "#1A1A2E"}
              strokeWidth={isPeri ? 1.5 : 2}
              strokeDasharray={isPeri ? "4 3" : undefined}
            />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontFamily="DM Sans, sans-serif" fontWeight="600" fill="#1A1A2E">
              {c}
            </text>
          </g>
        );
      })}
      {asymmetricPairs.map((ap, i) => {
        const f = pos[ap.high_freq_private_code], t = pos[ap.low_freq_private_code];
        if (!f || !t) return null;
        return (
          <text key={i} x={(f.x + t.x) / 2} y={(f.y + t.y) / 2}
            textAnchor="middle" fontSize={13} fill={NEU_YELLOW}>⚠</text>
        );
      })}
    </svg>
  );
}
