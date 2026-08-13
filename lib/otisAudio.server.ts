import "server-only";

import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { OTIS_AUDIO_LIMITS, type HostedAudioCapabilities } from "@/lib/otisAudio";
import { consumePilotAudioAllowance } from "@/lib/audioPilotQuota";
import { requireInterviewAccess } from "@/lib/interviewAccess";
import { SESSION_COOKIE, INTERVIEW_SESSION_COOKIE } from "@/lib/memberSession";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

const DEEPGRAM_API_BASE = "https://api.deepgram.com/v1";
const PROVIDER_TIMEOUT_MS = 25_000;

// Short-lived in-process cache for voice authorization results.
// Each TTS/STT request would otherwise chain 3-4 sequential Supabase queries
// (token validity → member status → privacy acknowledgement) before Deepgram
// is even contacted. Caching the "this participant is authorized" verdict for
// 30 seconds removes that overhead on the hot path. Quota enforcement is NOT
// cached — it still runs on every request as the per-minute spend gate.
const _AUTH_CACHE_TTL_MS = 30_000;
type AuthCacheEntry = { memberId: string; expiresAt: number };
const _authCache = new Map<string, AuthCacheEntry>();

function _authCacheKey(request: NextRequest): string {
  const a = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const b = request.cookies.get(INTERVIEW_SESSION_COOKIE)?.value ?? "";
  return crypto.createHash("sha256").update(`${a}:${b}`).digest("hex");
}

function _getCachedAuth(key: string): string | null {
  const entry = _authCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { _authCache.delete(key); return null; }
  return entry.memberId;
}

function _setCachedAuth(key: string, memberId: string): void {
  // Evict stale entries to prevent unbounded growth in long-running processes.
  if (_authCache.size > 500) {
    const now = Date.now();
    _authCache.forEach((v, k) => { if (v.expiresAt < now) _authCache.delete(k); });
  }
  _authCache.set(key, { memberId, expiresAt: Date.now() + _AUTH_CACHE_TTL_MS });
}

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

type DeepgramConfig = {
  apiKey: string;
  transcriptionModel: string;
  synthesisModel: string;
};

function getDeepgramConfig(): DeepgramConfig | null {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    transcriptionModel: process.env.OTIS_DEEPGRAM_STT_MODEL?.trim() || "nova-3",
    // aura-2-* are the higher-quality voices. They take ~3.3s to fully generate
    // a short prompt at the REST /speak endpoint, but the first audio bytes
    // arrive in ~1s. We request raw PCM (see synthesizeWithDeepgram) so the
    // client can start playback progressively instead of waiting for the whole
    // file — keeping aura-2 quality without the full-generation delay.
    synthesisModel: process.env.OTIS_DEEPGRAM_TTS_MODEL?.trim() || "aura-2-arcas-en",
  };
}

/** Never expose an API key or provider configuration to the browser. */
export function getHostedAudioCapabilities(): HostedAudioCapabilities {
  const config = getDeepgramConfig();
  return {
    transcription: !!config,
    synthesis: !!config,
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
  const cacheKey = _authCacheKey(request);
  const cachedMemberId = _getCachedAuth(cacheKey);
  if (cachedMemberId) return { ok: true, memberId: cachedMemberId };

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

  _setCachedAuth(cacheKey, memberId);
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
 * or text reaches Deepgram. The database stores only aggregate counters,
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

    if (outcome.allowed) {
      // A shared monthly beta cap is the second, durable guard. It is only
      // reached after this participant's short rolling limit allows the
      // request, and it too fails closed before any provider request runs.
      return consumePilotAudioAllowance(allowance);
    }

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
export async function transcribeWithDeepgram({
  audio,
  languageCode,
}: {
  audio: Blob;
  languageCode?: string;
}): Promise<{ text: string }> {
  const config = getDeepgramConfig();
  if (!config) throw new HostedAudioConfigurationError("transcription");

  const url = new URL(`${DEEPGRAM_API_BASE}/listen`);
  url.searchParams.set("model", config.transcriptionModel);
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("mip_opt_out", "true");

  // Default to Deepgram's pre-recorded language detection instead of
  // hard-coding English. A future caller may provide a deliberate BCP-47 hint
  // (for example, a saved participant preference); otherwise Deepgram chooses
  // the most likely spoken language for this short, single-speaker clip.
  if (languageCode && /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(languageCode)) {
    url.searchParams.set("language", languageCode);
  } else {
    url.searchParams.set("detect_language", "true");
  }

  const contentType = audio.type.trim() || "application/octet-stream";
  const audioBytes = await audio.arrayBuffer();

  const request = providerAbortController();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${config.apiKey}`,
        "Content-Type": contentType,
        Accept: "application/json",
      },
      body: audioBytes,
      cache: "no-store",
      signal: request.signal,
    });
    if (!response.ok) throw new HostedAudioProviderError("transcription", response.status);

    const payload = (await response.json()) as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: unknown }> }> };
    };
    const text = typeof payload.results?.channels?.[0]?.alternatives?.[0]?.transcript === "string"
      ? payload.results.channels[0].alternatives[0].transcript.trim()
      : "";
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
/** Raw-PCM sample rate for the streaming path. Kept in sync with the client. */
export const OTIS_PCM_SAMPLE_RATE = 24_000;

export async function synthesizeWithDeepgram(
  text: string,
  format: "pcm" | "mp3" = "mp3"
): Promise<Response> {
  const config = getDeepgramConfig();
  if (!config) throw new HostedAudioConfigurationError("synthesis");

  const url = new URL(`${DEEPGRAM_API_BASE}/speak`);
  url.searchParams.set("model", config.synthesisModel);
  if (format === "pcm") {
    // Raw signed 16-bit PCM streams out of Deepgram in chunked transfer with no
    // container framing, so the browser can start playing the first chunk via
    // the Web Audio API before the full clip is generated. This is what lets a
    // higher-quality aura-2 voice feel responsive despite ~3s full-generation.
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", String(OTIS_PCM_SAMPLE_RATE));
    url.searchParams.set("container", "none");
  } else {
    // MP3 is broadly supported by Safari, Android, and desktop browsers. The
    // modest 48 kbit/s setting avoids an unnecessary mobile-data penalty while
    // remaining clear for short spoken prompts. Used when the client cannot
    // start a Web Audio context (no user gesture yet) and must buffer a whole
    // playable file instead.
    url.searchParams.set("encoding", "mp3");
    url.searchParams.set("bit_rate", "48000");
  }
  url.searchParams.set("mip_opt_out", "true");

  const request = providerAbortController();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: format === "pcm" ? "audio/l16" : "audio/mpeg",
      },
      body: JSON.stringify({ text }),
      cache: "no-store",
      signal: request.signal,
    });
    if (!response.ok || !response.body) {
      throw new HostedAudioProviderError("synthesis", response.status || 502);
    }

    const contentType = response.headers.get("content-type") || "";
    // Deepgram returns "audio/mpeg" for mp3 and "audio/l16;rate=24000" for PCM.
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
