"use client";

import Accordion from "./Accordion";
import type { FreeTextEntry } from "./types";

// Consultant-only raw display of a member free-text field (own_role,
// ps_importance). Mirrors the SharedPurposePanel "Raw responses" accordion:
// private-code badges, no interpretation, no member-facing exposure. There is
// no analytics on these — they are here so the consultant can read the team's
// own words alongside the metrics.
export default function FreeTextPanel({
  title,
  blurb,
  entries,
}: {
  title: string;
  blurb: string;
  entries: FreeTextEntry[];
}) {
  // Older analyses (pre-migration-0016) won't carry these arrays; render nothing
  // rather than an empty shell.
  if (!entries || entries.length === 0) return null;

  return (
    <div>
      <Accordion title={`${title} (${entries.length})`}>
        <p className="text-xs text-[var(--color-grey)] mb-3">{blurb}</p>
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="bg-[var(--color-navy)] text-white text-xs px-3 py-1 rounded-full flex-shrink-0 mt-0.5">
                {entry.private_code}
              </span>
              <p className="text-sm leading-relaxed">{entry.text}</p>
            </div>
          ))}
        </div>
      </Accordion>
    </div>
  );
}
