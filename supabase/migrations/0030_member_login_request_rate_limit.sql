-- ============================================================================
-- Durable abuse limits for passwordless member magic-link requests.
--
-- The request route HMACs normalized email and client address before calling
-- this function. This table therefore contains opaque, server-only key hashes
-- and counters only: it never stores a raw email address, IP address, token,
-- or message content. The two rows are updated in one transaction so limits
-- remain reliable across Vercel/serverless instances.
-- ============================================================================

begin;

create table if not exists public.member_login_request_rate_windows (
  scope             text not null check (scope in ('combination_15m', 'email_1h')),
  key_hash          text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count     integer not null default 0 check (request_count >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (scope, key_hash)
);

create index if not exists member_login_request_rate_windows_expiry_idx
  on public.member_login_request_rate_windows (window_started_at);

-- Counters are operational server data. Browser roles receive neither table
-- access nor RPC execution. Supabase's service-role client is the only caller.
alter table public.member_login_request_rate_windows enable row level security;

create or replace function public.consume_member_login_request_rate_limit(
  p_combination_key_hash text,
  p_email_key_hash text,
  p_combination_limit integer default 3,
  p_email_limit integer default 10
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_combination public.member_login_request_rate_windows%rowtype;
  v_email public.member_login_request_rate_windows%rowtype;
  v_combination_retry integer := 0;
  v_email_retry integer := 0;
begin
  if p_combination_key_hash is null
    or p_email_key_hash is null
    or p_combination_key_hash !~ '^[a-f0-9]{64}$'
    or p_email_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid member-login rate-limit key';
  end if;

  -- Hard bounds prevent a mistaken environment/configuration override from
  -- silently disabling this abuse control.
  if p_combination_limit not between 1 and 10
    or p_email_limit not between 1 and 30 then
    raise exception 'member-login rate limits are outside safe bounds';
  end if;

  -- These counters have no value after their longest (one-hour) window. Every
  -- use performs bounded retention cleanup; no raw identifiers are retained.
  delete from public.member_login_request_rate_windows
  where window_started_at < v_now - interval '2 hours';

  -- Insert before locking. ON CONFLICT serializes concurrent requests for the
  -- same opaque key; all callers lock in the same order below.
  insert into public.member_login_request_rate_windows
    (scope, key_hash, window_started_at)
  values
    ('combination_15m', p_combination_key_hash, v_now),
    ('email_1h', p_email_key_hash, v_now)
  on conflict (scope, key_hash) do nothing;

  select *
  into v_combination
  from public.member_login_request_rate_windows
  where scope = 'combination_15m'
    and key_hash = p_combination_key_hash
  for update;

  select *
  into v_email
  from public.member_login_request_rate_windows
  where scope = 'email_1h'
    and key_hash = p_email_key_hash
  for update;

  -- Each limit is a rolling window beginning with its first request, rather
  -- than a fixed clock bucket that could be doubled around a boundary.
  if v_combination.window_started_at <= v_now - interval '15 minutes' then
    update public.member_login_request_rate_windows
    set window_started_at = v_now,
        request_count = 0,
        updated_at = v_now
    where scope = 'combination_15m'
      and key_hash = p_combination_key_hash
    returning * into v_combination;
  end if;

  if v_email.window_started_at <= v_now - interval '1 hour' then
    update public.member_login_request_rate_windows
    set window_started_at = v_now,
        request_count = 0,
        updated_at = v_now
    where scope = 'email_1h'
      and key_hash = p_email_key_hash
    returning * into v_email;
  end if;

  if v_combination.request_count >= p_combination_limit then
    v_combination_retry := greatest(
      1,
      ceil(extract(epoch from (
        (v_combination.window_started_at + interval '15 minutes') - v_now
      )))::integer
    );
  end if;

  if v_email.request_count >= p_email_limit then
    v_email_retry := greatest(
      1,
      ceil(extract(epoch from (
        (v_email.window_started_at + interval '1 hour') - v_now
      )))::integer
    );
  end if;

  if v_combination_retry > 0 or v_email_retry > 0 then
    -- Both limits must be available before a request can proceed, so return
    -- the later retry time when both windows are currently exhausted.
    return query select false, greatest(v_combination_retry, v_email_retry);
    return;
  end if;

  update public.member_login_request_rate_windows
  set request_count = request_count + 1,
      updated_at = v_now
  where scope = 'combination_15m'
    and key_hash = p_combination_key_hash;

  update public.member_login_request_rate_windows
  set request_count = request_count + 1,
      updated_at = v_now
  where scope = 'email_1h'
    and key_hash = p_email_key_hash;

  return query select true, 0;
end;
$$;

revoke all on public.member_login_request_rate_windows from public, anon, authenticated;
revoke all on function public.consume_member_login_request_rate_limit(
  text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.consume_member_login_request_rate_limit(
  text, text, integer, integer
) to service_role;

commit;
