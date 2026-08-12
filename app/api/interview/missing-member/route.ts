import { NextRequest, NextResponse } from "next/server";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

// Avoid collecting a non-participant's name. A respondent can flag the missing
// *role or relationship* without creating a new third-party identity record.
export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("missing_member_flags")
    .select("missing_role")
    .eq("reported_by_member_id", memberId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load note." }, { status: 500 });
  return NextResponse.json({ missing_role: data?.missing_role ?? null });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = body?.member_id;
  const relationship = typeof body?.relationship === "string" ? body.relationship.trim().slice(0, 240) : "";
  if (!memberId || !relationship) return NextResponse.json({ error: "A role or relationship is required." }, { status: 400 });

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("team_id")
    .eq("member_id", memberId)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Unable to save note." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Participant not found." }, { status: 404 });

  const { data: acknowledgement, error: acknowledgementError } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("acknowledged_at, privacy_notice_version")
    .eq("member_id", memberId)
    .maybeSingle();
  if (acknowledgementError) return NextResponse.json({ error: "Unable to verify privacy acknowledgement." }, { status: 500 });
  if (!acknowledgement?.acknowledged_at || acknowledgement.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return NextResponse.json({ error: "Please acknowledge the current privacy information before continuing." }, { status: 409 });
  }

  await supabaseAdmin.from("missing_member_flags").delete().eq("reported_by_member_id", memberId);
  const { error } = await supabaseAdmin.from("missing_member_flags").insert({
    team_id: member.team_id,
    reported_by_member_id: memberId,
    missing_name: "A core team member",
    missing_role: relationship,
  });
  if (error) return NextResponse.json({ error: "Unable to save note." }, { status: 500 });
  return NextResponse.json({ ok: true, missing_role: relationship });
}
