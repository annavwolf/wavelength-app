import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export type PilotAudioAllowance =
  | { capability: "synthesis"; synthesisCharacters: number }
  | { capability: "transcription"; transcriptionDurationMs: number; transcriptionBytes: number };

type PilotAudioQuotaLimits = {
  synthesisCharacters: number;
  transcriptionDurationMs: number;
  transcriptionBytes: number;
};

// These defaults keep an accidental or abusive beta from consuming a large
// shared provider balance. They are deliberately independent from the
// per-member, per-minute throttles in otisAudio.server.ts.
const PILOT_AUDIO_QUOTA_DEFAULTS: PilotAudioQuotaLimits = {
  // Sized for a deliberate 50-person beta, not a public unlimited service.
  // At the selected Deepgram Aura-2 model this is still a bounded fraction of
  // the new-account credit, and text-only participation remains available if
  // the allowance is ever reached.
  synthesisCharacters: 1_000_000,
  transcriptionDurationMs: 30_000_000, // 500 minutes
  transcriptionBytes: 512 * 1024 * 1024, // 512 MiB
};

function boundedServerInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(process.env[name]?.trim());
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

/**
 * Optional server-only monthly budget overrides. They never enter a browser
 * bundle and the SQL RPC independently enforces the same hard bounds.
 */
function getPilotAudioQuotaLimits(): PilotAudioQuotaLimits {
  return {
    synthesisCharacters: boundedServerInteger(
      "OTIS_AUDIO_PILOT_TTS_CHARACTERS_PER_MONTH",
      PILOT_AUDIO_QUOTA_DEFAULTS.synthesisCharacters,
      10_000,
      2_000_000
    ),
    transcriptionDurationMs: boundedServerInteger(
      "OTIS_AUDIO_PILOT_STT_DURATION_MS_PER_MONTH",
      PILOT_AUDIO_QUOTA_DEFAULTS.transcriptionDurationMs,
      60_000,
      120_000_000
    ),
    transcriptionBytes: boundedServerInteger(
      "OTIS_AUDIO_PILOT_STT_BYTES_PER_MONTH",
      PILOT_AUDIO_QUOTA_DEFAULTS.transcriptionBytes,
      1 * 1024 * 1024,
      4 * 1024 * 1024 * 1024
    ),
  };
}

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Voice service is temporarily unavailable. Please type your response instead." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

function exhaustedResponse(retryAfterSeconds: unknown): NextResponse {
  // The database knows the exact next-month boundary. Cap the HTTP header at
  // one day so an intermediary never treats this response as cacheable for a
  // whole month; the no-store directive is the important protection here.
  const retryAfter = Number.isInteger(retryAfterSeconds)
    ? Math.max(60, Math.min(86_400, Number(retryAfterSeconds)))
    : 86_400;

  return NextResponse.json(
    { error: "The beta voice allowance has been reached for this month. Please type your response instead." },
    {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) },
    }
  );
}

/**
 * Consume a shared monthly beta allowance before audio/text reaches an
 * external provider. The Supabase RPC updates one aggregate UTC-month row
 * under a database lock, so it remains reliable across concurrent serverless
 * instances. Any missing service key, network problem, or schema mismatch
 * fails closed and no provider request should be made by the caller.
 */
export async function consumePilotAudioAllowance(allowance: PilotAudioAllowance): Promise<NextResponse | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("[audio/pilot-quota] Service-role key is unavailable");
    return unavailableResponse();
  }

  const limits = getPilotAudioQuotaLimits();
  const isSynthesis = allowance.capability === "synthesis";

  try {
    const { data, error } = await supabaseAdmin.rpc("consume_pilot_audio_quota", {
      p_capability: allowance.capability,
      p_tts_characters: isSynthesis ? allowance.synthesisCharacters : 0,
      p_stt_duration_ms: isSynthesis ? 0 : allowance.transcriptionDurationMs,
      p_stt_bytes: isSynthesis ? 0 : allowance.transcriptionBytes,
      p_tts_character_limit: limits.synthesisCharacters,
      p_stt_duration_limit_ms: limits.transcriptionDurationMs,
      p_stt_byte_limit: limits.transcriptionBytes,
    });

    const outcome = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error || !outcome || typeof outcome.allowed !== "boolean") {
      // Avoid logging recordings, transcripts, request text, or participant
      // identifiers. The error code is enough to diagnose service health.
      console.error("[audio/pilot-quota] Unable to consume pilot allowance", error?.code || "invalid_result");
      return unavailableResponse();
    }

    return outcome.allowed ? null : exhaustedResponse(outcome.retry_after_seconds);
  } catch {
    console.error("[audio/pilot-quota] Pilot allowance RPC threw");
    return unavailableResponse();
  }
}
