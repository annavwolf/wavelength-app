"use client";

import { useEffect, useRef } from "react";

// The three depth descriptions, verbatim, positioned over their matching
// colour band in the image. top/left are percentages of the image's
// natural height/width so the panels track the image content exactly
// regardless of rendered size.
const ZONES = [
  {
    key: "zone1",
    eyebrow: "Zone 1 · Safe to Belong",
    top: "4%",
    text: "Near the surface, it's about belonging. On a psychologically safe team, people feel welcome, respected, and comfortable just being themselves. You can show up as you are.",
  },
  {
    key: "zone2",
    eyebrow: "Zone 2 · Safe to Speak Freely",
    top: "40%",
    text: "As a team grows safer, you can go deeper. Here, it becomes possible to speak freely — to be candid and honest, to raise hard things, to disagree, to ask the obvious question. The things that often go unsaid can finally be said.",
  },
  {
    key: "zone3",
    eyebrow: "Zone 3 · Safe to Innovate",
    top: "65%",
    text: "And at the deepest level, members feel secure enough to truly innovate — to challenge how things are done, take real risks, and try things that might not work. This is where teams do their most extraordinary work. But you can only go this deep if it feels safe enough to get here.",
  },
];

export default function PsDescentStep({
  readAloud,
  onAdvance,
}: {
  readAloud: boolean;
  onAdvance: () => void;
}) {
  const hasSpokenRef = useRef(false);

  // Queue all three narrations in order when read-aloud is on. Cancel is
  // handled centrally by goToStep when leaving this step.
  useEffect(() => {
    if (!readAloud) return;
    if (hasSpokenRef.current) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    hasSpokenRef.current = true;
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith("en"));

    for (const zone of ZONES) {
      const utterance = new SpeechSynthesisUtterance(zone.text);
      utterance.rate = 0.95;
      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    }
  }, [readAloud]);

  return (
    <div>
      {/* Negative horizontal margin cancels the parent's px-6 so the image
          spans the full max-w-2xl column edge-to-edge — portrait image,
          natural 2:3 ratio, shown exactly once with no tiling or repeat. */}
      <div className="relative -mx-6">
        <img
          src="/ps-ocean.png"
          alt="Ocean cross-section showing three depths of psychological safety"
          className="w-full h-auto block"
        />

        {/* Gradient: darkens the left where text sits, fades to transparent
            on the right so the diver, octopus, and anglerfish stay visible. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(6,18,28,0.55), rgba(6,18,28,0.2) 50%, rgba(6,18,28,0) 72%)",
          }}
        />

        {ZONES.map((zone) => (
          <div
            key={zone.key}
            className="absolute"
            style={{ top: zone.top, left: "5%", width: "46%" }}
          >
            <div className="rounded-xl bg-white/[0.14] backdrop-blur-md border border-white/20 px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1.5">
                {zone.eyebrow}
              </p>
              <p
                className="text-white text-sm sm:text-base leading-relaxed"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}
              >
                {zone.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pb-4">
        <button type="button" onClick={onAdvance} className="btn-primary">
          Continue
        </button>
      </div>
    </div>
  );
}
