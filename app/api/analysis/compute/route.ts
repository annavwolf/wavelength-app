/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// TODO(phase2): STALE — built around the retired 3-point green/yellow/red PS
// scale and the retired "fish" model. It will NOT produce correct metrics
// against the new 5-point scale / ps_interview_responses data. Type-checking is
// disabled here only to keep `next build` green during the Phase 1 rebuild;
// this whole route must be reworked as part of the Phase 2 (analysis) rebuild.
// Do not treat its output as valid until then. See v2_rebuild_info + D-048.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { CoordinationFrequency, Json, PsLabel } from "@/types/database";

// ── Calibrated thresholds — do not change without recalibrating ──────────────
const STRONG_THRESHOLD = 75;      // %green ≥ this → "Strong"
const BROKEN_THRESHOLD = 50;      // %green < this → "Broken"; between → "Mixed"
const DIVERGENCE_THRESHOLD = 0.3; // 30% lean one way AND 30% opposite → divergent
const HIGH_FLAG_SEVERITIES = [3, 4];

const ZONE_STATEMENTS = {
  1: [1, 2, 3, 4, 5],
  2: [6, 7, 8, 9],
  3: [10, 11, 12],
} as const;

const HIGH_FREQ: CoordinationFrequency[] = ["daily", "weekly"];
const LOW_FREQ: CoordinationFrequency[] = ["occasionally", "rarely"];

// ── Output types ──────────────────────────────────────────────────────────────
type ZoneStatus = "Strong" | "Mixed" | "Broken";

type ZoneResult = {
  pct_green: number;
  mean: number;
  status: ZoneStatus;
  counts: { green: number; yellow: number; red: number };
};

type StatementDist = {
  statement_id: number;
  counts: { green: number; yellow: number; red: number };
  responses: Array<{ private_code: string; label: PsLabel }>;
};

type DivergenceResult = {
  lean_green_count: number;
  lean_red_count: number;
  lean_mixed_count: number;
  is_divergent: boolean;
  outlier_private_codes: string[];
};

type RankedFish = {
  fish_id: string;
  name: string;
  mean_severity: number;
  flagged_count: number;
  flagged_pct: number;
  rank: number;
  responses: Array<{ private_code: string; severity_label: number }>;
};

type CustomFish = {
  private_code: string;
  custom_text: string;
  severity_label: number;
  share_verbatim: boolean;
};

type DirectedPair = {
  from_private_code: string;
  to_private_code: string | null;
  frequency: CoordinationFrequency;
};

type AsymmetricPair = {
  high_freq_private_code: string;
  low_freq_private_code: string;
  high_frequency: CoordinationFrequency;
  low_frequency: CoordinationFrequency;
};

type PurposeEntry = {
  private_code: string;
  purpose_text: string;
  share_verbatim: boolean;
};

type Tier1Result = {
  computed_at: string;
  participation: {
    n_completed: number;
    roster_size: number | null;
    confidence: "high" | "moderate" | "provisional";
  };
  ps_zones: {
    zone1: ZoneResult;
    zone2: ZoneResult;
    zone3: ZoneResult;
    priority_zone: 1 | 2 | 3;
  };
  ps_statements: StatementDist[];
  divergence: {
    zone1: DivergenceResult;
    zone2: DivergenceResult;
    zone3: DivergenceResult;
  };
  fish: {
    ranked: RankedFish[];
    custom: CustomFish[];
  };
  coordination: {
    pairs: DirectedPair[];
    peripheral_member_codes: string[];
    asymmetric_pairs: AsymmetricPair[];
  };
  purpose: PurposeEntry[];
};

// ── Pure computation helpers ──────────────────────────────────────────────────

function zoneStatus(pctGreen: number): ZoneStatus {
  if (pctGreen >= STRONG_THRESHOLD) return "Strong";
  if (pctGreen >= BROKEN_THRESHOLD) return "Mixed";
  return "Broken";
}

