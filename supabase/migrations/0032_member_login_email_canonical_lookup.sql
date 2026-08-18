-- ============================================================================
-- Robust email matching for passwordless member magic-link sign-in.
--
-- WHY: the request + verify routes looked up the roster with
--   member_identity.email ILIKE '<typed email>'
-- which needs a byte-for-byte (case-insensitive) match. When the stored address
-- differed from what the person typed — stray whitespace from an import, or a
-- Gmail dot/‘+tag’ variant (Gmail ignores dots and +suffixes and treats
-- googlemail.com as gmail.com) — the lookup found nothing. The request route
-- then returned its generic "if that email is on a team, we've sent a link"
-- reply WITHOUT minting a token or sending anything. Every OTHER email
-- (assessment invite, agreement, results) reads the stored address directly, so
-- those still arrived — only sign-in silently failed. That is exactly the
-- reported symptom: got everything except the magic link.
--
-- WHAT this adds:
--   1. canonical_member_email(text) — pure, immutable canonicaliser. Trims +
--      lowercases every address; for gmail.com / googlemail.com it also strips
--      dots and the +tag so aliases of the same inbox compare equal. Other
--      providers get trim+lowercase only (never drop +tags there — some treat
--      them literally, and a sign-in link must never resolve to a different
--      person's address).
--   2. A functional index on canonical_member_email(email) to keep lookups fast.
--   3. find_member_identities_by_email(text) — the service-role RPC both auth
--      routes now call instead of ILIKE.
--   4. A one-time cleanup that trims/lowercases existing stored addresses so the
--      roster, outbound mail and matching all agree going forward.
--
-- Run in the Supabase SQL editor. Transaction-wrapped; review before running.
-- ============================================================================

begin;

-- ── 1. Canonicaliser ─────────────────────────────────────────────────────────
-- Pure string function (no table access) so it is safe to use in an index and
-- on both sides of the lookup comparison. IMMUTABLE is required for the index.
create or replace function public.canonical_member_email(p_email text)
returns text
language sql
immutable
returns null on null input
set search_path = pg_catalog, pg_temp
as $$
  select case
    -- Not a well-formed "local@domain" — fall back to the normalised string.
    when strpos(v.norm, '@') = 0 then v.norm
    -- Gmail: dots are insignificant, everything from '+' is a tag, and
    -- googlemail.com is the same mailbox as gmail.com.
    when v.domain in ('gmail.com', 'googlemail.com')
      then replace(split_part(v.local_part, '+', 1), '.', '') || '@gmail.com'
    -- Every other provider: compare on the trimmed, lowercased address only.
    else v.norm
  end
  from (
    select
      n.norm,
      split_part(n.norm, '@', 1)              as local_part,
      substr(n.norm, strpos(n.norm, '@') + 1) as domain
    -- btrim with an explicit set strips tabs/newlines/CRs too (not just spaces),
    -- matching the JS .trim() the write paths use, so a CSV-imported address with
    -- a stray tab still canonicalises to the same inbox.
    from (select lower(btrim(p_email, E' \t\n\r\f\v')) as norm) n
  ) v;
$$;

comment on function public.canonical_member_email(text) is
  'Canonical form of a member email for sign-in matching: trim+lowercase, plus Gmail dot/+tag/googlemail folding. Pure helper — exposes nothing sensitive.';

-- ── 2. One-time cleanup of existing stored addresses ─────────────────────────
-- Removes stray whitespace and casing so the stored value the roster shows and
-- outbound mail uses is the same one sign-in matches. member_identity.email has
-- no unique constraint (an email may repeat across teams), so this cannot
-- collide. Runs before the index build so the index is populated from clean data.
update public.member_identity
set email = lower(btrim(email, E' \t\n\r\f\v'))
where email is not null
  and email <> lower(btrim(email, E' \t\n\r\f\v'));

-- ── 3. Functional index for fast canonical lookups ───────────────────────────
create index if not exists member_identity_email_canonical_idx
  on public.member_identity (public.canonical_member_email(email))
  where email is not null;

-- ── 4. Service-role lookup RPC ───────────────────────────────────────────────
-- Returns every member whose stored address canonicalises to the same inbox as
-- p_email. Called only by the server auth routes via the service-role client;
-- SECURITY DEFINER + the grants below keep it off-limits to browser roles, the
-- same boundary the rate-limit RPC uses.
create or replace function public.find_member_identities_by_email(p_email text)
returns table (member_id uuid, team_id uuid, email text, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mi.member_id, mi.team_id, mi.email, mi.display_name
  from public.member_identity mi
  where mi.email is not null
    and public.canonical_member_email(mi.email) = public.canonical_member_email(p_email);
$$;

revoke all on function public.find_member_identities_by_email(text)
  from public, anon, authenticated;
grant execute on function public.find_member_identities_by_email(text)
  to service_role;

commit;

-- ── Verification / operational queries (run manually; not part of the migration)
-- Find a specific person's roster row, revealing hidden whitespace (char_length
-- vs the trimmed length) and the canonical form both sign-in and mail resolve to:
--
--   SELECT member_id, team_id,
--          email,
--          char_length(email)              AS stored_len,
--          public.canonical_member_email(email) AS canonical
--   FROM member_identity
--   WHERE public.canonical_member_email(email)
--         = public.canonical_member_email('lbsusconsulting@gmail.com');
--
-- Roster rows whose stored address still differs from its canonical inbox
-- (i.e. would only have matched before this migration by luck):
--
--   SELECT email, public.canonical_member_email(email) AS canonical
--   FROM member_identity
--   WHERE email IS NOT NULL
--     AND lower(btrim(email)) <> public.canonical_member_email(email);
