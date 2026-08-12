import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Phase3ContextResponseInsert } from "@/types/database";

// Phase 3 context questions (post-rework):
//   phase "context"    → frequency only (§ Team Stories). The impact answer is a
//                        turn-based chat handled by /api/phase3/conversation
//                        (kind="impact"), which saves impact_text itself.
//   phase "commitment" → commitment + commitment_result + synchronicity
//                        (§ Team Agreement / commitment pages).
// Storage: one row per member/team in phase3_context_responses (upsert).

// GET /api/phase3/context?member_id=&team_id=  → existing row (resume).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("member_id");
  const teamId = searchParams.get("team_id");
  if (!memberId || !teamId) return NextResponse.json({ error: "member_id and team_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("phase3_context_responses")
    .select("*")
    .eq("member_id", memberId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ context: data ?? null });
}

// POST /api/phase3/context
// Body: { member_id, team_id, phase: "context"|"commitment", ...fields }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const memberId = body.member_id as string;
  const teamId = body.team_id as string;
  const phase = body.phase as string;
  if (!memberId || !teamId || !["context", "commitment"].includes(phase)) {
    return NextResponse.json({ error: "member_id, team_id, phase required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Phase3ContextResponseInsert = { member_id: memberId, team_id: teamId, updated_at: now };

  if (phase === "context") {
    update.frequency = (body.frequency as Phase3ContextResponseInsert["frequency"]) ?? null;
    // impact_text may still be passed (e.g. an edit from the review screen).
    if (typeof body.impact_text === "string") {
      update.impact_text = body.impact_text.trim() || null;
    }
  } else {
    // Only include each field when the body explicitly provides it.
    // If a field is absent from the request, leave it untouched in the DB.
    // (Without this guard, CommitAsk wipes synchronicity and SyncStep wipes commitment.)
    if (body.commitment !== undefined)
      update.commitment = (body.commitment as Phase3ContextResponseInsert["commitment"]) ?? null;
    if (body.commitment_result !== undefined)
      update.commitment_result =
        typeof body.commitment_result === "string" ? body.commitment_result.trim() || null : null;
    if (body.synchronicity !== undefined)
      update.synchronicity = (body.synchronicity as Phase3ContextResponseInsert["synchronicity"]) ?? null;
  }

  const { error } = await supabase
    .from("phase3_context_responses")
    .upsert(update, { onConflict: "member_id,team_id" });
  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
