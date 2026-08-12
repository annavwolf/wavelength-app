import { NextRequest, NextResponse } from "next/server";
import { PRIVACY_NOTICE_VERSION, isVerbatimPreference } from "@/lib/privacy";
import { requireMemberSession } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await requireMemberSession(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("privacy_notice_version, acknowledged_at, verbatim_preference, preference_updated_at, voice_input_opt_in")
    .eq("member_id", auth.value.session.member_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load privacy settings." }, { status: 500 });
  return NextResponse.json({ acknowledgement: data ?? null });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireMemberSession(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const preference = body?.verbatim_preference;
  const voiceInputOptIn = body?.voice_input_opt_in;
  if (!isVerbatimPreference(preference) && typeof voiceInputOptIn !== "boolean") {
    return NextResponse.json({ error: "No valid privacy setting was provided." }, { status: 400 });
  }

  const memberId = auth.value.session.member_id;
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("member_id, privacy_notice_version, verbatim_preference, voice_input_opt_in")
    .eq("member_id", memberId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Unable to load privacy settings." }, { status: 500 });
  if (!existing || existing.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return NextResponse.json({ error: "Please acknowledge the current privacy notice first." }, { status: 409 });
  }

  const nextPreference = isVerbatimPreference(preference) ? preference : existing.verbatim_preference;
  const nextVoiceInput = typeof voiceInputOptIn === "boolean" ? voiceInputOptIn : existing.voice_input_opt_in;
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .update({
      verbatim_preference: nextPreference,
      preference_updated_at: now,
      voice_input_opt_in: nextVoiceInput,
      voice_input_opted_in_at: nextVoiceInput ? now : null,
    })
    .eq("member_id", memberId);
  if (updateError) return NextResponse.json({ error: "Unable to save privacy settings." }, { status: 500 });

  const { error: memberUpdateError } = await supabaseAdmin
    .from("members")
    .update({
      share_verbatim_with_team: nextPreference === "verbatim",
      share_name_with_team: false,
      phase3_story_verbatim: nextPreference === "verbatim",
      phase3_behavior_verbatim: nextPreference === "verbatim",
    })
    .eq("member_id", memberId);
  if (memberUpdateError) return NextResponse.json({ error: "Unable to save privacy settings." }, { status: 500 });

  return NextResponse.json({
    acknowledgement: {
      verbatim_preference: nextPreference,
      preference_updated_at: now,
      voice_input_opt_in: nextVoiceInput,
    },
  });
}
