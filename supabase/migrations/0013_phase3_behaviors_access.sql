-- Phase 3 member table access fix.
-- member_behaviors and member_stories use the anon-key server client.
-- If RLS was enabled without policies (e.g. via the Supabase dashboard), all
-- inserts/selects fail silently or with a 500. Disable RLS and grant explicit
-- access so server-side routes work correctly.

alter table member_behaviors disable row level security;
alter table member_stories disable row level security;

grant select, insert, update, delete on member_behaviors to anon, authenticated;
grant select, insert, update, delete on member_stories to anon, authenticated;
