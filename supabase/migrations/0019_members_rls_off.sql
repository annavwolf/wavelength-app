-- The members table was the only table in this app that still had Supabase's
-- default RLS enabled (all other tables disable it explicitly). This caused
-- browser-client writes from the member area (which use the anon key) to be
-- silently blocked — specifically phase3_completed_at, but any member-side
-- update to their own row was affected. This matches every other table in the
-- schema (access is enforced at the API route level, not via RLS).
alter table public.members disable row level security;
