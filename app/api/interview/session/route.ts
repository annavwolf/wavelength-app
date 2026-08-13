import { NextRequest, NextResponse } from "next/server";
import { resolveCityLocation } from "@/lib/cities";
import {
  requireInterviewAccess,
  setInterviewAccessCookie,
  type PublicRosterMember,
} from "@/lib/interviewAccess";
import { isPhase1ResumeStep } from "@/lib/interviewProgress";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";
import type { MemberUpdate } from "@/types/database";

type SelfInterviewMember = {
  member_id: string;
  team_id: string;
  display_name: string;
  role: string | null;
  location: string | null;
  timezone: string | null;
  primary_language: string | null;
  personal_context: string | null;
  own_role: string | null;
  ps_importance: string | null;
  team_name_suggestion: string | null;
  status: string;
  phase1_resume_step: string | null;
  phase1_return_to_review: boolean;
};

function selfMember(
  member: Omit<SelfInterviewMember, "display_name">,
  displayName: string
): SelfInterviewMember {
  return {
    ...member,
    display_name: displayName.trim() || "Participant",
  };
}

// Secure invite tokens are accepted only at /i/[token], which creates the
// HttpOnly 24-hour interview cookie before redirecting here. Every Phase 1 API
// request is then authorized by that cookie or a matching member-login session;
// a UUID by itself is never an authorization credential.
export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 });

  const auth = await requireInterviewAccess(request, { memberId });
  if (!auth.ok) return auth.response;

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select(
      "member_id, team_id, role, location, timezone, primary_language, personal_context, own_role, ps_importance, team_name_suggestion, status, phase1_resume_step, phase1_return_to_review"
    )
    .eq("member_id", auth.value.memberId)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Unable to load interview." }, { status: 500 });
  if (!member || member.status === "opted_out") {
    return NextResponse.json({ error: "This assessment link is no longer available." }, { status: 410 });
  }

  const [identityRes, teamRes, rosterRes, identitiesRes, statementsRes, psResponsesRes, purposeRes, coordinationRes, privacyRes] = await Promise.all([
    supabaseAdmin.from("member_identity").select("display_name").eq("member_id", member.member_id).maybeSingle(),
    supabaseAdmin.from("teams").select("team_id, team_name").eq("team_id", member.team_id).maybeSingle(),
    supabaseAdmin
      .from("members")
      .select("member_id, private_code")
      .eq("team_id", member.team_id)
      .neq("status", "opted_out")
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("member_identity").select("member_id, display_name").eq("team_id", member.team_id),
    supabaseAdmin.from("ps_statements").select("*").order("statement_id", { ascending: true }),
    supabaseAdmin.from("ps_responses").select("statement_id, label").eq("member_id", member.member_id).eq("round", 1),
    supabaseAdmin.from("purpose_responses").select("purpose_text").eq("member_id", member.member_id),
    supabaseAdmin.from("coordination_ratings").select("id").eq("member_id", member.member_id),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("privacy_notice_version, acknowledged_at, verbatim_preference, voice_input_opt_in")
      .eq("member_id", member.member_id)
      .maybeSingle(),
  ]);
  if (
    identityRes.error || teamRes.error || rosterRes.error || identitiesRes.error ||
    statementsRes.error || psResponsesRes.error || purposeRes.error ||
    coordinationRes.error || privacyRes.error
  ) {
    return NextResponse.json({ error: "Unable to load interview." }, { status: 500 });
  }
  if (!teamRes.data) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const namesById = new Map((identitiesRes.data ?? []).map((identity) => [identity.member_id, identity.display_name]));
  const storedDisplayName = identityRes.data?.display_name?.trim() ?? "";
  const currentPrivacy = privacyRes.data?.privacy_notice_version === PRIVACY_NOTICE_VERSION
    ? privacyRes.data
    : null;
  const roster: PublicRosterMember[] = (rosterRes.data ?? []).map((row, index) => ({
    roster_key: row.private_code,
    display_name: namesById.get(row.member_id)?.trim() || `Team member ${index + 1}`,
    is_self: row.member_id === member.member_id,
  }));

  const response = NextResponse.json({
    member: selfMember(member, storedDisplayName),
    // A participant only needs the public team name; do not expose the
    // consultant ID, sensitivities, or other team configuration here.
    team: { team_id: teamRes.data.team_id, team_name: teamRes.data.team_name },
    // Deliberately DTO-only: no teammate UUIDs, roles, statuses, locations,
    // time zones, or other member-row data travel to the browser.
    all_members: roster,
    ps_statements: statementsRes.data ?? [],
    ps_responses: psResponsesRes.data ?? [],
    purpose_count: purposeRes.data?.length ?? 0,
    purpose_text: purposeRes.data?.[0]?.purpose_text ?? "",
    coordination_count: coordinationRes.data?.length ?? 0,
    privacy: currentPrivacy,
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
  // An invite redemption already created the scoped cookie. A fully signed-in
  // member does not need a second, less-protected capability cookie merely to
  // view their own interview, so never mint one from the member-login path.
  return auth.value.source === "invite"
    ? setInterviewAccessCookie(response, auth.value)
    : response;
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = body?.member_id;
  const fields = body?.fields;
  if (!memberId || !fields || typeof fields !== "object") {
    return NextResponse.json({ error: "member_id and fields are required" }, { status: 400 });
  }

  const auth = await requireInterviewAccess(request, { memberId });
  if (!auth.ok) return auth.response;

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("member_id, team_id, status")
    .eq("member_id", auth.value.memberId)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Unable to update interview." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  if (member.status === "opted_out") return NextResponse.json({ error: "This participant has withdrawn." }, { status: 410 });

  // A capability link must not be enough to bypass the mandatory beta notice.
  const { data: privacy, error: privacyError } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("acknowledged_at, privacy_notice_version")
    .eq("member_id", auth.value.memberId)
    .maybeSingle();
  if (privacyError) return NextResponse.json({ error: "Unable to verify privacy acknowledgement." }, { status: 500 });
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
      memberFields.location = location?.location ?? requestedLocation.slice(0, 200);
      memberFields.timezone = location?.timezone ?? null;
    }
  }

  if (Object.keys(memberFields).length) {
    const { error } = await supabaseAdmin.from("members").update(memberFields).eq("member_id", auth.value.memberId);
    if (error) return NextResponse.json({ error: "Unable to save your details." }, { status: 500 });
  }

  let displayName: string | undefined;
  if (typeof fields.display_name === "string" && fields.display_name.trim()) {
    displayName = fields.display_name.trim().slice(0, 120);
    const { data: prior, error: priorError } = await supabaseAdmin
      .from("member_identity")
      .select("display_name")
      .eq("member_id", auth.value.memberId)
      .maybeSingle();
    if (priorError) return NextResponse.json({ error: "Unable to save your name." }, { status: 500 });
    const { error } = await supabaseAdmin
      .from("member_identity")
      .update({ display_name: displayName })
      .eq("member_id", auth.value.memberId);
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

// navigator.sendBeacon always sends POST. Keep this endpoint deliberately
// narrower than PATCH: it is only the last-chance resume checkpoint written
// when a participant closes a tab or chooses "Exit to my profile".
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = typeof body?.member_id === "string" ? body.member_id : null;
  const fields = body?.fields;
  if (!memberId || !fields || typeof fields !== "object") {
    return NextResponse.json({ error: "A valid assessment checkpoint is required." }, { status: 400 });
  }
  if (!isPhase1ResumeStep(fields.phase1_resume_step) || typeof fields.phase1_return_to_review !== "boolean") {
    return NextResponse.json({ error: "That assessment checkpoint is not valid." }, { status: 400 });
  }

  const auth = await requireInterviewAccess(request, { memberId });
  if (!auth.ok) return auth.response;
  const [{ data: member, error: memberError }, { data: privacy, error: privacyError }] = await Promise.all([
    supabaseAdmin.from("members").select("member_id, status").eq("member_id", auth.value.memberId).maybeSingle(),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("acknowledged_at, privacy_notice_version")
      .eq("member_id", auth.value.memberId)
      .maybeSingle(),
  ]);
  if (memberError || privacyError) {
    return NextResponse.json({ error: "Unable to save your assessment checkpoint." }, { status: 500 });
  }
  if (!member || member.status === "opted_out") {
    return NextResponse.json({ error: "This assessment is no longer available." }, { status: 410 });
  }
  if (!privacy?.acknowledged_at || privacy.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return NextResponse.json({ error: "Please acknowledge the current privacy information before continuing." }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      phase1_resume_step: fields.phase1_resume_step,
      phase1_return_to_review: fields.phase1_return_to_review,
    })
    .eq("member_id", auth.value.memberId);
  if (error) return NextResponse.json({ error: "Unable to save your assessment checkpoint." }, { status: 500 });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
