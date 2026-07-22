// Deterministic item-selection logic for the ps_interview step.
// Canonical source: Otis_Phase1_Canonical_Flow_v1.md §3 (Tier 1, not LLM).
//
// Pure function over already-collected diagnostic data — fully reproducible,
// no side effects. Reused by both PsInterviewStep (to pick items) and the
// resume ladder in the interview page (to decide when the interview is done),
// so selection is defined in exactly one place.

import type { PsLabel, PsStatement } from "@/types/database";

// The literal 1–5 value of a click. Mirrors LABEL_VALUE in PsDiagnosticStep;
// kept here so selection doesn't depend on a UI component.
export const LABEL_VALUE: Record<PsLabel, number> = {
  strongly_disagree: 1,
  disagree: 2,
  neutral: 3,
  agree: 4,
  strongly_agree: 5,
};

// THE SINGLE REVERSE-SCORE FLIP POINT (§2.1). Everything downstream that needs
// an "effective" score must go through this — raw response_value is never
// flipped on write. For a reverse-scored item, a low raw score means a
// positive experience, so we flip it to 6 - value.
export function effectiveValue(statement: PsStatement, responseValue: number): number {
  return statement.reverse_scored ? 6 - responseValue : responseValue;
}

export type ProbeSelection = {
  // True when every item scored above Neutral once flipped — routes to the
  // Section 5 all-positive branch instead of a negative-score probe.
  allPositive: boolean;
  // The 1 or 2 items to probe, already in probe order. Empty when allPositive.
  items: SelectedItem[];
};

export type SelectedItem = {
  statement: PsStatement;
  label: PsLabel; // the member's literal (unflipped) response label
  effectiveValue: number;
};

/**
 * Select the items to probe, per §3.
 *
 * 1. Compute effective_value for each rated item (reverse-score flip applied).
 * 2. eligible = items with effective_value <= 3 (Neutral or below).
 * 3. If none eligible → all-positive branch.
 * 4. Sort eligible by zone asc (primary), effective_value asc (secondary,
 *    most negative first), statement_id asc (tiebreaker).
 * 5. Take the top 2 (or 1 if only one is eligible).
 *
 * `ratings` maps statement_id → the member's PsLabel. Statements without a
 * rating are ignored (defensive; in practice all 12 are rated before this runs).
 */
export function selectProbeItems(
  statements: PsStatement[],
  ratings: Record<number, PsLabel>
): ProbeSelection {
  const eligible: SelectedItem[] = [];

  for (const statement of statements) {
    const label = ratings[statement.statement_id];
    if (!label) continue;
    const ev = effectiveValue(statement, LABEL_VALUE[label]);
    if (ev <= 3) {
      eligible.push({ statement, label, effectiveValue: ev });
    }
  }

  if (eligible.length === 0) {
    return { allPositive: true, items: [] };
  }

  eligible.sort((a, b) => {
    if (a.statement.zone !== b.statement.zone) return a.statement.zone - b.statement.zone;
    if (a.effectiveValue !== b.effectiveValue) return a.effectiveValue - b.effectiveValue;
    return a.statement.statement_id - b.statement.statement_id;
  });

  return { allPositive: false, items: eligible.slice(0, 2) };
}
