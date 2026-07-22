// Shared display helpers for the 5-point PS agreement scale. Used by the
// interview recap, ReviewStep, and AlreadyCompleteStep so the wording/symbols
// live in one place rather than being redefined per component.

import type { PsLabel, PsStatement } from "@/types/database";
import { effectiveValue, LABEL_VALUE } from "@/lib/psSelection";

// Human-readable label, as the member would phrase their choice.
export const PS_LABEL_WORD: Record<PsLabel, string> = {
  strongly_disagree: "Strongly disagree",
  disagree: "Disagree",
  neutral: "Neutral",
  agree: "Agree",
  strongly_agree: "Strongly agree",
};

// Diverging red→green markers, one per 5-point label (still available for
// views that want a distinct dot per answer).
export const PS_LABEL_SYMBOL: Record<PsLabel, string> = {
  strongly_disagree: "🔴",
  disagree: "🟠",
  neutral: "🟡",
  agree: "🟢",
  strongly_agree: "💚",
};

// The product-wide 3-color grouping: a simpler paint-job over the same real
// 5-point data. Computed from the EFFECTIVE (reverse-scored) value so the
// colour reflects safety valence, not the raw click. 1–2 red, 3 yellow,
// 4–5 green. The underlying 1–5 answer is never changed — this is display only.
export type PsColor = "red" | "yellow" | "green";

export function psColorGroup(statement: PsStatement, label: PsLabel): PsColor {
  const eff = effectiveValue(statement, LABEL_VALUE[label]);
  return eff <= 2 ? "red" : eff === 3 ? "yellow" : "green";
}

export const PS_COLOR_DOT: Record<PsColor, string> = {
  red: "🔴",
  yellow: "🟡",
  green: "🟢",
};
