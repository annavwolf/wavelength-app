"use client";

import { useEffect, useState } from "react";
import { SpeakerIcon } from "@/components/interview/icons";
import { HOSTED_SPEECH_UNAVAILABLE_EVENT } from "@/lib/speech";
import {
  useHostedAudioLoading,
  useHostedSpeechAvailable,
  useVoiceInputAllowed,
} from "@/components/interview/VoiceInputContext";

// Persistent, unobtrusive toggle — available throughout the interview.
// Hidden entirely if the browser doesn't support speech synthesis.
export default function ReadAloudToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  const [supported, setSupported] = useState(false);
  const [hostedPlaybackUnavailable, setHostedPlaybackUnavailable] = useState(false);
  const voiceInputAllowed = useVoiceInputAllowed();
  const hostedSpeechAvailable = useHostedSpeechAvailable();
  const hostedAudioLoading = useHostedAudioLoading();

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  useEffect(() => {
    const handleHostedSpeechUnavailable = () => {
      setHostedPlaybackUnavailable(true);
    };
    window.addEventListener(HOSTED_SPEECH_UNAVAILABLE_EVENT, handleHostedSpeechUnavailable);
    return () => {
      window.removeEventListener(HOSTED_SPEECH_UNAVAILABLE_EVENT, handleHostedSpeechUnavailable);
    };
  }, []);

  // A newly completed capability check is a fresh opportunity to use the
  // optional service. Do not keep a stale failure message after it recovers.
  useEffect(() => {
    if (hostedAudioLoading || hostedSpeechAvailable) {
      setHostedPlaybackUnavailable(false);
    }
  }, [hostedAudioLoading, hostedSpeechAvailable]);

  // A participant who chose voice input can use the hosted voice even on a
  // rare browser without native speech synthesis. On ordinary browsers the
  // system voice remains the no-config fallback.
  if (!supported && !hostedSpeechAvailable) return null;

  const voiceStatus = hostedAudioLoading
    ? "Checking enhanced voice…"
    : hostedPlaybackUnavailable
      ? "Enhanced voice did not start — using your device voice"
      : hostedSpeechAvailable
        ? "Enhanced voice ready"
        : "Using your device voice";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label={enabled ? "Turn off read aloud" : "Turn on read aloud"}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          enabled
            ? "bg-[var(--color-purple)] text-white border-[var(--color-purple)]"
            : "border-black/15 text-[var(--color-grey)]"
        }`}
      >
        <SpeakerIcon muted={!enabled} />
        {enabled ? "Reading aloud" : "Read aloud"}
      </button>
      {enabled && (
        <p
          className="max-w-40 text-right text-xs leading-tight text-[var(--color-grey)]"
          role="status"
          aria-live="polite"
        >
          {voiceStatus}
        </p>
      )}
      {enabled && voiceInputAllowed && hostedSpeechAvailable && (
        <span className="sr-only">Otis is using the optional enhanced voice.</span>
      )}
    </div>
  );
}
