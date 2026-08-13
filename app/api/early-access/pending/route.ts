import { NextRequest, NextResponse } from "next/server";
import {
  clearPendingEarlyAccessClaim,
  consumeEarlyAccessRateLimit,
  issuePendingEarlyAccessClaim,
} from "@/lib/earlyAccess";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

// This endpoint is intentionally public: it runs before a consultant account
// exists. It never reports whether a submitted code was valid. A valid code
// results in an HttpOnly pending-claim cookie; every ordinary request gets the
// same successful response, so the endpoint cannot be used as a code oracle.
export async function POST(request: NextRequest) {
  const rate = consumeEarlyAccessRateLimit(request, "pending");
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "We couldn't prepare early access right now. Please wait and try again." },
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
  const response = new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });

  try {
    await issuePendingEarlyAccessClaim(response, code);
  } catch {
    // Do not expose configuration state to an unauthenticated caller. The
    // login screen uses the same generic error for a transient failure.
    const errorResponse = NextResponse.json(
      { error: "We couldn't prepare early access right now. Please try again." },
      { status: 503, headers: PRIVATE_HEADERS }
    );
    clearPendingEarlyAccessClaim(errorResponse);
    return errorResponse;
  }

  return response;
}
