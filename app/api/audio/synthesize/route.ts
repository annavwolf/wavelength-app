import { NextRequest, NextResponse } from "next/server";
import { OTIS_AUDIO_LIMITS } from "@/lib/otisAudio";
import {
  authorizeVoiceParticipant,
  consumeHostedAudioAllowance,
  getHostedAudioCapabilities,
  HostedAudioConfigurationError,
  HostedAudioProviderError,
  synthesizeWithDeepgram,
} from "@/lib/otisAudio.server";

export const runtime = "nodejs";

/** Capability probe used by the client-side provider. */
export async function GET(request: NextRequest) {
  const auth = await authorizeVoiceParticipant(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    { available: getHostedAudioCapabilities().synthesis },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeVoiceParticipant(request);
  if (!auth.ok) return auth.response;
  if (!getHostedAudioCapabilities().synthesis) {
    return NextResponse.json(
      { error: "Enhanced read-aloud is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ error: "Message is too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().replace(/\s+/g, " ") : "";
  if (!text) return NextResponse.json({ error: "A message is required." }, { status: 400 });
  if (text.length > OTIS_AUDIO_LIMITS.maxSynthesisCharacters) {
    return NextResponse.json({ error: "Message is too long to read aloud." }, { status: 413 });
  }
  // The client requests raw PCM only when it can play it progressively through
  // a running Web Audio context; otherwise it asks for a self-contained MP3.
  const format = body?.format === "pcm" ? "pcm" : "mp3";
  const allowance = await consumeHostedAudioAllowance(auth.memberId, {
    capability: "synthesis",
    synthesisCharacters: text.length,
  });
  if (allowance) return allowance;

  try {
    const upstream = await synthesizeWithDeepgram(text, format);
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof HostedAudioConfigurationError) {
      return NextResponse.json({ error: "Enhanced read-aloud is not configured." }, { status: 503 });
    }
    if (error instanceof HostedAudioProviderError) {
      console.error("[audio/synthesize] Deepgram request failed", error.upstreamStatus);
      return NextResponse.json({ error: "Enhanced read-aloud is temporarily unavailable." }, { status: 502 });
    }
    console.error("[audio/synthesize] Unexpected error", error);
    return NextResponse.json({ error: "Enhanced read-aloud is temporarily unavailable." }, { status: 502 });
  }
}
