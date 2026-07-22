import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/memberSession";

// Server-side guard for the member area. Runs before the page renders, so an
// unauthenticated visitor to /me never even loads the profile shell. This is
// the member equivalent of AuthGate — and, crucially, it only ever grants /me:
// a member session is not a Supabase session, so it can't reach the consultant
// dashboard, and a consultant's Supabase session isn't checked here, so it
// can't reach /me either. Two independent doors.
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/member-login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Only the member profile area. Consultant routes are untouched.
export const config = {
  matcher: ["/me", "/me/:path*"],
};
