import { NextRequest, NextResponse } from "next/server";
import {
  INTERVIEW_ACCESS_ERROR,
  redeemInterviewAccessToken,
  setInterviewAccessCookie,
} from "@/lib/interviewAccess";
import {
  PRESESSION_COOKIE,
  verifyPreSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySession,
} from "@/lib/memberSession";

// Opaque invite entry point. The raw bearer token is consumed here, stored
// only as a SHA-256 hash server-side, and deliberately never appears in the
// eventual /interview URL or browser referrer.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const access = await redeemInterviewAccessToken(token);
  if (!access.ok) {
    return new NextResponse(INTERVIEW_ACCESS_ERROR, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  // A secure invite is often opened on a shared device. Keep a member-profile
  // session only when it belongs to this same participant; otherwise the
  // interview's "Exit to my profile" link could expose the prior user's /me
  // area after this invite has started.
  const existingMemberSession = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value
  );
  const clearDifferentMemberSession =
    !!existingMemberSession &&
    existingMemberSession.member_id !== access.value.memberId;
  // A pending multi-team chooser contains another person's team/name/code
  // candidates. An invite on a shared device should not leave that information
  // reachable through Back or the chooser URL either.
  const existingPreSession = await verifyPreSession(
    request.cookies.get(PRESESSION_COOKIE)?.value
  );
  const clearDifferentPreSession =
    !!existingPreSession &&
    !existingPreSession.candidates.some(
      (candidate) => candidate.member_id === access.value.memberId
    );

  const destination = new URL(`/interview/${access.value.memberId}`, request.nextUrl.origin);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (clearDifferentMemberSession) {
    response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  }
  if (clearDifferentPreSession) {
    response.cookies.set(PRESESSION_COOKIE, "", sessionCookieOptions(0));
  }
  return setInterviewAccessCookie(response, access.value);
}
