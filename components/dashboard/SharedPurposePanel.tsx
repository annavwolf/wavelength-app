"use client";

import Accordion from "./Accordion";
import { hasText, type Tier1Result, type Tier2Result } from "./types";

const CLASSIFICATION_LABEL: Record<string, string> = {
  aligned: "Aligned",
  broadly_aligned: "Broadly aligned",
  fuzzy: "Fuzzy",
  bifurcated: "Bifurcated",
  fragmented: "Fragmented",
  insufficient: "Insufficient data",
};

// §4.1 — the ~100-word purpose read + an anonymized Raw Responses dropdown that
// only shows verbatim text for members who permitted sharing.
export default function SharedPurposePanel({
  tier1,
  tier2,
}: {
  tier1: Tier1Result;
  tier2: Tier2Result | null;
}) {
  const read = tier2?.shared_purpose_read?.read;
  const classification = tier2?.shared_purpose_read?.classification ?? tier1.shared_purpose?.classification;
  const purpose = tier1.purpose ?? [];

  const MIN_N = 5;
  const canShowVerbatim =
    purpose.length >= MIN_N && purpose.every((e) => e.share_verbatim === true);

  return (
    <section>
      <h2 className="text-3xl mb-4">Shared purpose</h2>

      <div className="card" style={{ padding: "24px 28px" }}>
        {classification && (
          <span className="inline-block text-xs px-3 py-1 rounded-full bg-[var(--color-purple)]/10 text-[var(--color-purple)] mb-3">
            {CLASSIFICATION_LABEL[classification] ?? classification}
          </span>
        )}
        {hasText(read) ? (
          <p className="text-base leading-relaxed">{read}</p>
        ) : (
          <p className="text-sm text-[var(--color-grey)] italic">
            Otis&apos;s purpose read appears once the interpretation has been run.
          </p>
        )}
      </div>

      {hasText(tier2?.team_composition_summary) && (
        <div className="card mt-4" style={{ padding: "20px 24px" }}>
          <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Who&apos;s on this team</p>
          <p className="text-sm leading-relaxed">{tier2!.team_composition_summary}</p>
        </div>
      )}

      <div className="mt-4">
        <Accordion title={`Raw responses (${purpose.length})`}>
          {purpose.length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">No purpose responses recorded.</p>
          ) : !canShowVerbatim ? (
            <p className="text-sm text-[var(--color-grey)] italic">
              {purpose.length < MIN_N
                ? "Individual responses are not shown for groups fewer than 5 to protect anonymity."
                : "Individual responses are not shown — not all members opted in to sharing their exact words."}
            </p>
          ) : (
            <div className="space-y-2">
              {purpose.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <p className="text-sm leading-relaxed">{entry.purpose_text}</p>
                </div>
              ))}
            </div>
          )}
          {canShowVerbatim && (
            <p className="mt-4 text-xs text-[var(--color-grey)]">
              All members in this section consented to sharing their exact words.
            </p>
          )}
        </Accordion>
      </div>
    </section>
  );
}
