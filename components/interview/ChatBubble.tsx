"use client";

import { useEffect, useRef, isValidElement } from "react";
import type { ReactNode } from "react";
import { speakText, queueSpeech } from "@/lib/speech";
import {
  useHostedAudioLoading,
  useHostedSpeechAvailable,
  useVoiceParticipantMemberId,
} from "@/components/interview/VoiceInputContext";

// Recursively pull the readable text out of arbitrary children so bubbles that
// contain interpolation ({name}) or markup (<strong>, <br/>) still auto-play
// and are clickable. <br/> etc. contribute nothing, which is fine for speech.
function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node.props as { children?: ReactNode }).children);
  return "";
}

// Otis's side of the conversation.
// Default: small Otis avatar on the left, left-aligned (Personal & Psych sections).
// Pass hideAvatar + centered for big-Otis steps (Introduction / Finish).
export default function ChatBubble({
  children,
  readAloud = false,
  speakText: speakTextProp,
  hideAvatar = false,
  centered = false,
}: {
  children: React.ReactNode;
  readAloud?: boolean;
  speakText?: string;
  hideAvatar?: boolean;
  centered?: boolean;
}) {
  // A Bubble can stay mounted while its conversational text changes (for
  // example, from a question to "Nice to meet you"). Track the text rather
  // than just a boolean so each distinct line is read once.
  const lastSpokenTextRef = useRef<string | null>(null);
  const hostedSpeechAvailable = useHostedSpeechAvailable();
  const hostedAudioLoading = useHostedAudioLoading();
  const memberId = useVoiceParticipantMemberId();
  const extracted = extractText(children).trim();
  const text = speakTextProp ?? (extracted || null);

  // Speak on mount (and whenever the text changes) as long as read-aloud is on.
  // Depending on `text` — not just `readAloud` — is what lets a bubble that
  // mounts *after* read-aloud was already enabled (e.g. the "Welcome back"
  // slide, which appears only after the read-aloud question) auto-play.
  useEffect(() => {
    if (!readAloud || !text) {
      lastSpokenTextRef.current = null;
      return;
    }
    // An opted-in participant may reach this bubble before the privacy-gated
    // capability probe has settled. Wait without marking it as spoken, so the
    // same line can use enhanced voice once it is ready (or safely fall back
    // once the probe says it is unavailable).
    if (hostedAudioLoading) return;
    if (lastSpokenTextRef.current === text) return;
    lastSpokenTextRef.current = text;
    // Enqueue rather than speak-and-cancel, so sibling bubbles that mount in the
    // same step are read in order instead of only the last one being heard.
    queueSpeech(text, 0.95, { allowHosted: hostedSpeechAvailable, memberId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostedAudioLoading, hostedSpeechAvailable, memberId, readAloud, text]);

  async function handleClick() {
    if (!readAloud || !text || hostedAudioLoading) return;
    // A deliberate replay interrupts the queue and reads just this bubble.
    await speakText(text, 0.95, { allowHosted: hostedSpeechAvailable, memberId });
  }

  return (
    <div
      className={`chat-bubble-in flex items-start gap-3 mb-4 ${centered ? "justify-center" : ""}`}
    >
      {!hideAvatar && (
        <img
          src="/octopus-logo.png"
          alt=""
          className="h-10 w-10 rounded flex-shrink-0 object-cover"
        />
      )}
      <div
        className={`card py-3 px-5 max-w-[520px] ${readAloud && text ? "cursor-pointer hover:ring-1 hover:ring-[var(--color-purple)]/30 transition-all" : ""}`}
        onClick={handleClick}
        title={readAloud && text ? (hostedAudioLoading ? "Checking enhanced voice…" : "Click to replay") : undefined}
      >
        <p>{children}</p>
      </div>
    </div>
  );
}
