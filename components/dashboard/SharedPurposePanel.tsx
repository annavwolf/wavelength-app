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

      <div className="mt-4">
        <Accordion title={`Raw responses (${purpose.length})`}>
          {purpose.length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">No purpose responses recorded.</p>
          ) : (
            <div className="space-y-2">
              {purpose.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="bg-[var(--color-navy)] text-white text-xs px-3 py-1 rounded-full flex-shrink-0 mt-0.5">
                    {entry.private_code}
                  </span>
                  {entry.share_verbatim ? (
                    <p className="text-sm leading-relaxed">{entry.purpose_text}</p>
                  ) : (
                    <p className="text-sm text-[var(--color-grey)] italic">
                      This member preferred to keep their words private.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--color-grey)]">
            Members who kept their words private still inform the alignment read — their responses are never quoted.
          </p>
        </Accordion>
      </div>
    </section>
  );
}
