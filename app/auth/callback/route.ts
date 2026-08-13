import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  clearPendingEarlyAccessClaim,
  readPendingEarlyAccessClaim,
  redeemEarlyAccessCodeHash,
} from "@/lib/earlyAccess";

function safeRedirectPath(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  try {
    const target = new URL(value, origin);
    return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : "/";
  } catch {
    return "/";
  }
}

// Handles Supabase auth redirects: email confirmation and password reset links.
// A signup can first create an HttpOnly early-access claim. Once Supabase has
// authenticated the user here, the raw code is no longer needed: the callback
// safely consumes the signed code hash and grants the consultant entitlement.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = safeRedirectPath(searchParams.get("next"), origin);
  const response = NextResponse.redirect(new URL(requestedNext, origin));
  const pendingCookie = request.cookies.get("otis_early_access_pending")?.value;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let userId: string | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      clearPendingEarlyAccessClaim(response);
      response.headers.set("Location", `${origin}/login?error=auth-callback`);
      return response;
    }
    userId = data.user?.id ?? data.session?.user?.id ?? null;
  } else {
    // This covers projects that do not require confirmation: Supabase's
    // browser client has already written its auth cookies, then the login page
    // deliberately reloads this route so the same pending-claim path is used.
    const { data, error } = await supabase.auth.getUser();
    if (!error) userId = data.user?.id ?? null;
  }

  if (!userId) {
    // A pending claim must never survive an unauthenticated callback, where it
    // could otherwise be applied by a future account in the same browser.
    clearPendingEarlyAccessClaim(response);
    response.headers.set("Location", `${origin}/login?error=auth-callback`);
    return response;
  }

  const pendingHash = await readPendingEarlyAccessClaim(pendingCookie);
  if (pendingCookie) clearPendingEarlyAccessClaim(response);

  let destination = requestedNext;
  if (pendingHash) {
    // Recheck the hash against current server configuration before granting,
    // so rotating/removing a code invalidates any unconsumed pending claim.
    try {
      await redeemEarlyAccessCodeHash(userId, pendingHash);
    } catch {
      // The claim has still been consumed. `/early-access` remains the safe
      // manual fallback if the entitlement database was temporarily down.
    }
    // Do not trust a `next` supplied alongside a claim. This page gives the
    // new consultant a clear confirmation and retains manual-entry fallback
    // if the database operation was unavailable.
    destination = "/early-access";
  }

  response.headers.set("Location", new URL(destination, origin).toString());
  return response;
}
