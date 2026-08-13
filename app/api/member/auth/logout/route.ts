import { NextResponse } from "next/server";
import {
  sessionCookieOptions,
  SESSION_COOKIE,
  PRESESSION_COOKIE,
  INTERVIEW_SESSION_COOKIE,
} from "@/lib/memberSession";

// POST /api/member/auth/logout — clears the member session cookie.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  res.cookies.set(PRESESSION_COOKIE, "", sessionCookieOptions(0));
  // A member who signs out should not leave behind the narrower interview
  // capability on this shared browser either.
  res.cookies.set(INTERVIEW_SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
