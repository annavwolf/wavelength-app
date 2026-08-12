import { NextRequest, NextResponse } from "next/server";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";
import type { MemberWithIdentity } from "@/types/database";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function anonymizeSubmission(
  value: unknown,
  verbatimMemberIds: Set<string>,
  anonymousMemberIds: Map<string, string>
) {
  if (!isRecord(value)) return value;
  const memberId = typeof value.member_id === "string" ? value.member_id : "";
  const opaqueMemberId = memberId.startsWith("participant-");
  const verbatimAllowed = memberId && !opaqueMemberId
    ? verbatimMemberIds.has(memberId)
    : value.verbatim_allowed === true;
  const anonymousMemberId = opaqueMemberId
    ? memberId
    : memberId
    ? anonymousMemberIds.get(memberId) ?? (() => {
        const next = `participant-${anonymousMemberIds.size + 1}`;
        anonymousMemberIds.set(memberId, next);
        return next;
      })()
    : "participant";
  return {
    ...value,
    member_id: anonymousMemberId,
    verbatim_allowed: verbatimAllowed,
    text: verbatimAllowed ? value.text : "[Participant chose summaries only.]",
    pass1_reason: "",
    pass2_reason: "",
  };
}

function anonymizePhase4Payload(value: unknown, verbatimMemberIds: Set<string>) {
  if (!isRecord(value)) return value;
  const anonymousMemberIds = new Map<string, string>();
  const behaviourBoard = Array.isArray(value.behaviour_board)
    ? value.behaviour_board.map((group) => {
        if (!isRecord(group)) return group;
        return {
          ...group,
          contributing_submissions: Array.isArray(group.contributing_submissions)
            ? group.contributing_submissions.map((submission) => anonymizeSubmission(submission, verbatimMemberIds, anonymousMemberIds))
            : group.contributing_submissions,
        };
      })
    : value.behaviour_board;
  return {
    ...value,
    behaviour_board: behaviourBoard,
    unbucketed_submissions: Array.isArray(value.unbucketed_submissions)
      ? value.unbucketed_submissions.map((submission) => anonymizeSubmission(submission, verbatimMemberIds, anonymousMemberIds))
      : value.unbucketed_submissions,
    sent_member_ids: [],
  };
}

function anonymizePhase3Report(value: unknown) {
  return isRecord(value) ? { ...value, sent_member_ids: [] } : value;
}

// Consolidated, owner-scoped dashboard payload. It keeps the consultant's
// browser from using broad direct table reads just to render one team.
export async function GET(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;

  const [teamRes, membersRes, identityRes, privacyRes, analysisRes, missingRes, phase3DoneRes] = await Promise.all([
    supabaseAdmin.from("teams").select("*").eq("team_id", teamId).maybeSingle(),
    supabaseAdmin.from("members").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
    supabaseAdmin.from("member_identity").select("member_id, email, display_name").eq("team_id", teamId),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("member_id, acknowledged_at, privacy_notice_version, verbatim_preference")
      .eq("team_id", teamId),
    supabaseAdmin.from("analysis").select("*").eq("team_id", teamId).maybeSingle(),
    supabaseAdmin.from("missing_member_flags").select("missing_role").eq("team_id", teamId),
    supabaseAdmin.from("member_behaviors").select("member_id").eq("team_id", teamId),
  ]);
  if (!teamRes.data) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (teamRes.error || membersRes.error || identityRes.error || privacyRes.error || analysisRes.error || missingRes.error || phase3DoneRes.error) {
    return NextResponse.json({ error: "Unable to load the team dashboard." }, { status: 500 });
  }

  const identityById = new Map((identityRes.data ?? []).map((identity) => [identity.member_id, identity]));
  const privacyById = new Map((privacyRes.data ?? []).map((privacy) => [privacy.member_id, privacy]));
  const verbatimMemberIds = new Set(
    (privacyRes.data ?? [])
      .filter((privacy) => privacy.verbatim_preference === "verbatim")
      .map((privacy) => privacy.member_id)
  );
  const members: MemberWithIdentity[] = (membersRes.data ?? []).map((member) => {
    const identity = identityById.get(member.member_id);
    const privacy = privacyById.get(member.member_id);
    const identityNameMissing = !identity?.display_name?.trim();
    return {
      ...member,
      // Keep identity/response linkage off the consultant dashboard payload.
      private_code: "",
      display_name: identityNameMissing ? "Name to be confirmed" : (identity?.display_name ?? ""),
      email: identity?.email ?? null,
      identity_name_missing: identityNameMissing,
      privacy_acknowledged_at: privacy?.acknowledged_at ?? null,
      privacy_notice_version: privacy?.privacy_notice_version ?? null,
      privacy_acknowledged_currently: Boolean(
        privacy?.acknowledged_at && privacy.privacy_notice_version === PRIVACY_NOTICE_VERSION
      ),
      verbatim_preference: null,
    };
  });

  const analysis = analysisRes.data
    ? {
        ...analysisRes.data,
        phase3_report_json: anonymizePhase3Report(analysisRes.data.phase3_report_json),
        phase4_selfserve_json: anonymizePhase4Payload(analysisRes.data.phase4_selfserve_json, verbatimMemberIds),
      }
    : null;

  return NextResponse.json({
    team: teamRes.data,
    members,
    analysis,
    missing_flags: missingRes.data ?? [],
    phase3_done_member_ids: Array.from(new Set((phase3DoneRes.data ?? []).map((row) => row.member_id))),
  });
}