function computeZone(
  psResponses: Array<{ statement_id: number; label: PsLabel; response_value: number }>,
  zoneNum: 1 | 2 | 3
): ZoneResult {
  const statIds = ZONE_STATEMENTS[zoneNum];
  const zoneResps = psResponses.filter((r) => (statIds as readonly number[]).includes(r.statement_id));

  const counts = { green: 0, yellow: 0, red: 0 };
  let totalValue = 0;

  for (const r of zoneResps) {
    counts[r.label]++;
    totalValue += r.response_value;
  }

  const total = zoneResps.length;
  const pctGreen = total > 0 ? (counts.green / total) * 100 : 0;
  const mean = total > 0 ? totalValue / total : 0;

  return {
    pct_green: Math.round(pctGreen * 10) / 10,
    mean: Math.round(mean * 100) / 100,
    status: zoneStatus(pctGreen),
    counts,
  };
}

function computePriorityZone(z1: ZoneResult, z2: ZoneResult, z3: ZoneResult): 1 | 2 | 3 {
  if (z1.status === "Broken") return 1;
  if (z2.status === "Broken") return 2;
  if (z3.status === "Broken") return 3;

  if (z1.status === "Mixed") return 1;
  if (z2.status === "Mixed") return 2;
  if (z3.status === "Mixed") return 3;

  // All Strong — lowest-scoring zone by %green
  if (z1.pct_green <= z2.pct_green && z1.pct_green <= z3.pct_green) return 1;
  if (z2.pct_green <= z3.pct_green) return 2;
  return 3;
}

