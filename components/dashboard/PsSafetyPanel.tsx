"use client";

import Accordion from "./Accordion";
import ZoneStatCard from "./ZoneStatCard";
import {
  FAV_GREEN, NEU_YELLOW, UNFAV_RED, ZONE_NAME, ZONE_SHORT, ZONE_BADGE,
  hasText, type PsStatementScore, type Tier1Result, type Tier2Result,
} from "./types";

// 5-point colour scale for the per-statement distribution (strongly disagree → strongly agree).
const POINT_COLOR: Record<number, string> = {
  1: UNFAV_RED, 2: "#D98A6B", 3: NEU_YELLOW, 4: "#4F9C82", 5: FAV_GREEN,
};
const POINT_LABEL: Record<number, string> = {
  1: "Strongly disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly agree",
};

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
        The three zones are levels of safety, shallowest first. Each zone score is <span className="font-medium">member-based</span> —
        it counts how many of the team lean <span className="font-medium">favorable</span> (their answers across that zone average to
        Agree/Strongly Agree), <span className="font-medium">neutral</span>, or <span className="font-medium">unfavorable</span>
        (Disagree/Strongly Disagree). The survey-item breakdown below shows the individual responses behind each zone.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        {zones.map((z) => <ZoneStatCard key={z.zone} z={z} />)}
      </div>

      {/* Participation / confidence note — sits right under the zone numbers so the
          reader weighs them in context (moved here from the top of the tab). */}
      {hasText(tier2?.data_quality_note) && (
        <p className="text-sm text-[var(--color-grey)] bg-black/[0.02] border border-black/10 rounded-xl px-5 py-3 mb-8 max-w-3xl leading-relaxed">
          {tier2!.data_quality_note}
        </p>
      )}

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
