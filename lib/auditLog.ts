import { supabaseAdmin } from "@/lib/supabase";

// Logs every time the identity↔response link is traversed (B.4).
// Failures are logged but never thrown — an audit failure must never break
// the calling route. Anna can review the identity_lookup_log table directly.
export async function logIdentityLookup(
  memberId: string,
  lookedUpBy: string,
  purpose?: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("identity_lookup_log").insert({
    member_id: memberId,
    looked_up_by: lookedUpBy,
    purpose: purpose ?? null,
  });
  if (error) {
    console.error("[auditLog] failed to write identity lookup log:", error.message);
  }
}

// Bulk variant for routes that look up multiple members at once (release routes).
export async function logIdentityLookups(
  memberIds: string[],
  lookedUpBy: string,
  purpose?: string
): Promise<void> {
  if (memberIds.length === 0) return;
  const rows = memberIds.map((member_id) => ({
    member_id,
    looked_up_by: lookedUpBy,
    purpose: purpose ?? null,
  }));
  const { error } = await supabaseAdmin.from("identity_lookup_log").insert(rows);
  if (error) {
    console.error("[auditLog] failed to write identity lookup logs:", error.message);
  }
}
