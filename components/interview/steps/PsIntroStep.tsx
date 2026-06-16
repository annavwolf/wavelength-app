"use client";

import { useEffect, useRef, useState } from "react";

type Segment = {
  key: string;
  eyebrow?: string;
  backgroundPositionY: number;
  text: string;
  question?: string;
};

// Verbatim copy — do not paraphrase. Each segment sits at the ocean depth
// it describes; backgroundPositionY slices the same ps-ocean.png the
// diagnostic step uses (0% = turquoise/surface, 50% = mid-blue, 100% =
// navy/deep), so the metaphor is introduced with the exact visual the
// member will see again during the diagnostic itself.
const SEGMENTS: Segment[] = [
  {
    key: "opening",
    backgroundPositionY: 0,
    text:
      "Before we look at how your team is doing, I want to show you what I mean by psychological safety. Think of your team like an ocean — and how deep into it you feel safe going together.",
  },
  {
    key: "zone1",
    eyebrow: "Zone 1 · Safe to Belong",
    backgroundPositionY: 0,
    text:
      "Near the surface, it's about belonging. On a psychologically safe team, people feel welcome, respected, and comfortable just being themselves. You can show up as you are.",
  },
  {
    key: "zone2",
    eyebrow: "Zone 2 · Safe to Speak Freely",
    backgroundPositionY: 50,
    text:
      "As a team grows safer, you can go deeper. Here, it becomes possible to speak freely — to be candid and honest, to raise hard things, to disagree, to ask the obvious question. The things that often go unsaid can finally be said.",
  },
  {
    key: "zone3",
    eyebrow: "Zone 3 · Safe to Innovate",
    backgroundPositionY: 100,
    text:
      "And at the deepest level, members feel secure enough to truly innovate — to challenge how things are done, take real risks, and try things that might not work. This is where teams do their most extraordinary work. But you can only go this deep if it feels safe enough to get here.",
  },
  {
    key: "closing",
    backgroundPositionY: 100,
    text:
      "Psychological safety is felt at the group level — it's about what's possible when the whole team is together. Research shows it's the strongest predictor of how well a team performs, and in virtual teams it's harder to build and easier to lose. So here's what I want to understand:",
    question: "How deep into this ocean does your team feel safe going right now?",
  },
];

export default function PsIntroStep({
  readAloud,
  onAdvance,
}: {
  readAloud: boolean;
  onAdvance: () => void;
}) {
  const [spokenKeys, setSpokenKeys] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Narrate each segment once, the first time it scrolls into view — not
  // on every pass, so scrolling back up to re-read stays calm and doesn't
  // re-trigger speech.
  useEffect(() => {
    if (!readAloud) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const key = entry.target.getAttribute("data-segment-key");
          if (!key || spokenKeys.has(key)) continue;

          const segment = SEGMENTS.find((s) => s.key === key);
          if (!segment) continue;

          const fullText = segment.question
            ? `${segment.text} ${segment.question}`
            : segment.text;
          const utterance = new SpeechSynthesisUtterance(fullText);
          utterance.rate = 0.95;
          const voices = window.speechSynthesis.getVoices();
          const englishVoice = voices.find((v) => v.lang.startsWith("en"));
          if (englishVoice) utterance.voice = englishVoice;
          window.speechSynthesis.speak(utterance);

          setSpokenKeys((prev) => new Set(prev).add(key));
        }
      },
      { threshold: 0.6 }
    );

    for (const segment of SEGMENTS) {
      const el = sectionRefs.current[segment.key];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [readAloud, spokenKeys]);

  return (
    <div>
      {SEGMENTS.map((segment) => (
        <section
          key={segment.key}
          ref={(el) => {
            sectionRefs.current[segment.key] = el;
          }}
          data-segment-key={segment.key}
          className="relative min-h-[85vh] flex items-center px-6 sm:px-10 lg:px-16 py-16"
          style={{
            backgroundImage: "url(/ps-ocean.png)",
            backgroundSize: "100% 300%",
            backgroundPosition: `50% ${segment.backgroundPositionY}%`,
            backgroundRepeat: "no-repeat",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(6,18,28,0.6), rgba(6,18,28,0.25) 55%, rgba(6,18,28,0.05) 90%)",
            }}
          />

          <div className="relative z-10 max-w-xl">
            {segment.eyebrow && (
              <p className="text-xs uppercase tracking-widest text-white/60 mb-4">
                {segment.eyebrow}
              </p>
            )}

            <p
              className="text-white text-lg sm:text-xl leading-relaxed"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.45)" }}
            >
              {segment.text}
            </p>

            {segment.question && (
              <p
                className="italic text-white text-2xl sm:text-3xl leading-snug mt-8"
                style={{
                  fontFamily: "Playfair Display, serif",
                  textShadow: "0 1px 10px rgba(0,0,0,0.5)",
                }}
              >
                {segment.question}
              </p>
            )}

            {segment.key === "closing" && (
              <button
                type="button"
                onClick={onAdvance}
                className="btn-primary mt-10"
              >
                Let&apos;s find out
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
