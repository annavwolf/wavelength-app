import { NextRequest, NextResponse } from "next/server";
import {
  interviewAccessUrl,
  issueInterviewAccessToken,
  revokeInterviewAccessTokens,
} from "@/lib/interviewAccess";
import {
  OTIS_APP_URL_CONFIGURATION_ERROR,
  resolveOtisAppUrl,
} from "@/lib/otisAppUrl";
import { requireTeamOwner } from "@/lib/requestAuth";

// Generate (but do not email) a fresh secure participant invite URL. The raw
// secret is returned only to the authenticated consultant who requested it so
// it can be copied once; the database retains only a hash.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = typeof body?.member_id === "string" ? body.member_id : "";
  const teamId = typeof body?.team_id === "string" ? body.team_id : "";
  const invalidateExisting = body?.invalidate_existing === true;
  if (!memberId || !teamId) {
    return NextResponse.json({ error: "member_id and team_id are required" }, { status: 400 });
  }

  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;

  let appUrl: string;
  try {
    appUrl = resolveOtisAppUrl(request.nextUrl.origin);
  } catch (error) {
    console.error("[invite/link] canonical participant URL unavailable:", error);
    return NextResponse.json(
      { error: OTIS_APP_URL_CONFIGURATION_ERROR },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    if (invalidateExisting) {
      const revoked = await revokeInterviewAccessTokens(memberId, teamId);
      if (revoked.error) {
        return NextResponse.json(
          { error: "Unable to reset this participant link. Please try again." },
          { status: 500 }
        );
      }
    }
    const issued = await issueInterviewAccessToken({ memberId, teamId });
    return NextResponse.json(
      {
        interview_url: interviewAccessUrl(appUrl, issued.token),
        expires_at: issued.expiresAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // The caller is already an owner of the team. Keep the user-facing response
    // clear without returning internal token/database details.
    return NextResponse.json({ error: "Unable to create a secure participant link. Please try again." }, { status: 500 });
  }
}
