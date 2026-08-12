"use client";

import { useEffect, useRef } from "react";
import { loadVoices, pickMaleVoice } from "@/lib/speech";

const TITLE = "Think of how safe you'd feel exploring an ocean with your team.";

const ZONES = [
  {
    key: "zone1",
    eyebrow: "Zone 1 · Safe to Belong",
    top: "3%",
    text: "Near the surface, it's about belonging. On a psychologically safe team, people feel welcome, respected, and comfortable just being themselves. You can show up as you are.",
  },
  {
    key: "zone2",
    eyebrow: "Zone 2 · Safe to Speak Freely",
    top: "37%",
    text: "As a team grows safer, you can go deeper. Here, it becomes possible to speak freely — to be candid and honest, to raise hard things, to disagree, to ask the obvious question. The things that often go unsaid can finally be said.",
  },
  {
    key: "zone3",
    eyebrow: "Zone 3 · Safe to Innovate",
    top: "73%",
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

  useEffect(() => {
    if (!readAloud) return;
    if (hasSpokenRef.current) return;
    hasSpokenRef.current = true;

    async function speak() {
      const voices = await loadVoices();
      const voice = pickMaleVoice(voices);

      const texts = [TITLE, ...ZONES.map((z) => z.text)];
      for (const t of texts) {
        const utt = new SpeechSynthesisUtterance(t);
        utt.rate = 0.95;
        if (voice) utt.voice = voice;
        window.speechSynthesis.speak(utt);
      }
    }
    speak();
  }, [readAloud]);

  return (
    <div>
      <h2
        className="text-2xl mb-6"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        {TITLE}
      </h2>

      <div className="relative -mx-6">
        <img
          src="/ps-ocean.png"
          alt="Ocean cross-section showing three depths of psychological safety"
          className="w-full h-auto block"
        />

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
            style={{ top: zone.top, left: "5%", width: "48%" }}
          >
            <div className="rounded-xl bg-white/[0.16] backdrop-blur-md border border-white/25 px-5 py-4">
              <p className="text-sm sm:text-base uppercase tracking-wide text-white/80 mb-2">
                {zone.eyebrow}
              </p>
              <p
                className="text-white text-base sm:text-lg leading-relaxed"
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
