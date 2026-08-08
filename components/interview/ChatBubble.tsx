"use client";

import { useEffect, useRef, isValidElement } from "react";
import type { ReactNode } from "react";
import { speakText, cancelSpeech, loadVoices, pickMaleVoice } from "@/lib/speech";

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
  const hasSpokenRef = useRef(false);
  const extracted = extractText(children).trim();
  const text = speakTextProp ?? (extracted || null);

  // Speak on mount (and whenever the text changes) as long as read-aloud is on.
  // Depending on `text` — not just `readAloud` — is what lets a bubble that
  // mounts *after* read-aloud was already enabled (e.g. the "Welcome back"
  // slide, which appears only after the read-aloud question) auto-play.
  useEffect(() => {
    if (!readAloud || !text) {
      hasSpokenRef.current = false;
      return;
    }
    if (hasSpokenRef.current) return;
    hasSpokenRef.current = true;
    speakText(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readAloud, text]);

  async function handleClick() {
    if (!readAloud || !text) return;
    cancelSpeech();
    const voices = await loadVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    const voice = pickMaleVoice(voices);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
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
        title={readAloud && text ? "Click to replay" : undefined}
      >
        <p>{children}</p>
      </div>
    </div>
  );
}
