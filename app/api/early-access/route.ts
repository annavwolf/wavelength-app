import { NextRequest, NextResponse } from "next/server";
import {
  EARLY_ACCESS_SUPPORT_EMAIL,
  consumeEarlyAccessRateLimit,
  getEarlyAccessEntitlement,
  redeemEarlyAccessCode,
} from "@/lib/earlyAccess";
import { requireConsultant } from "@/lib/requestAuth";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

// GET lets the signed-in consultant render a truthful lock state without
// exposing whether any particular access code exists or has been redeemed.
export async function GET(request: NextRequest) {
  const auth = await requireConsultant(request);
  if (!auth.ok) return auth.response;

  const { entitlement, error } = await getEarlyAccessEntitlement(auth.value.userId);
  if (error) {
    return NextResponse.json(
      { error: "Unable to load early-access status." },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
  return NextResponse.json(
    {
      early_access: entitlement.granted,
      granted_at: entitlement.grantedAt,
    },
    { headers: PRIVATE_HEADERS }
  );
}

// POST { code }
// The raw code is sent only over this authenticated request, hashed in memory,
// and never saved or returned. Valid SHA-256 digests live server-side in
// EARLY_ACCESS_CODE_HASHES.
export async function POST(request: NextRequest) {
  const auth = await requireConsultant(request);
  if (!auth.ok) return auth.response;

  const rate = consumeEarlyAccessRateLimit(request, "redeem", auth.value.userId);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying another code." },
      {
        status: 429,
        headers: {
          ...PRIVATE_HEADERS,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json(
      { error: "Enter your early-access code." },
      { status: 400, headers: PRIVATE_HEADERS }
    );
  }

  const result = await redeemEarlyAccessCode(auth.value.userId, code);
  if (!result.ok) {
    if (result.reason === "not_configured") {
      return NextResponse.json(
        {
          error: `Early-access codes are not configured yet. Please contact ${EARLY_ACCESS_SUPPORT_EMAIL}.`,
          code: "early_access_unavailable",
        },
        { status: 503, headers: PRIVATE_HEADERS }
      );
    }
    if (result.reason === "invalid_code") {
      return NextResponse.json(
        {
          error: `That early-access code is not valid. Check it and try again, or contact ${EARLY_ACCESS_SUPPORT_EMAIL}.`,
          code: "invalid_early_access_code",
        },
        { status: 403, headers: PRIVATE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: "Unable to grant early access. Please try again." },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      early_access: true,
      granted_at: result.entitlement.grantedAt,
      already_granted: result.alreadyGranted,
    },
    { headers: PRIVATE_HEADERS }
  );
}
