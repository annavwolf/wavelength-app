import { NextRequest, NextResponse } from "next/server";
import { resolveCityLocation } from "@/lib/cities";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { isPhase1ResumeStep } from "@/lib/interviewProgress";
import { supabaseAdmin } from "@/lib/supabase";
import type { MemberUpdate } from "@/types/database";

function publicMember(member: Record<string, unknown>, displayName: string, fallbackName = "Participant") {
  return { ...member, display_name: displayName.trim() || fallbackName, email: null };
}

// The capability URL can load only its own participant's interview state. The
// response excludes email addresses and all other participants' response data.
export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 });

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Unable to load interview." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Participant not found." }, { status: 404 });

  const [identityRes, teamRes, rosterRes, identitiesRes, statementsRes, psResponsesRes, purposeRes, coordinationRes, privacyRes] = await Promise.all([
    supabaseAdmin.from("member_identity").select("display_name").eq("member_id", memberId).maybeSingle(),
    supabaseAdmin.from("teams").select("*").eq("team_id", member.team_id).maybeSingle(),
    supabaseAdmin.from("members").select("*").eq("team_id", member.team_id).order("created_at", { ascending: true }),
    supabaseAdmin.from("member_identity").select("member_id, display_name").eq("team_id", member.team_id),
    supabaseAdmin.from("ps_statements").select("*").order("statement_id", { ascending: true }),
    supabaseAdmin.from("ps_responses").select("statement_id, label").eq("member_id", memberId).eq("round", 1),
    supabaseAdmin.from("purpose_responses").select("purpose_text").eq("member_id", memberId),
    supabaseAdmin.from("coordination_ratings").select("id").eq("member_id", memberId),
    supabaseAdmin.from("member_privacy_acknowledgements").select("privacy_notice_version, acknowledged_at, verbatim_preference, voice_input_opt_in").eq("member_id", memberId).maybeSingle(),
  ]);

  const namesById = new Map((identitiesRes.data ?? []).map((identity) => [identity.member_id, identity.display_name]));
  const storedDisplayName = identityRes.data?.display_name?.trim() ?? "";
  const displayName = storedDisplayName || "Participant";
  const currentPrivacy = privacyRes.data?.privacy_notice_version === PRIVACY_NOTICE_VERSION
    ? privacyRes.data
    : null;
  return NextResponse.json({
    member: publicMember(member as unknown as Record<string, unknown>, displayName),
    team: teamRes.data ?? null,
    all_members: (rosterRes.data ?? []).map((row, index) => publicMember(row as unknown as Record<string, unknown>, namesById.get(row.member_id) ?? "", `Team member ${index + 1}`)),
    ps_statements: statementsRes.data ?? [],
    ps_responses: psResponsesRes.data ?? [],
    purpose_count: purposeRes.data?.length ?? 0,
    purpose_text: purposeRes.data?.[0]?.purpose_text ?? "",
    coordination_count: coordinationRes.data?.length ?? 0,
    privacy: currentPrivacy,
    // A checkpoint survives browser closes/reloads. Treat unexpected database
    // values as absent rather than ever routing around the privacy gate.
    resume_step: isPhase1ResumeStep(member.phase1_resume_step) ? member.phase1_resume_step : null,
    resume_return_to_review: Boolean(member.phase1_return_to_review),
    profile_needs: {
      name: !storedDisplayName,
      // A broad self-described location is useful even where no city lookup is
      // possible. Never re-prompt just because a time zone could not be
      // derived, and never ask a participant to type a time-zone string.
      location: !member.location,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = body?.member_id;
  const fields = body?.fields;
  if (!memberId || !fields || typeof fields !== "object") {
    return NextResponse.json({ error: "member_id and fields are required" }, { status: 400 });
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("member_id, team_id, status")
    .eq("member_id", memberId)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Unable to update interview." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Participant not found." }, { status: 404 });

  // A capability link must not be enough to bypass the mandatory beta notice.
  const { data: privacy } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("acknowledged_at, privacy_notice_version")
    .eq("member_id", memberId)
    .maybeSingle();
  if (!privacy?.acknowledged_at || privacy.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return NextResponse.json({ error: "Please acknowledge the current privacy information before continuing." }, { status: 409 });
  }

  const allowed = ["role", "own_role", "ps_importance", "team_name_suggestion", "primary_language", "personal_context"] as const;
  const memberFields: MemberUpdate = {};
  for (const key of allowed) {
    if (key in fields) {
      const value = fields[key];
      memberFields[key] = typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : null;
    }
  }
  if ("phase1_resume_step" in fields) {
    if (!isPhase1ResumeStep(fields.phase1_resume_step)) {
      return NextResponse.json({ error: "That assessment checkpoint is not valid." }, { status: 400 });
    }
    memberFields.phase1_resume_step = fields.phase1_resume_step;
  }
  if ("phase1_return_to_review" in fields) {
    if (typeof fields.phase1_return_to_review !== "boolean") {
      return NextResponse.json({ error: "That assessment checkpoint is not valid." }, { status: 400 });
    }
    memberFields.phase1_return_to_review = fields.phase1_return_to_review;
  }
  if ("location" in fields) {
    const requestedLocation = typeof fields.location === "string" ? fields.location.trim() : "";
    if (!requestedLocation) {
      memberFields.location = null;
      memberFields.timezone = null;
    } else {
      const location = resolveCityLocation(requestedLocation);
      // Suggestions are optional. Preserve a broad self-described location
      // when no lookup is available; only derive a time zone when recognised.
      memberFields.location = location?.location ?? requestedLocation.slice(0, 200);
      memberFields.timezone = location?.timezone ?? null;
    }
  }

  if (Object.keys(memberFields).length) {
    const { error } = await supabaseAdmin.from("members").update(memberFields).eq("member_id", memberId);
    if (error) return NextResponse.json({ error: "Unable to save your details." }, { status: 500 });
  }

  let displayName: string | undefined;
  if (typeof fields.display_name === "string" && fields.display_name.trim()) {
    displayName = fields.display_name.trim().slice(0, 120);
    const { data: prior } = await supabaseAdmin.from("member_identity").select("display_name").eq("member_id", memberId).maybeSingle();
    const { error } = await supabaseAdmin.from("member_identity").update({ display_name: displayName }).eq("member_id", memberId);
    if (error) return NextResponse.json({ error: "Unable to save your name." }, { status: 500 });
    if (prior?.display_name && prior.display_name !== displayName) {
      await supabaseAdmin
        .from("coordination_ratings")
        .update({ target_member_name: displayName })
        .eq("team_id", member.team_id)
        .eq("target_member_name", prior.display_name);
    }
  }

  return NextResponse.json({ ok: true, fields: { ...memberFields, ...(displayName ? { display_name: displayName } : {}) } });
}
