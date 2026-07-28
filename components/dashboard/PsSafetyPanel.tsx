"use client";

import Accordion from "./Accordion";
import {
  BAND_COLOR, FAV_GREEN, NEU_YELLOW, UNFAV_RED, ZONE_NAME, ZONE_SHORT, ZONE_BADGE,
  hasText, isSmallN, type PsStatementScore, type Tier1Result, type Tier2Result, type ZoneScore,
} from "./types";

// 5-point colour scale for the per-statement distribution (strongly disagree → strongly agree).
const POINT_COLOR: Record<number, string> = {
  1: UNFAV_RED, 2: "#D98A6B", 3: NEU_YELLOW, 4: "#4F9C82", 5: FAV_GREEN,
};
const POINT_LABEL: Record<number, string> = {
  1: "Strongly disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly agree",
};

function favWord(pct: number, total: number, count: number, small: boolean): string {
  if (small) return `${count} of ${total} members favorable`;
  return `${Math.round(pct)}% favorable (${count} of ${total} members)`;
}

// One zone summary card: % favorable (labelled), the fav/neutral/unfavorable
// split as a bar + counts, and a plain agreement caption.
function ZoneOverviewCard({ z }: { z: ZoneScore }) {
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

function StatementRow({ s }: { s: PsStatementScore }) {
  const { counts } = s;
  const total = counts.total || 1;
  return (
    <div className="pt-4 pb-3 border-b border-black/5 last:border-0">
      <p className="text-sm leading-relaxed mb-2">{s.statement_text}</p>
      {/* 5-point distribution bar */}
      <div className="h-3 rounded-full overflow-hidden flex mb-1.5" style={{ backgroundColor: "#E5E7EB" }}>
        {[1, 2, 3, 4, 5].map((v) => {
          const c = s.distribution?.[String(v)] ?? 0;
          if (c === 0) return null;
          return (
            <div key={v} title={`${POINT_LABEL[v]}: ${c}`}
              style={{ width: `${(c / total) * 100}%`, backgroundColor: POINT_COLOR[v] }} />
          );
        })}
      </div>
      <p className="text-xs text-[var(--color-grey)]">
        Favorable {counts.favorable} · Neutral {counts.neutral} · Unfavorable {counts.unfavorable} · mean {s.mean_effective.toFixed(1)}/5
      </p>
    </div>
  );
}

// §4.2 — zone overview + Survey Item Breakdown dropdown + Otis's read over the ocean.
export default function PsSafetyPanel({
  tier1,
  tier2,
}: {
  tier1: Tier1Result;
  tier2: Tier2Result | null;
}) {
  const zones = [...(tier1.ps_zones ?? [])].sort((a, b) => a.zone - b.zone);
  const read = tier2?.ps_read;

  return (
    <section>
      <h2 className="text-3xl mb-2">Psychological safety</h2>
      <p className="text-sm text-[var(--color-grey)] mb-5 max-w-3xl">
        The three zones are levels of safety, shallowest first. <span className="font-medium">Favorable</span> means a member
        answered Agree or Strongly Agree; <span className="font-medium">neutral</span> is the midpoint; <span className="font-medium">unfavorable</span> means
        Disagree or Strongly Disagree. Percentages are the share of responses that were favorable.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {zones.map((z) => <ZoneOverviewCard key={z.zone} z={z} />)}
      </div>

      {/* Survey Item Breakdown */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">Survey item breakdown</p>
        <div className="space-y-2">
          {([1, 2, 3] as const).map((zoneNum) => {
            const items = (tier1.ps_statements ?? [])
              .filter((s) => s.zone === zoneNum)
              .sort((a, b) => b.counts.unfavorable - a.counts.unfavorable);
            return (
              <Accordion key={zoneNum}
                title={<><span className={ZONE_BADGE[zoneNum]}>{ZONE_SHORT[zoneNum]}</span><span>{ZONE_NAME[zoneNum]}</span></>}>
                {items.length === 0 ? (
                  <p className="text-sm text-[var(--color-grey)]">No data for this zone.</p>
                ) : (
                  items.map((s) => <StatementRow key={s.statement_id} s={s} />)
                )}
              </Accordion>
            );
          })}
        </div>
      </div>

      {/* Otis's read — over the ocean */}
      <div>
        <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">Otis&apos;s read</p>
        <div className="relative rounded-2xl overflow-hidden">
          <img src="/ps-ocean.png" alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 bg-white/55" />
          <div className="relative p-6 sm:p-8 space-y-4">
            {!read ? (
              <p className="text-sm text-[var(--color-grey)] italic">
                Otis&apos;s read appears once the interpretation has been run.
              </p>
            ) : (
              <>
                {hasText(read.overall_shape) && (
                  <p className="text-xl leading-snug" style={{ fontFamily: "Playfair Display, serif" }}>
                    {read.overall_shape}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([1, 2, 3] as const).map((n) => {
                    const text = read[`zone${n}` as "zone1" | "zone2" | "zone3"];
                    if (!hasText(text)) return null;
                    return (
                      <div key={n} className="rounded-xl bg-white/75 border border-black/5 p-4">
                        <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-1.5">
                          Zone {n} · {ZONE_SHORT[n]}
                        </p>
                        <p className="text-sm leading-relaxed">{text}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
