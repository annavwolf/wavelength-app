import { NextRequest, NextResponse } from "next/server";
import { PRIVACY_NOTICE_VERSION, isVerbatimPreference } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

// The emailed interview URL is a participant capability link. This endpoint is
// deliberately narrow: it can only read/write that link's acknowledgement and
// cannot reveal a roster, responses, email address, or consultant data.
export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("privacy_notice_version, acknowledged_at, verbatim_preference, preference_updated_at, voice_input_opt_in")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load privacy status." }, { status: 500 });

  return NextResponse.json({
    acknowledged: data?.privacy_notice_version === PRIVACY_NOTICE_VERSION,
    acknowledgement: data?.privacy_notice_version === PRIVACY_NOTICE_VERSION ? data : null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { member_id: memberId, acknowledgement, verbatim_preference: preference, voice_input_opt_in: voiceInputOptIn } = body ?? {};

  if (!memberId || acknowledgement !== true || !isVerbatimPreference(preference) || typeof voiceInputOptIn !== "boolean") {
    return NextResponse.json(
      { error: "A privacy acknowledgement, an exact-word choice, and a voice-input choice are required." },
      { status: 400 }
    );
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("member_id, team_id, status")
    .eq("member_id", memberId)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Unable to verify participant." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  if (member.status === "opted_out") {
    return NextResponse.json({ error: "This participant has withdrawn from the beta." }, { status: 410 });
  }

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("acknowledged_at, privacy_notice_version")
    .eq("member_id", memberId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Unable to save acknowledgement." }, { status: 500 });

  const acknowledgementRecord = {
    member_id: memberId,
    team_id: member.team_id,
    privacy_notice_version: PRIVACY_NOTICE_VERSION,
    acknowledged_at: existing?.privacy_notice_version === PRIVACY_NOTICE_VERSION
      ? existing.acknowledged_at
      : now,
    verbatim_preference: preference,
    preference_updated_at: now,
    voice_input_opt_in: voiceInputOptIn,
    voice_input_opted_in_at: voiceInputOptIn ? now : null,
  };
  const { error: acknowledgementError } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .upsert(acknowledgementRecord, { onConflict: "member_id" });
  if (acknowledgementError) {
    return NextResponse.json({ error: "Unable to save acknowledgement." }, { status: 500 });
  }

  // The legacy flags remain in sync while Phase 3/4 code is migrated. They
  // never permit name sharing, and are false until this explicit choice exists.
  const { error: memberUpdateError } = await supabaseAdmin
    .from("members")
    .update({
      share_verbatim_with_team: preference === "verbatim",
      share_name_with_team: false,
      phase3_story_verbatim: preference === "verbatim",
      phase3_behavior_verbatim: preference === "verbatim",
      ...(member.status === "pending" || member.status === "invited" ? { status: "in_progress" } : {}),
    })
    .eq("member_id", memberId);
  if (memberUpdateError) {
    return NextResponse.json({ error: "Acknowledged, but unable to start the interview." }, { status: 500 });
  }

  return NextResponse.json({
    acknowledged: true,
    acknowledgement: acknowledgementRecord,
  });
}
