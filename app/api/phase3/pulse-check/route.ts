import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAcknowledgedMember } from "@/lib/requestAuth";
import type { PulseCheckKey, PulseCheckRating } from "@/types/database";

const VALID_KEYS: PulseCheckKey[] = ["zone1", "zone2", "zone3", "purpose"];
const VALID_RATINGS: PulseCheckRating[] = [
  "Not at all accurate",
  "Somewhat accurate",
  "Very accurate",
  "Don't know",
  "Decline to answer",
];

// GET /api/phase3/pulse-check?member_id=&team_id=
// Returns all pulse checks for a member on a team.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("member_id");
  const teamId = searchParams.get("team_id");
  if (!memberId || !teamId) {
    return NextResponse.json({ error: "member_id and team_id required" }, { status: 400 });
  }

  const auth = await requireAcknowledgedMember(req, { memberId, teamId });
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("phase3_pulse_checks")
    .select("*")
    .eq("member_id", memberId)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ checks: data ?? [] });
}

// POST /api/phase3/pulse-check
// Body: { member_id, team_id, read_key, accuracy_rating, comment? }
// Upserts on (member_id, team_id, read_key).
export async function POST(req: NextRequest) {
  let memberId: string;
  let teamId: string;
  let readKey: PulseCheckKey;
  let accuracyRating: PulseCheckRating;
  let comment: string | null;

  try {
    const body = await req.json();
    memberId = body.member_id;
    teamId = body.team_id;
    readKey = body.read_key;
    accuracyRating = body.accuracy_rating;
    comment = typeof body.comment === "string" ? body.comment.trim() || null : null;

    if (!memberId || !teamId || !VALID_KEYS.includes(readKey) || !VALID_RATINGS.includes(accuracyRating)) {
      return NextResponse.json(
        { error: "member_id, team_id, read_key, and accuracy_rating required" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const auth = await requireAcknowledgedMember(req, { memberId, teamId });
  if (!auth.ok) return auth.response;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("phase3_pulse_checks")
    .upsert(
      { member_id: memberId, team_id: teamId, read_key: readKey, accuracy_rating: accuracyRating, comment, updated_at: now },
      { onConflict: "member_id,team_id,read_key" }
    );

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
