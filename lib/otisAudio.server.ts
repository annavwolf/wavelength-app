import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { OTIS_AUDIO_LIMITS, type HostedAudioCapabilities } from "@/lib/otisAudio";
import { requireInterviewAccess } from "@/lib/interviewAccess";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const PROVIDER_TIMEOUT_MS = 25_000;

type VoiceParticipantAuthorization =
  | { ok: true; memberId: string }
  | { ok: false; response: NextResponse };

type HostedAudioAllowance =
  | { capability: "synthesis"; synthesisCharacters: number }
  | { capability: "transcription"; transcriptionDurationMs: number; transcriptionBytes: number };

type AudioQuotaLimits = {
  synthesisRequests: number;
  synthesisCharacters: number;
  transcriptionRequests: number;
  transcriptionDurationMs: number;
  transcriptionBytes: number;
};

const AUDIO_QUOTA_DEFAULTS: AudioQuotaLimits = {
  synthesisRequests: 20,
  synthesisCharacters: 20_000,
  transcriptionRequests: 6,
  transcriptionDurationMs: 120_000,
  // A short, normal speech recording is usually far below this. Keeping the
  // per-minute byte budget below the single-upload cap is intentional: the
  // browser-reported duration is UX metadata, not a billing boundary.
  transcriptionBytes: 1 * 1024 * 1024,
};

function boundedServerInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(process.env[name]?.trim());
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

/**
 * These optional server-only overrides remain deliberately bounded in both
 * TypeScript and the SQL RPC. They must not be prefixed NEXT_PUBLIC_.
 */
function getAudioQuotaLimits(): AudioQuotaLimits {
  return {
    synthesisRequests: boundedServerInteger(
      "OTIS_AUDIO_TTS_REQUESTS_PER_MINUTE",
      AUDIO_QUOTA_DEFAULTS.synthesisRequests,
      1,
      60
    ),
    synthesisCharacters: boundedServerInteger(
      "OTIS_AUDIO_TTS_CHARACTERS_PER_MINUTE",
      AUDIO_QUOTA_DEFAULTS.synthesisCharacters,
      500,
      60_000
    ),
    transcriptionRequests: boundedServerInteger(
      "OTIS_AUDIO_STT_REQUESTS_PER_MINUTE",
      AUDIO_QUOTA_DEFAULTS.transcriptionRequests,
      1,
      20
    ),
    transcriptionDurationMs: boundedServerInteger(
      "OTIS_AUDIO_STT_DURATION_MS_PER_MINUTE",
      AUDIO_QUOTA_DEFAULTS.transcriptionDurationMs,
      500,
      300_000
    ),
    transcriptionBytes: boundedServerInteger(
      "OTIS_AUDIO_STT_BYTES_PER_MINUTE",
      AUDIO_QUOTA_DEFAULTS.transcriptionBytes,
      64 * 1024,
      4 * 1024 * 1024
    ),
  };
}

type ElevenLabsConfig = {
  apiKey: string;
  voiceId?: string;
  transcriptionModel: string;
  synthesisModel: string;
};

function getElevenLabsConfig(): ElevenLabsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    voiceId: process.env.OTIS_ELEVENLABS_VOICE_ID?.trim() || undefined,
    transcriptionModel: process.env.OTIS_ELEVENLABS_STT_MODEL?.trim() || "scribe_v2",
    synthesisModel: process.env.OTIS_ELEVENLABS_TTS_MODEL?.trim() || "eleven_flash_v2_5",
  };
}

/** Never expose an API key or provider configuration to the browser. */
export function getHostedAudioCapabilities(): HostedAudioCapabilities {
  const config = getElevenLabsConfig();
  return {
    transcription: !!config,
    synthesis: !!config?.voiceId,
  };
}

/**
 * Authorize a hosted-audio request before its text or audio is forwarded to a
 * provider. Phase 3 uses the signed member cookie; Phase 1 uses the short
 * HttpOnly interview cookie created by the opaque /i/[token] invite entry.
 *
 * A cookie holder may not nominate another participant. A bare/unrecognised
 * UUID is never enough: the participant must exist, be active, have accepted
 * the current notice and have explicitly enabled voice input.
 */
export async function authorizeVoiceParticipant(request: NextRequest): Promise<VoiceParticipantAuthorization> {
  const requestedMemberId = request.nextUrl.searchParams.get("member_id");
  const access = await requireInterviewAccess(request, {
    ...(requestedMemberId ? { memberId: requestedMemberId } : {}),
  });
  if (!access.ok) return access;
  const memberId = access.value.memberId;

  const [{ data: member, error: memberError }, { data: acknowledgement, error: acknowledgementError }] = await Promise.all([
    supabaseAdmin.from("members").select("member_id, status").eq("member_id", memberId).maybeSingle(),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("acknowledged_at, privacy_notice_version, voice_input_opt_in")
      .eq("member_id", memberId)
      .maybeSingle(),
  ]);

  if (memberError || acknowledgementError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unable to verify your voice setting." }, {
        status: 500,
      }),
    };
  }
  if (!member) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Participant not found." }, {
        status: 404,
      }),
    };
  }
  if (member.status === "opted_out") {
    return {
      ok: false,
      response: NextResponse.json({ error: "This participant has withdrawn." }, {
        status: 410,
      }),
    };
  }
  if (!acknowledgement?.acknowledged_at || acknowledgement.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Please acknowledge the current privacy information before continuing." }, {
        status: 409,
      }),
    };
  }
  if (acknowledgement.voice_input_opt_in !== true) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Voice input is not enabled in your privacy settings.", code: "voice_input_not_enabled" }, {
        status: 403,
      }),
    };
  }

  return { ok: true, memberId };
}

function audioQuotaUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Voice service is temporarily unavailable. Please type your response instead." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Atomically consume a Supabase-backed, per-member minute budget before audio
 * or text reaches ElevenLabs. The database stores only aggregate counters,
 * never recordings, transcripts, or message text. A quota/RPC failure is
 * deliberately fail-closed so a serverless retry cannot spend provider credit.
 */
export async function consumeHostedAudioAllowance(
  memberId: string,
  allowance: HostedAudioAllowance
): Promise<NextResponse | null> {
  const limits = getAudioQuotaLimits();
  const isSynthesis = allowance.capability === "synthesis";

  try {
    const { data, error } = await supabaseAdmin.rpc("consume_member_audio_quota", {
      p_member_id: memberId,
      p_capability: allowance.capability,
      p_tts_characters: isSynthesis ? allowance.synthesisCharacters : 0,
      p_stt_duration_ms: isSynthesis ? 0 : allowance.transcriptionDurationMs,
      p_stt_bytes: isSynthesis ? 0 : allowance.transcriptionBytes,
      p_tts_request_limit: limits.synthesisRequests,
      p_tts_character_limit: limits.synthesisCharacters,
      p_stt_request_limit: limits.transcriptionRequests,
      p_stt_duration_limit_ms: limits.transcriptionDurationMs,
      p_stt_byte_limit: limits.transcriptionBytes,
    });

    const outcome = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error || !outcome || typeof outcome.allowed !== "boolean") {
      // Avoid logging a participant identifier, transcript, or audio metadata.
      console.error("[audio/quota] Unable to consume hosted-audio allowance", error?.code || "invalid_result");
      return audioQuotaUnavailableResponse();
    }

    if (outcome.allowed) return null;

    const retryAfter = Number.isInteger(outcome.retry_after_seconds)
      ? Math.max(1, Math.min(60, outcome.retry_after_seconds))
      : 60;
    return NextResponse.json(
      {
        error: isSynthesis
          ? "Please wait a moment before requesting more read-aloud audio."
          : "Please wait a moment before sending another recording.",
      },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) } }
    );
  } catch {
    // Network, schema, and provider-adjacent failures all deny the request.
    console.error("[audio/quota] Hosted-audio allowance RPC threw");
    return audioQuotaUnavailableResponse();
  }
}

function providerAbortController() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

/**
 * Transcribe a short, validated in-memory audio clip. This function never
 * persists the clip and intentionally does not return upstream error text.
 */
export async function transcribeWithElevenLabs({
  audio,
  filename,
  languageCode,
}: {
  audio: Blob;
  filename: string;
  languageCode?: string;
}): Promise<{ text: string }> {
  const config = getElevenLabsConfig();
  if (!config) throw new HostedAudioConfigurationError("transcription");

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model_id", config.transcriptionModel);
  // Let Scribe detect the spoken language unless a future caller has a
  // deliberate, validated language hint. Hard-coding English made the voice
  // path needlessly worse for multilingual teams.
  if (languageCode && /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(languageCode)) {
    form.append("language_code", languageCode);
  }
  form.append("diarize", "false");
  form.append("tag_audio_events", "false");

  const request = providerAbortController();
  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": config.apiKey },
      body: form,
      cache: "no-store",
      signal: request.signal,
    });
    if (!response.ok) throw new HostedAudioProviderError("transcription", response.status);

    const payload = (await response.json()) as { text?: unknown };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) throw new HostedAudioProviderError("transcription", 422);

    return { text: text.slice(0, OTIS_AUDIO_LIMITS.maxSynthesisCharacters * 2) };
  } catch (error) {
    if (error instanceof HostedAudioConfigurationError || error instanceof HostedAudioProviderError) {
      throw error;
    }
    throw new HostedAudioProviderError("transcription", 502);
  } finally {
    request.clear();
  }
}

/**
 * Generate spoken audio for an Otis message. The caller proxies the stream
 * straight to the participant; the generated audio is never stored by Otis.
 */
export async function synthesizeWithElevenLabs(text: string): Promise<Response> {
  const config = getElevenLabsConfig();
  if (!config?.voiceId) throw new HostedAudioConfigurationError("synthesis");

  const request = providerAbortController();
  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": config.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: config.synthesisModel,
        }),
        cache: "no-store",
        signal: request.signal,
      }
    );
    if (!response.ok || !response.body) {
      throw new HostedAudioProviderError("synthesis", response.status || 502);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("audio/")) {
      throw new HostedAudioProviderError("synthesis", 502);
    }
    return response;
  } catch (error) {
    if (error instanceof HostedAudioConfigurationError || error instanceof HostedAudioProviderError) {
      throw error;
    }
    throw new HostedAudioProviderError("synthesis", 502);
  } finally {
    request.clear();
  }
}

export class HostedAudioConfigurationError extends Error {
  constructor(public readonly capability: keyof HostedAudioCapabilities) {
    super(`Hosted ${capability} is not configured.`);
    this.name = "HostedAudioConfigurationError";
  }
}

export class HostedAudioProviderError extends Error {
  constructor(
    public readonly capability: keyof HostedAudioCapabilities,
    public readonly upstreamStatus: number
  ) {
    super(`Hosted ${capability} request failed.`);
    this.name = "HostedAudioProviderError";
  }
}
