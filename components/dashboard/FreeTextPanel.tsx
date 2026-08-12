"use client";

import Accordion from "./Accordion";
import type { FreeTextEntry } from "./types";

const MIN_N = 5;

export default function FreeTextPanel({
  title,
  blurb,
  entries,
}: {
  title: string;
  blurb: string;
  entries: FreeTextEntry[];
}) {
  if (!entries || entries.length === 0) return null;

  const canShowVerbatim =
    entries.length >= MIN_N && entries.every((e) => e.share_verbatim === true);

  const suppressionReason =
    entries.length < MIN_N
      ? "Individual responses are not shown for groups fewer than 5 to protect anonymity."
      : "Individual responses are not shown — not all members opted in to sharing their exact words.";

  return (
    <div>
      <Accordion title={`${title} (${entries.length})`}>
        <p className="text-xs text-[var(--color-grey)] mb-3">{blurb}</p>
        {!canShowVerbatim ? (
          <p className="text-sm text-[var(--color-grey)] italic">{suppressionReason}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <p key={i} className="text-sm leading-relaxed">{entry.text}</p>
            ))}
          </div>
        )}
      </Accordion>
    </div>
  );
}
