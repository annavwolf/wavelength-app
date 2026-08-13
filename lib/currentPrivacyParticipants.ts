import "server-only";

import { PRIVACY_NOTICE_VERSION, type VerbatimPreference } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * The current notice is the participation boundary for any new aggregate or
 * generative Phase 4 work. Keep this server-only so a browser can never use a
 * service-role query to infer another participant's privacy choices.
 */
export type CurrentPrivacyParticipant = {
  memberId: string;
  verbatimPreference: VerbatimPreference;
};

export async function getCurrentPrivacyParticipants(
  teamId: string,
  options: { completedOnly?: boolean } = { completedOnly: true }
): Promise<CurrentPrivacyParticipant[]> {
  const { data, error } = await supabaseAdmin
    .from("member_privacy_acknowledgements")
    .select("member_id, verbatim_preference")
    .eq("team_id", teamId)
    .eq("privacy_notice_version", PRIVACY_NOTICE_VERSION)
    .not("acknowledged_at", "is", null);

  if (error) {
    throw new Error(`current privacy participant load failed: ${error.message}`);
  }

  const acknowledged = (data ?? []).flatMap((record) => {
    if (record.verbatim_preference !== "summary_only" && record.verbatim_preference !== "verbatim") {
      return [];
    }
    return [{
      memberId: record.member_id,
      verbatimPreference: record.verbatim_preference,
    }];
  });
  if (acknowledged.length === 0) return [];

  // A Phase 1 withdrawal leaves the acknowledgement audit record in place,
  // but the person must not re-enter a later aggregate merely because of it.
  // Phase 4 callers default to completed Phase 1 participants too, so an
  // invited or partial record cannot become source material prematurely.
  let memberQuery = supabaseAdmin
    .from("members")
    .select("member_id")
    .eq("team_id", teamId)
    .neq("status", "opted_out")
    .in("member_id", acknowledged.map((participant) => participant.memberId));
  if (options.completedOnly) {
    memberQuery = memberQuery.eq("status", "complete");
  }
  const { data: activeMembers, error: activeMemberError } = await memberQuery;
  if (activeMemberError) {
    throw new Error(`current participant status load failed: ${activeMemberError.message}`);
  }
  const activeMemberIds = new Set((activeMembers ?? []).map((member) => member.member_id));
  return acknowledged.filter((participant) => activeMemberIds.has(participant.memberId));
}

export function currentPrivacyParticipantIds(
  participants: CurrentPrivacyParticipant[]
): string[] {
  return Array.from(new Set(participants.map((participant) => participant.memberId)));
}
