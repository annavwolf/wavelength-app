/**
 * Privacy controls used across participant screens and external AI calls.
 * These transformations target direct identifiers; they are not a claim that
 * any arbitrary free text can be made anonymous in every circumstance.
 */

// v0.4 adds the optional hosted audio provider used for enhanced read-aloud
// and voice-to-text. A version bump requires a fresh acknowledgement before
// an interview can continue with this revised data practice.
export const PRIVACY_NOTICE_VERSION = "beta-0.4";

export type VerbatimPreference = "summary_only" | "verbatim";

export const VERBATIM_PREFERENCES: readonly VerbatimPreference[] = [
  "summary_only",
  "verbatim",
];

export function isVerbatimPreference(value: unknown): value is VerbatimPreference {
  return typeof value === "string" && (VERBATIM_PREFERENCES as readonly string[]).includes(value);
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d().\-\s]{6,}\d)/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+/gi;
const HANDLE_PATTERN = /(^|\s)@[a-z0-9_]{2,}/gi;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove common direct identifiers before sending text to a third-party model. */
export function redactTextForExternalProcessing(
  value: string | null | undefined,
  knownNames: string[] = []
): string {
  if (!value) return "";
  let redacted = value
    .replace(EMAIL_PATTERN, "[email removed]")
    .replace(PHONE_PATTERN, "[phone removed]")
    .replace(URL_PATTERN, "[link removed]")
    .replace(HANDLE_PATTERN, "$1[handle removed]");

  const names = Array.from(new Set(knownNames.map((name) => name.trim()).filter((name) => name.length >= 2)))
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    redacted = redacted.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), "[name removed]");
  }
  return redacted;
}

/** Legacy normalizer retained for historical records and non-city fields. */
export function normalizeBroadLocation(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const location = value.trim().replace(/\s+/g, " ");
  if (!location || location.length > 80 || location.includes(",")) return null;
  return location;
}
