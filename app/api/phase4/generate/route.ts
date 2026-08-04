import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generatePhase4Insights } from "@/lib/phase4Insights";
import type { Json, Phase3ReportJson, Phase4SelfServeJson } from "@/types/database";
import type { Tier1Result, Tier2Result, Networks } from "@/components/dashboard/types";

// POST /api/phase4/generate  { team_id }
// The consultant's "Generate insights" action (spec §5). Enabled once all
// members complete Phase 3. Runs the single-stream grouping + agreement +
// clarity + distributions and saves the draft to analysis.phase4_selfserve_json.
// Preserves any prior release state; the editable exit-interview text is reset
// to fresh Otis originals on each (re)generate.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const teamId = body?.team_id as string | undefined;
  if (!teamId) return NextResponse.json({ error: "team_id required" }, { status: 400 });

  // Gate: every member must have completed Phase 3.
  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("member_id, status")
    .eq("team_id", teamId);
  if (mErr) return NextResponse.json({ error: "db_error", detail: mErr.message }, { status: 500 });
  if (!members || members.length === 0) {
    return NextResponse.json({ error: "no_members" }, { status: 400 });
  }
  const incomplete = members.filter((m) => m.status !== "complete").length;
  if (incomplete > 0) {
    return NextResponse.json({ error: "members_incomplete", incomplete }, { status: 400 });
  }

  const { data: analysis, error: aErr } = await supabase
    .from("analysis")
    .select("tier1_json, tier2_json, phase3_report_json, phase4_selfserve_json")
    .eq("team_id", teamId)
    .maybeSingle();
  if (aErr || !analysis) {
    return NextResponse.json({ error: "Analysis not found for this team" }, { status: 404 });
  }

  // Resolve the focus item: phase3_report_json wins, then tier2 focus_hypothesis.
  const report = (analysis.phase3_report_json as Phase3ReportJson | null) ?? null;
  const tier2 = (analysis.tier2_json as unknown as Tier2Result | null) ?? null;
  const focusStatementId = report?.focus_statement_id ?? tier2?.focus_hypothesis?.statement_id ?? null;
  if (!focusStatementId) {
    return NextResponse.json({ error: "no_focus_item" }, { status: 400 });
  }

  const { data: statement } = await supabase
    .from("ps_statements")
    .select("statement_text")
    .eq("statement_id", focusStatementId)
    .maybeSingle();
  const focusText = statement?.statement_text ?? tier2?.focus_hypothesis?.statement_text ?? "";

  const tier1 = (analysis.tier1_json as unknown as Tier1Result | null) ?? null;
  const networks: Networks | null = tier1?.networks ?? null;

  let insights;
  try {
    insights = await generatePhase4Insights(teamId, focusStatementId, focusText, networks);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[phase4/generate] failed:", msg);
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }

  const prior = (analysis.phase4_selfserve_json as Phase4SelfServeJson | null) ?? null;
  const merged: Phase4SelfServeJson = {
    ...insights,
    artifacts: prior?.artifacts ?? [],
    released_at: prior?.released_at ?? null,
    sent_member_ids: prior?.sent_member_ids ?? [],
  };

  const { error: saveErr } = await supabase
    .from("analysis")
    .update({ phase4_selfserve_json: merged as unknown as Json })
    .eq("team_id", teamId);
  if (saveErr) {
    return NextResponse.json({ error: "db_error", detail: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, insights: merged });
}
