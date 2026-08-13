import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

// Analysis is stored as JSON so it can outlive a change to the privacy notice.
// These fields make each derived artifact explicitly traceable to the exact
// current-consent Tier 1 computation that produced it.  Missing fields are
// deliberately treated as stale: that is how pre-provenance records fail safe.
export type AnalysisPrivacyProvenance = {
  privacy_notice_version: string;
  source_tier1_computed_at: string;
};

export const RECOMPUTE_REQUIRED_MESSAGE =
  "This analysis was prepared before the current privacy acknowledgement. Run Tier 1 analysis again before continuing.";

export const REINTERPRET_REQUIRED_MESSAGE =
  "Run Otis's read again after recomputing Tier 1 analysis before continuing.";

export const REPORT_REBUILD_REQUIRED_MESSAGE =
  "This report was prepared from an earlier analysis. Run Otis's read and save a new draft before releasing it.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Returns provenance only for a Tier 1 result calculated under the current notice. */
export function currentTier1Provenance(value: unknown): AnalysisPrivacyProvenance | null {
  if (!isRecord(value) || value.privacy_notice_version !== PRIVACY_NOTICE_VERSION) return null;
  if (!nonEmptyString(value.computed_at)) return null;
  return {
    privacy_notice_version: PRIVACY_NOTICE_VERSION,
    source_tier1_computed_at: value.computed_at,
  };
}

/** True only when a dependent JSON artifact was built from this exact Tier 1 run. */
export function artifactMatchesTier1(
  value: unknown,
  provenance: AnalysisPrivacyProvenance | null
): boolean {
  if (!provenance || !isRecord(value)) return false;
  return (
    value.privacy_notice_version === provenance.privacy_notice_version &&
    value.source_tier1_computed_at === provenance.source_tier1_computed_at
  );
}

/** Adds the current-consent provenance server-side, never trusting a client marker. */
export function withTier1Provenance<T extends Record<string, unknown>>(
  value: T,
  provenance: AnalysisPrivacyProvenance
): T & AnalysisPrivacyProvenance {
  return {
    ...value,
    privacy_notice_version: provenance.privacy_notice_version,
    source_tier1_computed_at: provenance.source_tier1_computed_at,
  };
}
