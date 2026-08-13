import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const EARLY_ACCESS_SUPPORT_EMAIL = "contact@wavelength.team";

export type EarlyAccessEntitlement = {
  granted: boolean;
  grantedAt: string | null;
};

type RedeemEarlyAccessResult =
  | { ok: true; entitlement: EarlyAccessEntitlement; alreadyGranted: boolean }
  | { ok: false; reason: "not_configured" | "invalid_code" | "database_error" };

function configuredCodeHashes(): Buffer[] {
  const value = process.env.EARLY_ACCESS_CODE_HASHES ?? "";
  return value
    .split(",")
    .map((hash) => hash.trim().toLowerCase())
    .filter((hash) => /^[a-f0-9]{64}$/.test(hash))
    .map((hash) => Buffer.from(hash, "hex"));
}

export function earlyAccessCodesAreConfigured(): boolean {
  return configuredCodeHashes().length > 0;
}

function matchesConfiguredCode(code: string): boolean {
  const hashes = configuredCodeHashes();
  if (hashes.length === 0) return false;

  const candidate = createHash("sha256").update(code).digest();
  // Compare every configured hash even after a match, so this endpoint does
  // not disclose which (if any) configured code was redeemed.
  let matched = false;
  for (const expected of hashes) {
    matched = timingSafeEqual(candidate, expected) || matched;
  }
  return matched;
}

export async function getEarlyAccessEntitlement(
  consultantId: string
): Promise<{ entitlement: EarlyAccessEntitlement; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("consultants")
    .select("early_access_granted_at")
    .eq("consultant_id", consultantId)
    .maybeSingle();

  if (error) {
    return {
      entitlement: { granted: false, grantedAt: null },
      error: error.message,
    };
  }

  const grantedAt = data?.early_access_granted_at ?? null;
  return { entitlement: { granted: Boolean(grantedAt), grantedAt }, error: null };
}

export async function redeemEarlyAccessCode(
  consultantId: string,
  submittedCode: string
): Promise<RedeemEarlyAccessResult> {
  const current = await getEarlyAccessEntitlement(consultantId);
  if (current.error) return { ok: false, reason: "database_error" };
  if (current.entitlement.granted) {
    return { ok: true, entitlement: current.entitlement, alreadyGranted: true };
  }

  if (!earlyAccessCodesAreConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  if (!matchesConfiguredCode(submittedCode.trim())) {
    return { ok: false, reason: "invalid_code" };
  }

  const grantedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("consultants")
    .upsert(
      {
        consultant_id: consultantId,
        early_access_granted_at: grantedAt,
        early_access_grant_source: "code",
      },
      { onConflict: "consultant_id" }
    );

  if (error) return { ok: false, reason: "database_error" };
  return {
    ok: true,
    entitlement: { granted: true, grantedAt },
    alreadyGranted: false,
  };
}
