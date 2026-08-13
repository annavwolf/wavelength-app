"use client";

import { useEffect, useState } from "react";
import { SpeakerIcon } from "@/components/interview/icons";
import { useHostedSpeechAvailable, useVoiceInputAllowed } from "@/components/interview/VoiceInputContext";

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
  const voiceInputAllowed = useVoiceInputAllowed();
  const hostedSpeechAvailable = useHostedSpeechAvailable();

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  // A participant who chose voice input can use the hosted voice even on a
  // rare browser without native speech synthesis. On ordinary browsers the
  // system voice remains the no-config fallback.
  if (!supported && !hostedSpeechAvailable) return null;

  return (
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
      {enabled && hostedSpeechAvailable && voiceInputAllowed && (
        <span className="sr-only">with enhanced voice</span>
      )}
    </button>
  );
}
