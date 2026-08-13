// Shared types + constants for the re-anchored consultant dashboard (Phase 2).
// These mirror the shapes produced by the compute route (tier1_json, increment 3)
// and the interpret route (tier2_json, increment 4). Fish is fully retired.

export type Band = "red" | "yellow" | "green";

export type ZoneCounts = { favorable: number; neutral: number; unfavorable: number; total: number };

export type ZoneScore = {
  zone: 1 | 2 | 3;
  zone_name: string;
  pct_favorable: number;
  counts: ZoneCounts;
  mean_effective: number;
  agreement_sd: number;
  band: Band;
};

export type PsStatementScore = {
  statement_id: number;
  zone: 1 | 2 | 3;
  statement_text: string;
  reverse_scored?: boolean;
  distribution: Record<string, number>; // keys "1".."5" → count at each effective value
  counts: ZoneCounts;
  mean_effective: number;
  per_member: Array<{ private_code: string; effective_value: number; label: string }>;
};

export type SharedPurpose = {
  classification: "aligned" | "broadly_aligned" | "fuzzy" | "bifurcated" | "fragmented" | "insufficient";
  mean_pairwise_similarity: number | null;
  n_statements: number;
  clusters: Array<{ size: number; private_codes: string[] }>;
};

export type CoordinationPair = {
  from_private_code: string;
  to_private_code: string | null;
  frequency: "daily" | "weekly" | "occasionally" | "rarely";
};

export type AsymmetricPair = {
  high_freq_private_code: string;
  low_freq_private_code: string;
  high_frequency: string;
  low_frequency: string;
};

export type GeoNode = {
  private_code: string;
  location: string | null;
  timezone: string | null;
  has_location: boolean;
};

export type Networks = {
  coordination: {
    pairs: CoordinationPair[];
    peripheral_member_codes: string[];
    asymmetric_pairs: AsymmetricPair[];
  };
  geographic: {
    nodes: GeoNode[];
    location_groups: Array<{ location: string; private_codes: string[] }>;
    distinct_timezones: number;
    unplaced_codes: string[];
  };
};

export type PurposeEntry = { private_code: string; purpose_text: string; share_verbatim: boolean };
export type FreeTextEntry = { private_code: string; text: string; share_verbatim?: boolean };

export type Tier1Result = {
  computed_at: string;
  // Present on computations made after the privacy-provenance gate. Optional
  // for old database JSON, which the server treats as stale.
  privacy_notice_version?: string;
  participation: {
    n_completed: number;
    roster_size: number | null;
    confidence: "high" | "moderate" | "provisional";
  };
  ps_zones: ZoneScore[];
  ps_statements: PsStatementScore[];
  shared_purpose: SharedPurpose;
  networks: Networks;
  purpose: PurposeEntry[];
  // Raw free-text passthrough (consultant-only; absent on analyses computed
  // before migration 0016).
  own_roles?: FreeTextEntry[];
  ps_importance?: FreeTextEntry[];
};

// ── Tier 2 (interpret) ────────────────────────────────────────────────────────

export type Tier2Result = {
  generated_at?: string;
  // Tier 2 is only reusable when it was generated from this exact current-
  // consent Tier 1 computation.
  privacy_notice_version?: string;
  source_tier1_computed_at?: string;
  ps_read?: { overall_shape?: string; zone1?: string; zone2?: string; zone3?: string };
  shared_purpose_read?: { classification?: string; read?: string };
  focus_hypothesis?: { statement_id?: number; statement_text?: string; zone?: number; hypothesis?: string };
  // Ranked focus picks (top 2-3), best first. focus_hypothesis mirrors the top one.
  focus_candidates?: { statement_id?: number; statement_text?: string; zone?: number; why?: string }[];
  member_facing_summary?: string;
  team_composition_summary?: string;
  data_quality_note?: string;
  messy_or_insufficient_flag?: boolean;
  welfare_or_sensitive_note?: string;
};

// ── Shared display constants ───────────────────────────────────────────────────

export const ZONE_NAME = ["", "Safe to Belong", "Safe to Speak Freely", "Safe to Innovate"];
export const ZONE_SHORT = ["", "Belonging", "Speaking up", "Learning"];
export const ZONE_BADGE = ["", "badge-zone1", "badge-zone2", "badge-zone3"];

export const FAV_GREEN = "#2D7A4F";
export const NEU_YELLOW = "#C4860A";
export const UNFAV_RED = "#B94040";
export const BAND_COLOR: Record<Band, string> = { green: FAV_GREEN, yellow: NEU_YELLOW, red: UNFAV_RED };

// True when a model-returned string carries real content (not empty, not "none").
export function hasText(s?: string | null): s is string {
  return !!s && s.trim() !== "" && s.trim().toLowerCase() !== "none";
}

// Small-team display rule (zone-read guide): under 5 members lean on counts.
export function isSmallN(total: number): boolean {
  return total > 0 && total < 5;
}
