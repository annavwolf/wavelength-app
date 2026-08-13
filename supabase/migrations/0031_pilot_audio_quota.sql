-- ============================================================================
-- Durable, pilot-wide hosted-audio budget guard.
--
-- Per-member minute limits prevent one participant from consuming an excessive
-- amount of audio. They do not, by themselves, protect a small beta's shared
-- provider credit if many accounts make requests at once. This table stores
-- only global aggregate counters for the current UTC month: never recordings,
-- transcripts, text, identifiers, or provider credentials.
-- ============================================================================

begin;

create table if not exists public.pilot_audio_usage_months (
  month_started_at            timestamptz primary key,
  synthesis_characters        bigint not null default 0 check (synthesis_characters >= 0),
  transcription_duration_ms   bigint not null default 0 check (transcription_duration_ms >= 0),
  transcription_bytes         bigint not null default 0 check (transcription_bytes >= 0),
  created_at                  timestamptz not null default now()
);

-- Operational counters are server-only. There are intentionally no browser
-- policies and no public RPC grant.
alter table public.pilot_audio_usage_months enable row level security;

create or replace function public.consume_pilot_audio_quota(
  p_capability text,
  p_tts_characters integer default 0,
  p_stt_duration_ms integer default 0,
  p_stt_bytes bigint default 0,
  p_tts_character_limit bigint default 1000000,
  p_stt_duration_limit_ms bigint default 30000000,
  p_stt_byte_limit bigint default 536870912
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Monthly windows are deliberately fixed to UTC, independent of the
  -- database/session time zone used by a caller.
  v_month_started_at timestamptz := date_trunc('month', timezone('UTC', clock_timestamp())) at time zone 'UTC';
  v_retry_after_seconds integer;
  v_usage public.pilot_audio_usage_months%rowtype;
begin
  if p_capability not in ('synthesis', 'transcription') then
    raise exception 'unsupported audio capability';
  end if;

  -- Hard limits mean a malformed or overly generous server environment value
  -- cannot silently create an open-ended provider bill.
  if p_tts_character_limit not between 10000 and 2000000
    or p_stt_duration_limit_ms not between 60000 and 120000000
    or p_stt_byte_limit not between 1048576 and 4294967296 then
    raise exception 'pilot audio quota limits are outside safe bounds';
  end if;

  if p_capability = 'synthesis' then
    if p_tts_characters not between 1 and 4000
      or p_stt_duration_ms <> 0
      or p_stt_bytes <> 0 then
      raise exception 'invalid synthesis quota usage';
    end if;
  else
    if p_tts_characters <> 0
      or p_stt_duration_ms not between 500 and 60000
      or p_stt_bytes not between 1 and 4194304 then
      raise exception 'invalid transcription quota usage';
    end if;
  end if;

  -- No participant data is retained here. Keep only a small rolling history
  -- of aggregate operational counters so the table cannot grow indefinitely.
  delete from public.pilot_audio_usage_months
  where month_started_at < v_month_started_at - interval '13 months';

  -- A single current-month row acts as the shared lock. INSERT ON CONFLICT
  -- plus SELECT FOR UPDATE serializes every requested allowance, including
  -- concurrent requests arriving on different serverless instances.
  insert into public.pilot_audio_usage_months (month_started_at)
  values (v_month_started_at)
  on conflict (month_started_at) do nothing;

  select *
  into v_usage
  from public.pilot_audio_usage_months
  where month_started_at = v_month_started_at
  for update;

  v_retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from ((v_month_started_at + interval '1 month') - clock_timestamp())))::integer
  );

  if p_capability = 'synthesis' then
    if v_usage.synthesis_characters + p_tts_characters > p_tts_character_limit then
      return query select false, v_retry_after_seconds;
      return;
    end if;

    update public.pilot_audio_usage_months
    set synthesis_characters = synthesis_characters + p_tts_characters
    where month_started_at = v_month_started_at;
  else
    if v_usage.transcription_duration_ms + p_stt_duration_ms > p_stt_duration_limit_ms
      or v_usage.transcription_bytes + p_stt_bytes > p_stt_byte_limit then
      return query select false, v_retry_after_seconds;
      return;
    end if;

    update public.pilot_audio_usage_months
    set transcription_duration_ms = transcription_duration_ms + p_stt_duration_ms,
        transcription_bytes = transcription_bytes + p_stt_bytes
    where month_started_at = v_month_started_at;
  end if;

  return query select true, 0;
end;
$$;

revoke all on public.pilot_audio_usage_months from public, anon, authenticated;
revoke all on function public.consume_pilot_audio_quota(
  text, integer, integer, bigint, bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.consume_pilot_audio_quota(
  text, integer, integer, bigint, bigint, bigint, bigint
) to service_role;

commit;
