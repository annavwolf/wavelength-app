import type { AppSupabaseClient } from "@/components/interview/types";

// Coordination ratings store the RATED member by name (coordination_ratings.
// target_member_name), not by id — see the note on CoordinationRating in
// types/database.ts. So when a member renames themselves, any ratings other
// members already gave them still point at the OLD name, and Phase 2 compute
// (which matches target_member_name → display_name) silently drops those edges.
//
// Cheap mitigation for beta (no id-based refactor): when a display name actually
// changes, repoint the existing rating rows in the same save flow. Team-scoped
// and exact-match on the old name, so it only touches this member's inbound
// ratings. Fire-and-forget from the client — a failure here must not block the
// member's own profile save, so callers await it but ignore its result.
export async function propagateDisplayNameChange(
  supabase: AppSupabaseClient,
  teamId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to || from === to) return;

  const { error } = await supabase
    .from("coordination_ratings")
    .update({ target_member_name: to })
    .eq("team_id", teamId)
    .eq("target_member_name", from);

  if (error) {
    console.error("[memberRename] failed to repoint coordination ratings:", {
      message: error.message,
      code: error.code,
    });
  }
}
