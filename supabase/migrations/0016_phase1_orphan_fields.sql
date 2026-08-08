-- Phase 1 rewrite — persist three interview answers that were previously
-- collected but never written to the database (they lived only in client draft
-- state and were lost on close). See the Phase 1 → downstream audit.
--
--   own_role            — free text: how the member describes their own role /
--                         contribution on the team. Consultant-facing (raw
--                         display only, no analytics).
--   ps_importance       — free text: the member's take on whether psychological
--                         safety matters for their team. Consultant-facing;
--                         dismissive/skeptical answers are surfaced by the
--                         interpret step's welfare_or_sensitive_note.
--   team_name_suggestion — free text: the member's suggested name for the team.
--                         The consultant may optionally adopt one as the team's
--                         display name (teams.team_name) from the dashboard.
--
-- All three are optional, member-volunteered, and never shown to other members.

alter table members
  add column if not exists own_role text,
  add column if not exists ps_importance text,
  add column if not exists team_name_suggestion text;
