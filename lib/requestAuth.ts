import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, supabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE, verifySession, type MemberSession } from "@/lib/memberSession";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

type AuthorizedConsultant = { userId: string };
type AuthorizedMember = { session: MemberSession };

type AuthResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

/** Verify the Supabase consultant session on a route handler request. */
export async function requireConsultant(
  request: NextRequest
): Promise<AuthResult<AuthorizedConsultant>> {
  const client = createServerAuthClient(() => request.cookies.getAll());
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  return { ok: true, value: { userId: data.user.id } };
}

/** Verify that the signed-in consultant owns the named team. */
export async function requireTeamOwner(
  request: NextRequest,
  teamId: string
): Promise<AuthResult<AuthorizedConsultant>> {
  const consultant = await requireConsultant(request);
  if (!consultant.ok) return consultant;

  const { data: team, error } = await supabaseAdmin
    .from("teams")
    .select("team_id, consultant_id")
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unable to verify team access." }, { status: 500 }),
    };
  }
  if (!team) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Team not found." }, { status: 404 }),
    };
  }
  if (team.consultant_id !== consultant.value.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "You do not have access to this team." }, { status: 403 }),
    };
  }
  return consultant;
}

/** Verify the signed member cookie and, when supplied, its member/team scope. */
export async function requireMemberSession(
  request: NextRequest,
  expected?: { memberId?: string; teamId?: string }
): Promise<AuthResult<AuthorizedMember>> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  if (
    (expected?.memberId && expected.memberId !== session.member_id) ||
    (expected?.teamId && expected.teamId !== session.team_id)
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "You do not have access to this data." }, { status: 403 }),
    };
  }
  return { ok: true, value: { session } };
}

/** A signed-in beta participant must also have accepted the current notice. */
export async function requireAcknowledgedMember(
  request: NextRequest,
  expected?: { memberId?: string; teamId?: string }
): Promise<AuthResult<AuthorizedMember>> {
  const member = await requireMemberSession(request, expected);
  if (!member.ok) return member;

  const { data, error } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("acknowledged_at, privacy_notice_version")
    .eq("member_id", member.value.session.member_id)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unable to verify your privacy acknowledgement." }, { status: 500 }),
    };
  }
  if (!data?.acknowledged_at || data.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Please acknowledge the current beta participant privacy information before continuing." },
        { status: 409 }
      ),
    };
  }
  return member;
}
