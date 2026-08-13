-- ============================================================================
-- Durable, per-participant hosted-audio quotas.
--
-- Audio routes run on serverless instances, so an in-process Map cannot be a
-- reliable cost or abuse boundary. This table contains counters only (never
-- text, recordings, or transcripts) and the RPC below serializes updates for
-- one participant/minute window with SELECT ... FOR UPDATE.
-- ============================================================================

begin;

create table if not exists public.member_audio_usage_windows (
  member_id             uuid not null references public.members(member_id) on delete cascade,
  window_started_at     timestamptz not null,
  synthesis_requests    integer not null default 0 check (synthesis_requests >= 0),
  synthesis_characters  integer not null default 0 check (synthesis_characters >= 0),
  transcription_requests integer not null default 0 check (transcription_requests >= 0),
  transcription_duration_ms integer not null default 0 check (transcription_duration_ms >= 0),
  transcription_bytes   bigint not null default 0 check (transcription_bytes >= 0),
  created_at            timestamptz not null default now(),
  primary key (member_id, window_started_at)
);

create index if not exists member_audio_usage_windows_expiry_idx
  on public.member_audio_usage_windows (window_started_at);

-- Counters are server-only operational data. Browser roles get no table
-- policy, and the RPC is explicitly granted only to the service-role client.
alter table public.member_audio_usage_windows enable row level security;

create or replace function public.consume_member_audio_quota(
  p_member_id uuid,
  p_capability text,
  p_tts_characters integer default 0,
  p_stt_duration_ms integer default 0,
  p_stt_bytes bigint default 0,
  p_tts_request_limit integer default 20,
  p_tts_character_limit integer default 20000,
  p_stt_request_limit integer default 6,
  p_stt_duration_limit_ms integer default 120000,
  p_stt_byte_limit bigint default 1048576
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_started_at timestamptz := date_trunc('minute', clock_timestamp());
  v_retry_after_seconds integer;
  v_usage public.member_audio_usage_windows%rowtype;
begin
  if p_member_id is null then
    raise exception 'member id is required';
  end if;
  if p_capability not in ('synthesis', 'transcription') then
    raise exception 'unsupported audio capability';
  end if;

  -- These bounds make server-side environment overrides useful without giving
  -- a configuration mistake permission to create an unbounded provider bill.
  if p_tts_request_limit not between 1 and 60
    or p_tts_character_limit not between 500 and 60000
    or p_stt_request_limit not between 1 and 20
    or p_stt_duration_limit_ms not between 500 and 300000
    or p_stt_byte_limit not between 65536 and 4194304 then
    raise exception 'audio quota limits are outside their safe bounds';
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

  -- Counters are short-lived operational data. A bounded cleanup keeps this
  -- table from growing indefinitely without retaining content or recordings.
  delete from public.member_audio_usage_windows
  where window_started_at < v_window_started_at - interval '7 days';

  insert into public.member_audio_usage_windows (member_id, window_started_at)
  values (p_member_id, v_window_started_at)
  on conflict (member_id, window_started_at) do nothing;

  select *
  into v_usage
  from public.member_audio_usage_windows
  where member_id = p_member_id
    and window_started_at = v_window_started_at
  for update;

  v_retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from ((v_window_started_at + interval '1 minute') - clock_timestamp())))::integer
  );

  if p_capability = 'synthesis' then
    if v_usage.synthesis_requests + 1 > p_tts_request_limit
      or v_usage.synthesis_characters + p_tts_characters > p_tts_character_limit then
      return query select false, v_retry_after_seconds;
      return;
    end if;

    update public.member_audio_usage_windows
    set synthesis_requests = synthesis_requests + 1,
        synthesis_characters = synthesis_characters + p_tts_characters
    where member_id = p_member_id
      and window_started_at = v_window_started_at;
  else
    if v_usage.transcription_requests + 1 > p_stt_request_limit
      or v_usage.transcription_duration_ms + p_stt_duration_ms > p_stt_duration_limit_ms
      or v_usage.transcription_bytes + p_stt_bytes > p_stt_byte_limit then
      return query select false, v_retry_after_seconds;
      return;
    end if;

    update public.member_audio_usage_windows
    set transcription_requests = transcription_requests + 1,
        transcription_duration_ms = transcription_duration_ms + p_stt_duration_ms,
        transcription_bytes = transcription_bytes + p_stt_bytes
    where member_id = p_member_id
      and window_started_at = v_window_started_at;
  end if;

  return query select true, 0;
end;
$$;

revoke all on public.member_audio_usage_windows from public, anon, authenticated;
revoke all on function public.consume_member_audio_quota(
  uuid, text, integer, integer, bigint, integer, integer, integer, integer, bigint
) from public, anon, authenticated;
grant execute on function public.consume_member_audio_quota(
  uuid, text, integer, integer, bigint, integer, integer, integer, integer, bigint
) to service_role;

commit;