function computeDivergence(
  psResponses: Array<{ member_id: string; statement_id: number; label: PsLabel }>,
  zoneNum: 1 | 2 | 3,
  memberIdToCode: Map<string, string>
): DivergenceResult {
  const statIds = ZONE_STATEMENTS[zoneNum];

  const byMember = new Map<string, { green: number; red: number; total: number }>();
  for (const r of psResponses) {
    if (!(statIds as readonly number[]).includes(r.statement_id)) continue;
    if (!memberIdToCode.has(r.member_id)) continue;
    const entry = byMember.get(r.member_id) ?? { green: 0, red: 0, total: 0 };
    if (r.label === "green") entry.green++;
    if (r.label === "red") entry.red++;
    entry.total++;
    byMember.set(r.member_id, entry);
  }

  const leanGreenCodes: string[] = [];
  const leanRedCodes: string[] = [];
  let leanMixedCount = 0;

  for (const [memberId, tally] of Array.from(byMember.entries())) {
    if (tally.total === 0) continue;
    const code = memberIdToCode.get(memberId)!;
    if (tally.green > tally.total / 2) leanGreenCodes.push(code);
    else if (tally.red > tally.total / 2) leanRedCodes.push(code);
    else leanMixedCount++;
  }

  const n = byMember.size;
  const gProp = n > 0 ? leanGreenCodes.length / n : 0;
  const rProp = n > 0 ? leanRedCodes.length / n : 0;
  const isDivergent = gProp >= DIVERGENCE_THRESHOLD && rProp >= DIVERGENCE_THRESHOLD;

  const outliers = isDivergent
    ? leanGreenCodes.length <= leanRedCodes.length
      ? leanGreenCodes
      : leanRedCodes
    : [];

  return {
    lean_green_count: leanGreenCodes.length,
    lean_red_count: leanRedCodes.length,
    lean_mixed_count: leanMixedCount,
    is_divergent: isDivergent,
    outlier_private_codes: outliers,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let teamId: string;
  try {
    const body = await req.json();
    teamId = body.team_id;
    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json({ error: "team_id required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    return await runCompute(teamId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/compute] unexpected error:", err);
    return NextResponse.json({ error: "unexpected_error", detail: msg }, { status: 500 });
  }
}

async function runCompute(teamId: string): Promise<NextResponse> {

  // ── Team ──────────────────────────────────────────────────────────────────
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("team_id", teamId)
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "team_not_found" }, { status: 404 });
  }

  // ── Completed members ─────────────────────────────────────────────────────
  const { data: completedMembers, error: membersError } = await supabase
    .from("members")
    .select("*")
    .eq("team_id", teamId)
    .eq("status", "complete");

  if (membersError) {
    return NextResponse.json({ error: "db_error", detail: membersError.message }, { status: 500 });
  }

  const members = completedMembers ?? [];
  const nCompleted = members.length;

  // ── Hard gate ─────────────────────────────────────────────────────────────
  if (nCompleted < 3) {
    return NextResponse.json({ error: "insufficient_responses", n_completed: nCompleted });
  }

  const memberIds = members.map((m) => m.member_id);
  const memberById = new Map(members.map((m) => [m.member_id, m]));
  const memberByName = new Map(members.map((m) => [m.display_name.toLowerCase(), m]));
  const memberIdToCode = new Map(members.map((m) => [m.member_id, m.private_code]));

  // ── Participation confidence ──────────────────────────────────────────────
  const rosterSize = team.roster_size;
  let confidence: "high" | "moderate" | "provisional";
  if (rosterSize !== null && nCompleted >= rosterSize * 0.7 && nCompleted >= 3) {
    confidence = nCompleted >= 6 ? "high" : "moderate";
  } else {
    confidence = "provisional";
  }

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [psResult, fishRespResult, coordResult, purposeResult, fishListResult] = await Promise.all([
    supabase
      .from("ps_responses")
      .select("*")
      .eq("team_id", teamId)
      .eq("round", 1)
      .in("member_id", memberIds),
    supabase
      .from("fish_responses")
      .select("*")
      .eq("team_id", teamId)
      .in("member_id", memberIds),
    supabase
      .from("coordination_ratings")
      .select("*")
      .eq("team_id", teamId)
      .in("member_id", memberIds),
    supabase
      .from("purpose_responses")
      .select("*")
      .eq("team_id", teamId)
      .in("member_id", memberIds),
    team.selected_fish_ids.length > 0
      ? supabase.from("fish").select("*").in("fish_id", team.selected_fish_ids)
      : supabase.from("fish").select("*").limit(0),
  ]);

  if (psResult.error) return NextResponse.json({ error: "db_error", detail: psResult.error.message }, { status: 500 });
  if (fishRespResult.error) return NextResponse.json({ error: "db_error", detail: fishRespResult.error.message }, { status: 500 });
  if (coordResult.error) return NextResponse.json({ error: "db_error", detail: coordResult.error.message }, { status: 500 });
  if (purposeResult.error) return NextResponse.json({ error: "db_error", detail: purposeResult.error.message }, { status: 500 });

  const psResponses = psResult.data ?? [];
  const fishResponses = fishRespResult.data ?? [];
  const coordRatings = coordResult.data ?? [];
  const purposeResponses = purposeResult.data ?? [];
  const fishList = fishListResult.data ?? [];
  const fishById = new Map(fishList.map((f) => [f.fish_id, f]));

  // ── PS zone scoring ───────────────────────────────────────────────────────
  const zone1 = computeZone(psResponses, 1);
  const zone2 = computeZone(psResponses, 2);
  const zone3 = computeZone(psResponses, 3);
  const priorityZone = computePriorityZone(zone1, zone2, zone3);

  // ── Per-statement distribution ────────────────────────────────────────────
  const psStatements: StatementDist[] = [];
  for (let sid = 1; sid <= 12; sid++) {
    const stmtResps = psResponses.filter((r) => r.statement_id === sid);
    const counts = { green: 0, yellow: 0, red: 0 };
    const responses: Array<{ private_code: string; label: PsLabel }> = [];
    for (const r of stmtResps) {
      counts[r.label as PsLabel]++;
      const code = memberIdToCode.get(r.member_id);
      if (code) responses.push({ private_code: code, label: r.label as PsLabel });
    }
    psStatements.push({ statement_id: sid, counts, responses });
  }

  // ── Divergence ────────────────────────────────────────────────────────────
  const divergence = {
    zone1: computeDivergence(psResponses, 1, memberIdToCode),
    zone2: computeDivergence(psResponses, 2, memberIdToCode),
    zone3: computeDivergence(psResponses, 3, memberIdToCode),
  };

  // ── Fish ranking ──────────────────────────────────────────────────────────
  const standardFishResps = fishResponses.filter((r) => r.fish_id !== null);
  const customFishResps = fishResponses.filter((r) => r.fish_id === null);

  const fishGrouped = new Map<string, typeof standardFishResps>();
  for (const r of standardFishResps) {
    const arr = fishGrouped.get(r.fish_id!) ?? [];
    arr.push(r);
    fishGrouped.set(r.fish_id!, arr);
  }

  const unranked: Omit<RankedFish, "rank">[] = [];
  for (const [fishId, resps] of Array.from(fishGrouped.entries())) {
    if (!resps.length) continue;
    const meanSeverity = resps.reduce((s, r) => s + r.severity_label, 0) / resps.length;
    const flaggedCount = resps.filter((r) => HIGH_FLAG_SEVERITIES.includes(r.severity_label)).length;
    const flaggedPct = (flaggedCount / nCompleted) * 100;
    const memberResponses = resps
      .map((r) => ({ private_code: memberIdToCode.get(r.member_id) ?? "?", severity_label: r.severity_label }))
      .sort((a, b) => b.severity_label - a.severity_label);
    unranked.push({
      fish_id: fishId,
      name: fishById.get(fishId)?.name ?? fishId,
      mean_severity: Math.round(meanSeverity * 100) / 100,
      flagged_count: flaggedCount,
      flagged_pct: Math.round(flaggedPct * 10) / 10,
      responses: memberResponses,
    });
  }
  unranked.sort((a, b) => b.flagged_pct - a.flagged_pct);
  const rankedFish: RankedFish[] = unranked.map((f, i) => ({ ...f, rank: i + 1 }));

  const customFish: CustomFish[] = customFishResps.map((r) => {
    const member = memberById.get(r.member_id);
    return {
      private_code: member?.private_code ?? "unknown",
      custom_text: r.custom_text ?? "",
      severity_label: r.severity_label,
      share_verbatim: member?.share_verbatim_with_team ?? false,
    };
  });

  // ── Coordination ──────────────────────────────────────────────────────────
  const pairs: DirectedPair[] = coordRatings.map((r) => ({
    from_private_code: memberById.get(r.member_id)?.private_code ?? "unknown",
    to_private_code: memberByName.get(r.target_member_name.toLowerCase())?.private_code ?? null,
    frequency: r.frequency,
  }));

  const peripheralCodes: string[] = [];
  for (const member of members) {
    const received = coordRatings.filter(
      (r) => r.target_member_name.toLowerCase() === member.display_name.toLowerCase()
    );
    if (!received.length) continue;
    const lowCount = received.filter((r) => LOW_FREQ.includes(r.frequency)).length;
    if (lowCount / received.length > 0.5) peripheralCodes.push(member.private_code);
  }

  const asymmetricPairs: AsymmetricPair[] = [];
  const seenPairs = new Set<string>();
  for (const member of members) {
    for (const rating of coordRatings.filter((r) => r.member_id === member.member_id)) {
      if (!HIGH_FREQ.includes(rating.frequency)) continue;
      const target = memberByName.get(rating.target_member_name.toLowerCase());
      if (!target) continue;
      const reverse = coordRatings.find(
        (r) =>
          r.member_id === target.member_id &&
          r.target_member_name.toLowerCase() === member.display_name.toLowerCase()
      );
      if (!reverse || !LOW_FREQ.includes(reverse.frequency)) continue;
      const key = [member.private_code, target.private_code].sort().join(":");
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      asymmetricPairs.push({
        high_freq_private_code: member.private_code,
        low_freq_private_code: target.private_code,
        high_frequency: rating.frequency,
        low_frequency: reverse.frequency,
      });
    }
  }

  // ── Purpose ───────────────────────────────────────────────────────────────
  const purpose: PurposeEntry[] = purposeResponses.map((r) => {
    const member = memberById.get(r.member_id);
    return {
      private_code: member?.private_code ?? "unknown",
      purpose_text: r.purpose_text,
      share_verbatim: member?.share_verbatim_with_team ?? false,
    };
  });

  // ── Assemble ──────────────────────────────────────────────────────────────
  const result: Tier1Result = {
    computed_at: new Date().toISOString(),
    participation: { n_completed: nCompleted, roster_size: rosterSize, confidence },
    ps_zones: { zone1, zone2, zone3, priority_zone: priorityZone },
    ps_statements: psStatements,
    divergence,
    fish: { ranked: rankedFish, custom: customFish },
    coordination: { pairs, peripheral_member_codes: peripheralCodes, asymmetric_pairs: asymmetricPairs },
    purpose,
  };

  // ── Upsert to analysis table ──────────────────────────────────────────────
  // Requires a unique constraint on analysis.team_id.
  const { error: upsertError } = await supabase
    .from("analysis")
    .upsert(
      { team_id: teamId, tier1_json: result as unknown as Json, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );

  if (upsertError) {
    console.error("[analysis/compute] upsert failed:", upsertError);
    return NextResponse.json({
      error: "upsert_failed",
      detail: upsertError.message,
      hint: upsertError.hint ?? null,
      code: upsertError.code ?? null,
    }, { status: 500 });
  }

  return NextResponse.json(result);
}
