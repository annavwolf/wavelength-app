"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";

const BUBBLES = [
  "Hello — I'm Otis. My purpose is to help teams understand what's getting in the way of working well together — and to open up honest conversations about how to change that.",
  "Today, I'd like to do that by discussing psychological safety, which has many benefits for team performance and well-being.",
  "By the way, in case you're wondering why I'm an octopus: did you know octopuses have 9 brains? One central brain, and eight semi-autonomous mini-brains, one in each arm.",
  "Ideal team sizes happen to be around 8 people. And like octopus arms, each person thinks, feels, and acts independently, yet is interconnected in shaping the collective mind of the team.",
];

const LAST_CHUNK = 4;

export default function LandingStep({
  readAloud,
  onReadAloudToggle,
  onAdvance,
}: {
  readAloud: boolean;
  onReadAloudToggle: () => void;
  onAdvance: () => void;
}) {
  const [chunk, setChunk] = useState(0);

  function next() {
    if (chunk < LAST_CHUNK) {
      cancelSpeech();
      setChunk((c) => c + 1);
    }
  }

  function back() {
    if (chunk > 0) {
      cancelSpeech();
      setChunk((c) => c - 1);
    }
  }

  function cancelSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  return (
    <div className="flex flex-col items-center pt-8">
      <img
        src="/octopus-logo.png"
        alt=""
        aria-hidden="true"
        className="otis-float h-32 w-auto mb-10"
      />

      <div className="w-full max-w-xl">
        {chunk === 0 && (
          <div className="text-center space-y-6">
            <p className="text-xl" style={{ fontFamily: "Playfair Display, serif" }}>
              Would you like me to read my messages aloud?
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (!readAloud) onReadAloudToggle();
                  next();
                }}
                className="btn-primary"
              >
                Yes, please
              </button>
              <button
                type="button"
                onClick={() => {
                  if (readAloud) onReadAloudToggle();
                  next();
                }}
                className="btn-secondary"
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {/* key={chunk} forces a fresh ChatBubble mount on every chunk change so
            the read-aloud effect fires and auto-reads the new text. */}
        {chunk >= 1 && chunk <= 4 && (
          <ChatBubble key={chunk} readAloud={readAloud} hideAvatar centered>
            {BUBBLES[chunk - 1]}
          </ChatBubble>
        )}
      </div>

      {chunk > 0 && (
        <div className="flex w-full max-w-xl items-center justify-between mt-10">
          <button
            type="button"
            onClick={back}
            aria-label="Previous"
            className="p-3 rounded-full border border-black/15 text-[var(--color-grey)] hover:text-[var(--color-ink)] transition-colors text-xl leading-none"
          >
            ←
          </button>

          {chunk < LAST_CHUNK ? (
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="p-3 rounded-full bg-[var(--color-navy)] text-white text-xl leading-none"
            >
              →
            </button>
          ) : (
            <button type="button" onClick={onAdvance} className="btn-primary">
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}
