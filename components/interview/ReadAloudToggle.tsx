"use client";

import { useEffect, useState } from "react";
import { SpeakerIcon } from "@/components/interview/icons";

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

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn off read aloud" : "Turn on read aloud"}
      className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors ${
        enabled
          ? "bg-[var(--color-purple)] text-white border-[var(--color-purple)]"
          : "border-black/15 text-[var(--color-grey)]"
      }`}
    >
      <SpeakerIcon muted={!enabled} />
      {enabled ? "Reading aloud" : "Read aloud"}
    </button>
  );
}
