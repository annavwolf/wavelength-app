"use client";

import { useState } from "react";
import CoordinationMap, { FREQ_COLOR, FREQ_WIDTH } from "./CoordinationMap";
import GeographicMap from "./GeographicMap";
import { NEU_YELLOW, type Tier1Result } from "./types";

// §4.3 — two user-toggleable networks. Minimal plain-English facts only; no
// density interpretation in v1 (spec §2.6).
export default function TeamConnectivityPanel({
  tier1,
  codes,
}: {
  tier1: Tier1Result;
  codes: string[];
}) {
  const [view, setView] = useState<"coordination" | "geographic">("coordination");
  const coord = tier1.networks?.coordination;
  const geo = tier1.networks?.geographic;

  return (
    <section>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h2 className="text-3xl">How the team connects</h2>
        <div className="inline-flex rounded-full border border-black/10 p-0.5 text-sm">
          {(["coordination", "geographic"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full capitalize transition-colors ${
                view === v ? "bg-[var(--color-navy)] text-white" : "text-[var(--color-grey)] hover:text-[var(--color-ink)]"
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "coordination" ? (
        <div>
          <p className="text-sm text-[var(--color-grey)] mb-6">
            Lines show coordination frequency. Dashed circles are peripheral members. Amber marks asymmetric pairs.
          </p>
          {!coord || coord.pairs.length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">No coordination data yet.</p>
          ) : (
            <>
              <CoordinationMap
                pairs={coord.pairs}
                codes={codes}
                peripheralCodes={coord.peripheral_member_codes}
                asymmetricPairs={coord.asymmetric_pairs}
              />
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs text-[var(--color-grey)] justify-center items-center">
                {(["daily", "weekly", "occasionally", "rarely"] as const).map((freq) => (
                  <span key={freq} className="flex items-center gap-1.5 capitalize">
                    <span className="inline-block w-7 rounded" style={{ backgroundColor: FREQ_COLOR[freq], height: `${FREQ_WIDTH[freq]}px` }} />
                    {freq}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3.5 h-3.5 rounded-full border border-dashed border-[#9CA3AF]" />
                  Peripheral
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="26" height="8" aria-hidden><line x1="0" y1="4" x2="26" y2="4" stroke="#999999" strokeWidth="1.75" strokeDasharray="5 4" /></svg>
                  <span style={{ color: NEU_YELLOW }}>⚠</span> Asymmetric
                </span>
              </div>
              <div className="mt-6 max-w-2xl mx-auto space-y-1.5 text-sm text-[var(--color-grey)]">
                {coord.peripheral_member_codes.length > 0 && (
                  <p>
                    Peripheral (mostly low-frequency incoming):{" "}
                    {coord.peripheral_member_codes.map((c) => (
                      <span key={c} className="bg-[var(--color-navy)] text-white text-xs px-2 py-0.5 rounded-full mr-1">{c}</span>
                    ))}
                  </p>
                )}
                {coord.asymmetric_pairs.map((ap, i) => (
                  <p key={i}>
                    <span className="font-medium text-[var(--color-ink)]">{ap.high_freq_private_code}</span> and{" "}
                    <span className="font-medium text-[var(--color-ink)]">{ap.low_freq_private_code}</span> report working together at
                    very different frequencies ({ap.high_frequency} vs {ap.low_frequency}).
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="text-sm text-[var(--color-grey)] mb-6">
            Where members are based. Members in the same location are clustered and linked; clusters placed next to each
            other share a time zone. Proximity is approximate. Members without a location are shown below.
          </p>
          {!geo ? (
            <p className="text-sm text-[var(--color-grey)]">No location data yet.</p>
          ) : (
            <>
              {geo.location_groups.length === 0 ? (
                <p className="text-sm text-[var(--color-grey)]">No members have shared a location.</p>
              ) : (
                <GeographicMap geo={geo} />
              )}

              {geo.unplaced_codes.length > 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-black/20 bg-black/[0.015] p-4">
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-1">No location on file</p>
                  <p className="text-sm text-[var(--color-grey)]">
                    {geo.unplaced_codes.length} member{geo.unplaced_codes.length !== 1 ? "s have" : " has"} no location on file.
                  </p>
                </div>
              )}

              <p className="mt-6 text-sm text-[var(--color-grey)]">
                {geo.location_groups.length} location{geo.location_groups.length !== 1 ? "s" : ""} across the team; members are in{" "}
                {geo.distinct_timezones} distinct time zone{geo.distinct_timezones !== 1 ? "s" : ""}.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
