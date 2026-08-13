import { NextRequest, NextResponse } from "next/server";
import { OTIS_AUDIO_LIMITS, isSupportedRecordingMimeType } from "@/lib/otisAudio";
import {
  authorizeVoiceParticipant,
  consumeHostedAudioAllowance,
  getHostedAudioCapabilities,
  HostedAudioConfigurationError,
  HostedAudioProviderError,
  transcribeWithDeepgram,
} from "@/lib/otisAudio.server";

export const runtime = "nodejs";

/** Capability probe used by the client-side provider. */
export async function GET(request: NextRequest) {
  const auth = await authorizeVoiceParticipant(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      available: getHostedAudioCapabilities().transcription,
      max_duration_ms: OTIS_AUDIO_LIMITS.maxRecordingDurationMs,
      max_bytes: OTIS_AUDIO_LIMITS.maxRecordingBytes,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

/**
 * Reject arbitrary uploads even if a caller spoofs File.type. We accept the
 * container signatures produced by the browsers we support (WebM, Ogg, MP4,
 * WAV and MP3). This is not a media decoder; duration is constrained by both
 * the recorder timer and a required bounded duration value below.
 */
function looksLikeAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const isWebm = startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  const isOgg = startsWith(bytes, [0x4f, 0x67, 0x67, 0x53]);
  const isWav = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8);
  const isMp4 = startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4);
  const isMp3 = startsWith(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return isWebm || isOgg || isWav || isMp4 || isMp3;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeVoiceParticipant(request);
  if (!auth.ok) return auth.response;
  if (!getHostedAudioCapabilities().transcription) {
    return NextResponse.json(
      { error: "Enhanced voice input is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  // Multipart adds a small boundary overhead. Refuse known-oversized uploads
  // before parsing them into memory.
  if (Number.isFinite(contentLength) && contentLength > OTIS_AUDIO_LIMITS.maxRecordingBytes + 128 * 1024) {
    return NextResponse.json({ error: "Recording is too large. Please keep it under one minute." }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "A valid audio recording is required." }, { status: 400 });

  const durationValue = form.get("duration_ms");
  const durationMs = typeof durationValue === "string" && /^\d{1,6}$/.test(durationValue)
    ? Number(durationValue)
    : Number.NaN;
  if (
    !Number.isInteger(durationMs) ||
    durationMs < OTIS_AUDIO_LIMITS.minRecordingDurationMs ||
    durationMs > OTIS_AUDIO_LIMITS.maxRecordingDurationMs
  ) {
    return NextResponse.json({ error: "Recording duration must be between one half-second and one minute." }, { status: 400 });
  }

  const candidate = form.get("audio");
  if (!(candidate instanceof Blob)) {
    return NextResponse.json({ error: "A valid audio recording is required." }, { status: 400 });
  }
  if (!isSupportedRecordingMimeType(candidate.type)) {
    return NextResponse.json({ error: "This audio format is not supported." }, { status: 415 });
  }
  if (!candidate.size || candidate.size > OTIS_AUDIO_LIMITS.maxRecordingBytes) {
    return NextResponse.json({ error: "Recording is too large. Please keep it under one minute." }, { status: 413 });
  }

  const bytes = new Uint8Array(await candidate.arrayBuffer());
  if (!looksLikeAudio(bytes)) {
    return NextResponse.json({ error: "This recording could not be verified as audio." }, { status: 415 });
  }

  // Re-wrap the exact inspected bytes. Nothing is persisted: this Blob exists
  // only for the outbound request and becomes collectible afterwards.
  const audio = new Blob([bytes], { type: candidate.type });
  const allowance = await consumeHostedAudioAllowance(auth.memberId, {
    capability: "transcription",
    transcriptionDurationMs: durationMs,
    transcriptionBytes: candidate.size,
  });
  if (allowance) return allowance;

  try {
    const { text } = await transcribeWithDeepgram({ audio });
    return NextResponse.json(
      { text },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof HostedAudioConfigurationError) {
      return NextResponse.json({ error: "Enhanced voice input is not configured." }, { status: 503 });
    }
    if (error instanceof HostedAudioProviderError) {
      console.error("[audio/transcribe] Deepgram request failed", error.upstreamStatus);
      return NextResponse.json({ error: "Voice transcription is temporarily unavailable." }, { status: 502 });
    }
    console.error("[audio/transcribe] Unexpected error", error);
    return NextResponse.json({ error: "Voice transcription is temporarily unavailable." }, { status: 502 });
  }
}
