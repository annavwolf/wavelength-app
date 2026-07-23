-- ============================================================================
-- Fix: missing_member_flags was blocking inserts with RLS.
-- Run in the Supabase SQL editor.
--
-- Symptom: the interview's "is anyone from the roster missing?" step failed with
-- "Something went wrong saving that." A direct anon insert returned
-- "42501: new row violates row-level security policy for table
-- missing_member_flags" — RLS enabled with no policies (the Table-Editor default),
-- so the app's anon key (used server-side) was denied. Same class as 0003/0004.
--
-- Matches the app posture (anon key + RLS off, access enforced in app routes).
-- Idempotent.
-- ============================================================================

alter table public.missing_member_flags disable row level security;
