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
    // The sign-in pages remain available to someone who has not yet proved
    // their email address. `/me` itself is still protected below.
    if (req.nextUrl.pathname.startsWith("/member-login")) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/member-login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A verified member session lasts 30 days. Do not make a member request a
  // fresh magic link merely because they followed the member-login bookmark.
  if (req.nextUrl.pathname.startsWith("/member-login")) {
    const url = req.nextUrl.clone();
    url.pathname = "/me";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Only the member profile area. Consultant routes are untouched.
export const config = {
  matcher: ["/me", "/me/:path*", "/member-login", "/member-login/:path*"],
};
