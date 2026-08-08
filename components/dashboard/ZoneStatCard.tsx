"use client";

// One zone summary card: % favorable (labelled), the fav/neutral/unfavorable
// split as a bar + counts, and a plain agreement caption. Shared between the
// consultant dashboard (PsSafetyPanel) and the member Phase 3 report so the
// numbers members see are literally the same card the consultant sees.

import {
  BAND_COLOR, FAV_GREEN, NEU_YELLOW, UNFAV_RED, ZONE_NAME, isSmallN, type ZoneScore,
} from "./types";

function favWord(pct: number, total: number, count: number, small: boolean): string {
  if (small) return `${count} of ${total} members favorable`;
  return `${Math.round(pct)}% favorable (${count} of ${total} members)`;
}

export default function ZoneStatCard({ z }: { z: ZoneScore }) {
  const { counts } = z;
  const total = counts.total || 1;
  const small = isSmallN(counts.total);
  const seg = (n: number) => (n / total) * 100;
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-1">Zone {z.zone}</p>
      <h3 className="text-lg mb-3" style={{ fontFamily: "Playfair Display, serif" }}>{ZONE_NAME[z.zone]}</h3>
      <div className="text-4xl font-bold mb-1" style={{ color: BAND_COLOR[z.band] }}>
        {small ? `${counts.favorable}/${counts.total}` : `${Math.round(z.pct_favorable)}%`}
      </div>
      <p className="text-xs text-[var(--color-grey)] mb-3">
        {favWord(z.pct_favorable, counts.total, counts.favorable, small)}
      </p>
      <div className="h-3 rounded-full overflow-hidden flex mb-2" style={{ backgroundColor: "#E5E7EB" }}>
        <div style={{ width: `${seg(counts.favorable)}%`, backgroundColor: FAV_GREEN }} />
        <div style={{ width: `${seg(counts.neutral)}%`, backgroundColor: NEU_YELLOW }} />
        <div style={{ width: `${seg(counts.unfavorable)}%`, backgroundColor: UNFAV_RED }} />
      </div>
      <p className="text-xs text-[var(--color-grey)]">
        Favorable {counts.favorable} · Neutral {counts.neutral} · Unfavorable {counts.unfavorable} · mean {z.mean_effective.toFixed(1)}/5
      </p>
      <p className="text-xs text-[var(--color-grey)] mt-1">
        Agreement spread (SD): {z.agreement_sd.toFixed(2)} — lower means members answered more alike.
      </p>
    </div>
  );
}
