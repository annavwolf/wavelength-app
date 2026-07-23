import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { effectiveValue } from "@/lib/psSelection";
import { codeTeamInterviews } from "@/lib/coding";
import { clusterTeamLabels, type ClusterResult } from "@/lib/clustering";
import { embedTexts, cosineSim } from "@/lib/embeddings";
import type {
  CoordinationFrequency,
  Json,
  PsLabel,
  PsResponse,
  PsStatement,
  Member,
  Zone,
} from "@/types/database";

// Phase 2 compute (Analytics Spec Stage 1). Deterministic Tier 1 aggregation
// over the 5-point PS scale + interview data — no generative reasoning except the
// coding/cluster-naming sub-steps. Re-anchored off the retired fish/3-point path.
// Output → analysis.tier1_json.

const HIGH_FREQ: CoordinationFrequency[] = ["daily", "weekly"];
const LOW_FREQ: CoordinationFrequency[] = ["occasionally", "rarely"];

// Purpose-alignment thresholds (env-overridable). Purpose statements are longer
// than behaviour labels; tune separately from the behaviour cluster threshold.
const PURPOSE_CLUSTER_THRESHOLD = Number(process.env.OTIS_PURPOSE_THRESHOLD ?? 0.6);
const PURPOSE_ALIGNED = 0.7;
const PURPOSE_BROADLY = 0.55;

type Band = "red" | "yellow" | "green";

function bandFromMean(mean: number): Band {
  if (mean >= 3.5) return "green";
  if (mean >= 2.5) return "yellow";
  return "red";
}

// Population standard deviation — the within-zone agreement statistic (§6B: SD,
// lower = more agreement). Tracked regardless of the "high variability" copy.
function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

// ── Route ────────────────────────────────────────────────────────────────────
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/compute] unexpected error:", err);
    return NextResponse.json({ error: "unexpected_error", detail: msg }, { status: 500 });
  }
}

