-- ============================================================================
-- Fix: member_login_tokens was blocking inserts with RLS.
-- Run in the Supabase SQL editor.
--
-- Symptom: /api/member/auth/request created no rows; a direct anon insert
-- returned "42501: new row violates row-level security policy for table
-- member_login_tokens". The table had RLS ENABLED with no policies (the default
-- when a table is created via the Supabase Table Editor), so the app's anon
-- key — used server-side for all DB access — was denied.
--
-- Migration 0002 already intended RLS to be OFF here (matching every other table
-- in this app; see the "known gap: RLS off app-wide" note). This migration makes
-- that state explicit and is safe to run even if 0002 was applied. Idempotent.
--
-- NOTE: this matches the existing app posture (anon key + RLS off, access
-- enforced in server routes). Proper DB-level hardening (a service-role key plus
-- RLS policies) remains the deferred, org-wide task.
-- ============================================================================

alter table public.member_login_tokens disable row level security;
