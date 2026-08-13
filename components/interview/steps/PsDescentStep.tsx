"use client";

import { useEffect, useRef } from "react";
import { speakText } from "@/lib/speech";
import { useHostedSpeechAvailable, useVoiceParticipantMemberId } from "@/components/interview/VoiceInputContext";

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
  const hostedSpeechAvailable = useHostedSpeechAvailable();
  const memberId = useVoiceParticipantMemberId();

  useEffect(() => {
    if (!readAloud) return;
    if (hasSpokenRef.current) return;
    hasSpokenRef.current = true;

    // The provider synthesizes one complete message, preventing multiple
    // concurrent requests from racing through the ocean explanation.
    void speakText([TITLE, ...ZONES.map((zone) => zone.text)].join(" "), 0.95, {
      allowHosted: hostedSpeechAvailable,
      memberId,
    });
  }, [readAloud, hostedSpeechAvailable, memberId]);

  return (
    <div>
      <h2
        className="text-2xl mb-6"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        {TITLE}
      </h2>

      <div className="relative -mx-4 overflow-hidden bg-[#092332] px-4 py-5 sm:-mx-6 sm:px-0 sm:py-0">
        <img
          src="/ps-ocean.png"
          alt="Ocean cross-section showing three depths of psychological safety"
          className="absolute inset-0 h-full w-full object-cover opacity-70 sm:relative sm:h-auto sm:opacity-100"
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(6,18,28,0.55), rgba(6,18,28,0.2) 50%, rgba(6,18,28,0) 72%)",
          }}
        />

        <div className="relative z-10 flex flex-col gap-5 sm:absolute sm:inset-0 sm:block">
          {ZONES.map((zone) => (
            <div
              key={zone.key}
              className="static w-full sm:absolute sm:left-[5%] sm:w-[48%]"
              style={{ top: zone.top }}
            >
              <div className="rounded-xl border border-white/25 bg-white/[0.16] px-5 py-5 backdrop-blur-md sm:py-4">
                <p className="mb-2 text-[13px] uppercase tracking-wide text-white/85 sm:text-base">
                  {zone.eyebrow}
                </p>
                <p
                  className="text-[17px] leading-relaxed text-white sm:text-lg"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}
                >
                  {zone.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 pb-4">
        <button type="button" onClick={onAdvance} className="btn-primary">
          Continue
        </button>
      </div>
    </div>
  );
}
