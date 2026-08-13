import { NextRequest, NextResponse } from "next/server";
import { requireInterviewAccess } from "@/lib/interviewAccess";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

async function acknowledgedParticipant(request: NextRequest, memberId: string | null) {
  if (!memberId) {
    return { ok: false as const, response: NextResponse.json({ error: "member_id is required" }, { status: 400 }) };
  }
  const access = await requireInterviewAccess(request, { memberId });
  if (!access.ok) return access;
  const [{ data: member, error: memberError }, { data: acknowledgement, error: privacyError }] = await Promise.all([
    supabaseAdmin.from("members").select("member_id, team_id, status").eq("member_id", access.value.memberId).maybeSingle(),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("acknowledged_at, privacy_notice_version")
      .eq("member_id", access.value.memberId)
      .maybeSingle(),
  ]);
  if (memberError || privacyError) {
    return { ok: false as const, response: NextResponse.json({ error: "Unable to verify the interview session." }, { status: 500 }) };
  }
  if (!member) return { ok: false as const, response: NextResponse.json({ error: "Participant not found." }, { status: 404 }) };
  if (member.status === "opted_out") {
    return { ok: false as const, response: NextResponse.json({ error: "This participant has withdrawn." }, { status: 410 }) };
  }
  if (!acknowledgement?.acknowledged_at || acknowledgement.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Please acknowledge the current privacy information before continuing." }, { status: 409 }),
    };
  }
  return { ok: true as const, member };
}

// This beta screen is currently not linked from Phase 1, but its retained API
// remains fully capability-protected so a future reintroduction cannot reopen
// a UUID-only access path.
export async function GET(request: NextRequest) {
  const auth = await acknowledgedParticipant(request, request.nextUrl.searchParams.get("member_id"));
  if (!auth.ok) return auth.response;
  const { data, error } = await supabaseAdmin
    .from("missing_member_flags")
    .select("missing_role")
    .eq("reported_by_member_id", auth.member.member_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load note." }, { status: 500 });
  return NextResponse.json({ missing_role: data?.missing_role ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = typeof body?.member_id === "string" ? body.member_id : null;
  const relationship = typeof body?.relationship === "string" ? body.relationship.trim().slice(0, 240) : "";
  if (!relationship) return NextResponse.json({ error: "A role or relationship is required." }, { status: 400 });

  const auth = await acknowledgedParticipant(request, memberId);
  if (!auth.ok) return auth.response;

  const deletion = await supabaseAdmin
    .from("missing_member_flags")
    .delete()
    .eq("reported_by_member_id", auth.member.member_id);
  if (deletion.error) return NextResponse.json({ error: "Unable to save note." }, { status: 500 });
  const { error } = await supabaseAdmin.from("missing_member_flags").insert({
    team_id: auth.member.team_id,
    reported_by_member_id: auth.member.member_id,
    missing_name: "A core team member",
    missing_role: relationship,
  });
  if (error) return NextResponse.json({ error: "Unable to save note." }, { status: 500 });
  return NextResponse.json({ ok: true, missing_role: relationship }, { headers: { "Cache-Control": "no-store" } });
}