async function runCompute(teamId: string): Promise<NextResponse> {
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("team_id", teamId)
    .single();
  if (teamError || !team) return NextResponse.json({ error: "team_not_found" }, { status: 404 });

  const { data: completedMembers, error: membersError } = await supabase
    .from("members")
    .select("*")
    .eq("team_id", teamId)
    .eq("status", "complete");
  if (membersError) {
    return NextResponse.json({ error: "db_error", detail: membersError.message }, { status: 500 });
  }

  const members: Member[] = completedMembers ?? [];
  const nCompleted = members.length;
  // Hard gate (unchanged): < 3 completed members → insufficient.
  if (nCompleted < 3) {
    return NextResponse.json({ error: "insufficient_responses", n_completed: nCompleted });
  }

  const memberIds = members.map((m) => m.member_id);
  const memberById = new Map(members.map((m) => [m.member_id, m]));
  const memberByName = new Map(members.map((m) => [m.display_name.toLowerCase(), m]));
  const codeOf = (id: string) => memberById.get(id)?.private_code ?? "unknown";

  // Participation confidence (unchanged).
  const rosterSize = team.roster_size;
  let confidence: "high" | "moderate" | "provisional";
  if (rosterSize !== null && nCompleted >= rosterSize * 0.7 && nCompleted >= 3) {
    confidence = nCompleted >= 6 ? "high" : "moderate";
  } else {
    confidence = "provisional";
  }

  // ── Data fetch (fish dropped; ps_statements added for zones + reverse flag) ──
  const [psResult, coordResult, purposeResult, statementsResult] = await Promise.all([
    supabase.from("ps_responses").select("*").eq("team_id", teamId).eq("round", 1).in("member_id", memberIds),
    supabase.from("coordination_ratings").select("*").eq("team_id", teamId).in("member_id", memberIds),
    supabase.from("purpose_responses").select("*").eq("team_id", teamId).in("member_id", memberIds),
    supabase.from("ps_statements").select("*").order("statement_id", { ascending: true }),
  ]);
  for (const r of [psResult, coordResult, purposeResult, statementsResult]) {
    if (r.error) return NextResponse.json({ error: "db_error", detail: r.error.message }, { status: 500 });
  }
  const psResponses: PsResponse[] = psResult.data ?? [];
  const coordRatings = coordResult.data ?? [];
  const purposeResponses = purposeResult.data ?? [];
  const statements: PsStatement[] = statementsResult.data ?? [];
  const statementById = new Map(statements.map((s) => [s.statement_id, s]));

  // ── Coding + clustering (Coding Spec + Analytics §2.4) ──────────────────────
  // Coding re-derives interview_labels; clustering groups them by member
  // convergence and preserves the exploded source labels.
  const codingSummary = await codeTeamInterviews(teamId);
  const clusters: ClusterResult = await clusterTeamLabels(teamId);

  // ── PS zone scoring — 5-point favorability, zones READ FROM ps_statements ────
  const zonesPresent = Array.from(new Set(statements.map((s) => s.zone))).sort() as Zone[];
  const zoneScores = zonesPresent.map((zone) => {
    const zoneStatementIds = new Set(
      statements.filter((s) => s.zone === zone).map((s) => s.statement_id)
    );
    const effs: number[] = [];
    let favorable = 0,
      neutral = 0,
      unfavorable = 0;
    for (const r of psResponses) {
      if (!zoneStatementIds.has(r.statement_id)) continue;
      const stmt = statementById.get(r.statement_id);
      if (!stmt) continue;
      const eff = effectiveValue(stmt, r.response_value);
      effs.push(eff);
      if (eff >= 4) favorable++;
      else if (eff === 3) neutral++;
      else unfavorable++;
    }
    const total = effs.length;
    const mean = total ? effs.reduce((s, v) => s + v, 0) / total : 0;
    return {
      zone,
      zone_name: statements.find((s) => s.zone === zone)?.zone_name ?? `Zone ${zone}`,
      pct_favorable: total ? round((favorable / total) * 100, 1) : 0,
      counts: { favorable, neutral, unfavorable, total },
      mean_effective: round(mean),
      agreement_sd: round(stdev(effs)),
      band: bandFromMean(mean),
    };
  });

  // ── Per-statement distribution (5-point, on effective value) ────────────────
  const statementScores = statements.map((stmt) => {
    const resps = psResponses.filter((r) => r.statement_id === stmt.statement_id);
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const per_member: Array<{ private_code: string; effective_value: number; label: PsLabel }> = [];
    let favorable = 0,
      neutral = 0,
      unfavorable = 0;
    const effs: number[] = [];
    for (const r of resps) {
      const eff = effectiveValue(stmt, r.response_value);
      distribution[eff] = (distribution[eff] ?? 0) + 1;
      effs.push(eff);
      if (eff >= 4) favorable++;
      else if (eff === 3) neutral++;
      else unfavorable++;
      per_member.push({ private_code: codeOf(r.member_id), effective_value: eff, label: r.label });
    }
    const total = effs.length;
    return {
      statement_id: stmt.statement_id,
      zone: stmt.zone,
      statement_text: stmt.statement_text,
      reverse_scored: stmt.reverse_scored,
      distribution,
      counts: { favorable, neutral, unfavorable, total },
      mean_effective: total ? round(effs.reduce((s, v) => s + v, 0) / total) : 0,
      per_member,
    };
  });

  // ── Shared-purpose alignment (§2.5) — embed + classify (read is in interpret) ─
  const purposeTexts = purposeResponses.map((p) => p.purpose_text?.trim()).filter(Boolean) as string[];
  const purposeOwners = purposeResponses
    .filter((p) => p.purpose_text?.trim())
    .map((p) => codeOf(p.member_id));
  let sharedPurpose: {
    classification: string;
    mean_pairwise_similarity: number | null;
    n_statements: number;
    clusters: Array<{ size: number; private_codes: string[] }>;
  };
  if (purposeTexts.length < 2) {
    sharedPurpose = {
      classification: "insufficient",
      mean_pairwise_similarity: null,
      n_statements: purposeTexts.length,
      clusters: [],
    };
  } else {
    const vecs = await embedTexts(purposeTexts);
    // mean pairwise cosine (cohesion)
    let sum = 0,
      pairs = 0;
    for (let i = 0; i < vecs.length; i++)
      for (let j = i + 1; j < vecs.length; j++) {
        sum += cosineSim(vecs[i], vecs[j]);
        pairs++;
      }
    const meanSim = pairs ? sum / pairs : 0;
    // union-find clusters at the purpose threshold (to detect clumps)
    const n = vecs.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (cosineSim(vecs[i], vecs[j]) >= PURPOSE_CLUSTER_THRESHOLD) {
          const a = find(i),
            b = find(j);
          if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
        }
    const groups = new Map<number, string[]>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(purposeOwners[i]);
    }
    const clusterList = Array.from(groups.values())
      .map((codes) => ({ size: codes.length, private_codes: codes }))
      .sort((a, b) => b.size - a.size);

    let classification: string;
    const topShare = clusterList[0].size / n;
    if (clusterList.length === 1 && meanSim >= PURPOSE_ALIGNED) classification = "aligned";
    else if (clusterList.length === 1 && meanSim >= PURPOSE_BROADLY) classification = "broadly_aligned";
    else if (clusterList.length === 2 && clusterList[1].size / n >= 0.35) classification = "bifurcated";
    else if (topShare >= PURPOSE_BROADLY) classification = "broadly_aligned";
    else classification = "fragmented";

    sharedPurpose = {
      classification,
      mean_pairwise_similarity: round(meanSim, 3),
      n_statements: n,
      clusters: clusterList,
    };
  }

  // ── Networks ────────────────────────────────────────────────────────────────
  // Coordination (kept): directed pairs, peripheral members, asymmetric pairs.
  const coordPairs = coordRatings.map((r) => ({
    from_private_code: codeOf(r.member_id),
    to_private_code: memberByName.get(r.target_member_name.toLowerCase())?.private_code ?? null,
    frequency: r.frequency,
  }));
  const peripheralCodes: string[] = [];
  for (const m of members) {
    const received = coordRatings.filter(
      (r) => r.target_member_name.toLowerCase() === m.display_name.toLowerCase()
    );
    if (!received.length) continue;
    const low = received.filter((r) => LOW_FREQ.includes(r.frequency)).length;
    if (low / received.length > 0.5) peripheralCodes.push(m.private_code);
  }
  const asymmetricPairs: Array<{
    high_freq_private_code: string;
    low_freq_private_code: string;
    high_frequency: CoordinationFrequency;
    low_frequency: CoordinationFrequency;
  }> = [];
  const seen = new Set<string>();
  for (const m of members) {
    for (const rating of coordRatings.filter((r) => r.member_id === m.member_id)) {
      if (!HIGH_FREQ.includes(rating.frequency)) continue;
      const target = memberByName.get(rating.target_member_name.toLowerCase());
      if (!target) continue;
      const reverse = coordRatings.find(
        (r) =>
          r.member_id === target.member_id &&
          r.target_member_name.toLowerCase() === m.display_name.toLowerCase()
      );
      if (!reverse || !LOW_FREQ.includes(reverse.frequency)) continue;
      const key = [m.private_code, target.private_code].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      asymmetricPairs.push({
        high_freq_private_code: m.private_code,
        low_freq_private_code: target.private_code,
        high_frequency: rating.frequency,
        low_frequency: reverse.frequency,
      });
    }
  }

  // Geographic (new): nodes from location/timezone; missing location → unplaced.
  const geoNodes = members.map((m) => ({
    private_code: m.private_code,
    location: m.location,
    timezone: m.timezone,
    has_location: !!(m.location && m.location.trim()),
  }));
  const unplacedCodes = geoNodes.filter((g) => !g.has_location).map((g) => g.private_code);
  const locationGroups = Array.from(
    geoNodes
      .filter((g) => g.has_location)
      .reduce((map, g) => {
        const loc = g.location!.trim();
        map.set(loc, [...(map.get(loc) ?? []), g.private_code]);
        return map;
      }, new Map<string, string[]>())
      .entries()
  ).map(([location, private_codes]) => ({ location, private_codes }));
  const distinctTimezones = new Set(
    members.map((m) => m.timezone?.trim()).filter(Boolean)
  ).size;

  // ── Purpose passthrough (with share flag for the raw-responses dropdown) ─────
  const purpose = purposeResponses.map((r) => ({
    private_code: codeOf(r.member_id),
    purpose_text: r.purpose_text,
    share_verbatim: memberById.get(r.member_id)?.share_verbatim_with_team ?? false,
  }));

  // ── Assemble new tier1_json (no fish) ───────────────────────────────────────
  const result = {
    computed_at: new Date().toISOString(),
    participation: { n_completed: nCompleted, roster_size: rosterSize, confidence },
    coding: codingSummary,
    ps_zones: zoneScores,
    ps_statements: statementScores,
    clusters,
    shared_purpose: sharedPurpose,
    networks: {
      coordination: {
        pairs: coordPairs,
        peripheral_member_codes: peripheralCodes,
        asymmetric_pairs: asymmetricPairs,
      },
      geographic: {
        nodes: geoNodes,
        location_groups: locationGroups,
        distinct_timezones: distinctTimezones,
        unplaced_codes: unplacedCodes,
      },
    },
    purpose,
  };

  const { error: upsertError } = await supabase
    .from("analysis")
    .upsert(
      { team_id: teamId, tier1_json: result as unknown as Json, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );
  if (upsertError) {
    console.error("[analysis/compute] upsert failed:", upsertError);
    return NextResponse.json(
      { error: "upsert_failed", detail: upsertError.message, code: upsertError.code ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
