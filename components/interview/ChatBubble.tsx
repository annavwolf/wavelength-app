"use client";

import { useEffect } from "react";

// Wavelength's side of the conversation — small octopus avatar beside a
// calm message bubble. Member responses (inputs/buttons) render below,
// outside this component.
export default function ChatBubble({
  children,
  readAloud = false,
}: {
  children: React.ReactNode;
  readAloud?: boolean;
}) {
  useEffect(() => {
    if (!readAloud) return;
    if (typeof children !== "string") return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(children);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;

    window.speechSynthesis.speak(utterance);
    // Only re-run when the toggle flips (or this bubble mounts fresh on a
    // step change) — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readAloud]);

  return (
    <div className="chat-bubble-in flex items-start gap-3 mb-4">
      <img
        src="/octopus-logo.png"
        alt=""
        className="h-10 w-10 rounded flex-shrink-0 object-cover"
      />
      <div className="card py-3 px-5 max-w-[480px]">
        <p>{children}</p>
      </div>
    </div>
  );
}
