"use client";

import { useState } from "react";
import CoordinationMap from "./CoordinationMap";
import { FAV_GREEN, NEU_YELLOW, type Tier1Result } from "./types";

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
              <div className="flex flex-wrap gap-5 mt-4 text-xs text-[var(--color-grey)] justify-center">
                {[
                  { color: FAV_GREEN, label: "Daily" },
                  { color: "#3B82F6", label: "Weekly" },
                  { color: "#9CA3AF", label: "Occasionally" },
                  { color: "#D1D5DB", label: "Rarely" },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3.5 h-3.5 rounded-full border border-dashed border-[#9CA3AF]" />
                  Peripheral
                </span>
                <span className="flex items-center gap-1.5"><span style={{ color: NEU_YELLOW }}>⚠</span> Asymmetric</span>
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
            Where members are based. Members without a location are shown to the side.
          </p>
          {!geo ? (
            <p className="text-sm text-[var(--color-grey)]">No location data yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {geo.location_groups.map((g) => (
                  <div key={g.location} className="card" style={{ padding: "16px 20px" }}>
                    <p className="text-sm font-medium mb-2">{g.location}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.private_codes.map((c) => (
                        <span key={c} className="bg-[var(--color-navy)] text-white text-xs px-2.5 py-0.5 rounded-full">{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {geo.location_groups.length === 0 && (
                  <p className="text-sm text-[var(--color-grey)]">No members have shared a location.</p>
                )}
              </div>

              {geo.unplaced_codes.length > 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-black/20 bg-black/[0.015] p-4">
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">No location on file</p>
                  <div className="flex flex-wrap gap-1.5">
                    {geo.unplaced_codes.map((c) => (
                      <span key={c} className="border border-dashed border-[#9CA3AF] text-[var(--color-grey)] text-xs px-2.5 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
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
