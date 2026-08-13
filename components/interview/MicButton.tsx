"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon } from "@/components/interview/icons";
import {
  useHostedVoiceInputAvailable,
  useVoiceInputAllowed,
} from "@/components/interview/VoiceInputContext";
import {
  canRecordAudioInBrowser,
  OTIS_AUDIO_LIMITS,
  preferredRecordingMimeType,
} from "@/lib/otisAudio";

function messageForRecorderError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was not allowed. You can still type your answer.";
  }
  if (name === "NotFoundError") return "We couldn't find a microphone. You can still type your answer.";
  return "We couldn't use the microphone just now. You can still type your answer.";
}

type Props = {
  onResult: (transcript: string) => void;
};

/**
 * Voice input deliberately has no browser-recognition fallback. A browser's
 * non-standard recognition API can send audio to an undisclosed provider,
 * whereas this beta's consent specifies ElevenLabs. When enhanced audio isn't
 * configured, people simply keep the reliable text input they already have.
 */
export default function MicButton({ onResult }: Props) {
  const voiceInputAllowed = useVoiceInputAllowed();
  const hostedTranscription = useHostedVoiceInputAvailable();
  const [recorderSupported, setRecorderSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const supported = voiceInputAllowed && hostedTranscription && recorderSupported && !unavailable;

  useEffect(() => {
    setRecorderSupported(canRecordAudioInBrowser());
  }, []);

  function clearMaxDurationTimer() {
    if (maxDurationTimerRef.current !== null) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopRecorder() {
    clearMaxDurationTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearMaxDurationTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseStream();
    };
  }, []);

  async function sendForTranscription(blob: Blob, durationMs: number) {
    if (!blob.size || blob.size > OTIS_AUDIO_LIMITS.maxRecordingBytes) {
      setError("That recording is too large. Please keep it under one minute.");
      return;
    }
    if (durationMs < OTIS_AUDIO_LIMITS.minRecordingDurationMs) {
      setError("Hold the microphone a little longer, then try again.");
      return;
    }

    setTranscribing(true);
    setError(null);
    const form = new FormData();
    form.append("audio", blob, `otis-answer.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
    form.append("duration_ms", String(Math.min(durationMs, OTIS_AUDIO_LIMITS.maxRecordingDurationMs)));

    try {
      const response = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.text !== "string") {
        if (response.status === 502 || response.status === 503) setUnavailable(true);
        setError(data.error ?? "We couldn't turn that into text. You can still type your answer.");
        return;
      }
      const transcript = data.text.trim();
      if (transcript) onResult(transcript);
      else setError("I didn't catch any speech. Please try again or type your answer.");
    } catch {
      setUnavailable(true);
      setError("Voice transcription is temporarily unavailable. You can still type your answer.");
    } finally {
      if (mountedRef.current) setTranscribing(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const mimeType = preferredRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        if (mountedRef.current) setError("We couldn't use the microphone just now. You can still type your answer.");
      };
      recorder.onstop = () => {
        clearMaxDurationTimer();
        if (!mountedRef.current) {
          recorderRef.current = null;
          recordingStartedAtRef.current = null;
          releaseStream();
          return;
        }
        const startedAt = recordingStartedAtRef.current;
        const durationMs = startedAt ? Date.now() - startedAt : 0;
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        recorderRef.current = null;
        recordingStartedAtRef.current = null;
        releaseStream();
        setListening(false);
        void sendForTranscription(blob, durationMs);
      };

      recorder.start(250);
      setListening(true);
      maxDurationTimerRef.current = window.setTimeout(() => stopRecorder(), OTIS_AUDIO_LIMITS.maxRecordingDurationMs);
    } catch (caught) {
      releaseStream();
      setError(messageForRecorderError(caught));
    }
  }

  function toggleListening() {
    if (transcribing) return;
    if (listening) {
      stopRecorder();
      return;
    }
    void startRecording();
  }

  // On a provider outage keep the explanatory error visible, even though the
  // microphone itself is disabled for the remainder of this page visit.
  if (!supported && !error) return null;

  const status = transcribing
    ? "Transcribing…"
    : listening
      ? "Listening — tap when you’re done"
      : null;

  return (
    <span className="relative inline-flex items-center">
      {(status || error) && (
        <span className={`pointer-events-none absolute bottom-full right-0 mb-1 w-56 text-right text-xs leading-snug ${error ? "text-red-600" : "text-[var(--color-purple)]"}`} role={error ? "alert" : "status"}>
          {error ?? status}
        </span>
      )}
      {supported && (
        <button
          type="button"
          onClick={toggleListening}
          disabled={transcribing}
          aria-pressed={listening}
          aria-label={transcribing ? "Transcribing your answer" : listening ? "Stop recording and transcribe" : "Speak your answer"}
          title={listening ? "Tap when you're done" : "Speak your answer"}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-purple)] disabled:cursor-wait disabled:opacity-60 ${
            listening
              ? "bg-[var(--color-purple)] text-white"
              : "text-[var(--color-grey)] hover:bg-[var(--color-purple)]/10 hover:text-[var(--color-ink)]"
          }`}
        >
          <MicIcon />
        </button>
      )}
    </span>
  );
}
