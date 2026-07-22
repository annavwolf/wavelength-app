// Privacy helpers for member-facing views. EVERY view that shows one member's
// data to another member must route names/verbatim text through these, so the
// `share_name_with_team` / `share_verbatim_with_team` consent flags are honoured
// in exactly one place (Architecture doc §5, Phase 3 Spec §1, Phase 4 §1.1).
//
// Stage A note: the only member-facing view so far is a member's OWN profile,
// and a member always sees their own data in full — so `viewerMemberId === the
// subject` short-circuits to full disclosure and nothing is redacted yet. These
// helpers exist now as the foundation every Phase 3+ team-wide view will use.

import type { Member } from "@/types/database";

// The subset of a member row these helpers need. Accepts a full Member too.
export type PrivacySubject = Pick<
  Member,
  "member_id" | "display_name" | "private_code" | "share_name_with_team" | "share_verbatim_with_team"
>;

// True when the viewer is looking at their own row (always full disclosure).
function isSelf(subject: PrivacySubject, viewerMemberId: string | null): boolean {
  return !!viewerMemberId && subject.member_id === viewerMemberId;
}

// The name to show for `subject` to a viewer. Real name only if the subject is
// the viewer themselves OR granted share_name_with_team; otherwise an
// anonymised, stable symbol (their private_code, e.g. "P101").
export function displayNameFor(
  subject: PrivacySubject,
  viewerMemberId: string | null
): string {
  if (isSelf(subject, viewerMemberId) || subject.share_name_with_team) {
    return subject.display_name;
  }
  return subject.private_code;
}

// Whether `subject`'s free-text (stories, behaviours) may be shown verbatim to
// the viewer. Own data is always visible; otherwise gated on the consent flag.
export function canShowVerbatim(
  subject: PrivacySubject,
  viewerMemberId: string | null
): boolean {
  return isSelf(subject, viewerMemberId) || subject.share_verbatim_with_team;
}

// Convenience: returns the verbatim text if permitted, else null (callers render
// a neutral placeholder such as "a teammate shared something here").
export function verbatimFor(
  subject: PrivacySubject,
  viewerMemberId: string | null,
  text: string | null
): string | null {
  return canShowVerbatim(subject, viewerMemberId) ? text : null;
}
