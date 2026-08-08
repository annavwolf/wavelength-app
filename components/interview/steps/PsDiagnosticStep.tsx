"use client";

import { useEffect, useRef, useState } from "react";
import { loadVoices, pickMaleVoice } from "@/lib/speech";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, PsLabel, PsStatement, Team, Zone } from "@/types/database";

const TITLE =
  "Thinking about your team as a whole, how much do you agree with the following statements?";

const LABEL_VALUE: Record<PsLabel, number> = {
  strongly_disagree: 1,
  disagree: 2,
  neutral: 3,
  agree: 4,
  strongly_agree: 5,
};

// imagePositionY controls which part of the ocean image shows via object-position:
// 0% = surface (Zone 1), 50% = mid-water (Zone 2), 100% = deep (Zone 3).
const ZONE_CONFIG: Record<
  Zone,
  { label: string; eyebrow: string; imagePositionY: number }
> = {
  1: { label: "Safe to Belong", eyebrow: "Zone 1", imagePositionY: 0 },
  2: { label: "Safe to Speak Freely", eyebrow: "Zone 2", imagePositionY: 50 },
  3: { label: "Safe to Innovate", eyebrow: "Zone 3", imagePositionY: 100 },
};

// Ordered zone sequence for the one-zone-at-a-time flow.
const ZONE_ORDER: Zone[] = [1, 2, 3];

// Five-point agreement scale on a diverging red→amber→green ramp (reuses the
// app's severity palette). No longer green/yellow/red *semantics* — the colour
// is just a visual anchor for where on the agree/disagree scale each option sits.
const RATING_OPTIONS: { label: PsLabel; text: string; color: string }[] = [
  { label: "strongly_disagree", text: "Strongly disagree", color: "#A03A2E" },
  { label: "disagree", text: "Disagree", color: "#C97064" },
  { label: "neutral", text: "Neutral", color: "#D9A441" },
  { label: "agree", text: "Agree", color: "#7AA8A0" },
  { label: "strongly_agree", text: "Strongly agree", color: "#3E7C6A" },
];

function RatingButton({
  text,
  color,
  selected,
  disabled,
  onClick,
}: {
  text: string;
  color: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-full border-2 text-center transition-all whitespace-nowrap ${
        selected ? "scale-105 text-white" : "text-white/90"
      } disabled:opacity-60`}
      style={{
        borderColor: color,
        backgroundColor: selected ? color : "rgba(255,255,255,0.12)",
      }}
    >
      {selected && <span>✓</span>}
      {text}
    </button>
  );
}

// Small dot-stepper showing which zone the member is in, with a link back to
// the previous zone so they can revisit and change earlier answers.
function ZoneStepper({
  zoneIndex,
  onBack,
}: {
  zoneIndex: number;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 mt-10">
      {zoneIndex > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="text-white/70 text-sm underline hover:text-white transition-colors"
        >
          ← Previous zone
        </button>
      )}
      <div className="flex items-center gap-2">
        {ZONE_ORDER.map((z, i) => (
          <span
            key={z}
            className={`h-2 rounded-full transition-all ${
              i === zoneIndex ? "w-6 bg-white" : "w-2 bg-white/35"
            }`}
          />
        ))}
      </div>
      <span className="text-white/70 text-sm">
        Zone {zoneIndex + 1} of {ZONE_ORDER.length}
      </span>
    </div>
  );
}

export default function PsDiagnosticStep({
  member,
  team,
  statements,
  supabase,
  readAloud,
  ratings,
  onRatingsChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  statements: PsStatement[];
  supabase: AppSupabaseClient;
  readAloud: boolean;
  ratings: Record<number, PsLabel>;
  onRatingsChange: (ratings: Record<number, PsLabel>) => void;
  onAdvance: () => void;
}) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoneIndex, setZoneIndex] = useState(0);
  const hasSpokenRef = useRef(false);

  const currentZone = ZONE_ORDER[zoneIndex];
  const zoneConfig = ZONE_CONFIG[currentZone];
  const zoneStatements = statements.filter((s) => s.zone === currentZone);

  // Read the title aloud when readAloud is enabled (once, on first mount —
  // this is the page-level title, not per-zone content).
  useEffect(() => {
    if (!readAloud) return;
    if (hasSpokenRef.current) return;
    hasSpokenRef.current = true;
    async function speak() {
      const voices = await loadVoices();
      const voice = pickMaleVoice(voices);
      const utt = new SpeechSynthesisUtterance(TITLE);
      utt.rate = 0.95;
      if (voice) utt.voice = voice;
      window.speechSynthesis.speak(utt);
    }
    speak();
  }, [readAloud]);

  // Pre-populate saved ratings so a resuming member sees their previous answers.
  useEffect(() => {
    if (Object.keys(ratings).length > 0) return;
    supabase
      .from("ps_responses")
      .select("statement_id, label")
      .eq("member_id", member.member_id)
      .eq("round", 1)
      .then(({ data }) => {
        if (!data?.length) return;
        const populated: Record<number, PsLabel> = {};
        for (const row of data) populated[row.statement_id] = row.label as PsLabel;
        onRatingsChange(populated);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectRating(statement: PsStatement, label: PsLabel) {
    setSavingId(statement.statement_id);
    setError(null);

    // Check for an existing row so we update in place instead of inserting a duplicate.
    const { data: existing } = await supabase
      .from("ps_responses")
      .select("id")
      .eq("member_id", member.member_id)
      .eq("statement_id", statement.statement_id)
      .eq("round", 1)
      .maybeSingle();

    const saveError = existing
      ? (
          await supabase
            .from("ps_responses")
            .update({ label, response_value: LABEL_VALUE[label] })
            .eq("id", existing.id)
        ).error
      : (
          await supabase.from("ps_responses").insert({
            member_id: member.member_id,
            team_id: team.team_id,
            statement_id: statement.statement_id,
            zone: statement.zone,
            label,
            response_value: LABEL_VALUE[label],
            round: 1,
          })
        ).error;

    if (saveError) {
      console.error("[interview/ps_diagnostic] failed to save rating:", {
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        code: saveError.code,
      });
      setError(
        `That didn't save${saveError.code ? ` (${saveError.code})` : ""}. Please try again.`
      );
      setSavingId(null);
      return;
    }

    onRatingsChange({ ...ratings, [statement.statement_id]: label });
    setSavingId(null);
  }

  const ratedCount = statements.filter((s) => ratings[s.statement_id]).length;

  const zoneRatedCount = zoneStatements.filter((s) => ratings[s.statement_id]).length;
  const zoneAllRated = zoneRatedCount === zoneStatements.length;
  const isLastZone = zoneIndex === ZONE_ORDER.length - 1;

  function handleContinue() {
    if (!zoneAllRated) return;
    if (isLastZone) {
      onAdvance();
    } else {
      setZoneIndex((i) => i + 1);
      // Scroll back to top of the section on zone change so the member sees
      // the new zone's heading rather than staying scrolled mid-page.
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBackZone() {
    setZoneIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* Title — same Playfair style as PsDescentStep, on the page's light background */}
      <h2
        className="text-2xl sm:text-3xl px-6 sm:px-10 lg:px-16 pt-10 pb-6"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        {TITLE}
      </h2>

      {/* Only ONE zone section is ever rendered at a time, so only one instance
          of the ocean image is ever mounted — this is what prevents the image
          from appearing to repeat. object-fit:cover + object-position picks the
          right depth; no stretching, no cropping hack. */}
      <section className="relative px-6 sm:px-10 lg:px-16 py-16 sm:py-20 overflow-hidden">
        <img
          key={currentZone}
          src="/ps-ocean.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `50% ${zoneConfig.imagePositionY}%` }}
        />

        {/* Darkening gradient so text stays readable */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(6,18,28,0.65), rgba(6,18,28,0.35) 55%, rgba(6,18,28,0.15) 90%)",
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-white/70 mb-2">
            {zoneConfig.eyebrow}
          </p>
          <h2
            className="text-3xl italic text-white mb-10"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            {zoneConfig.label}
          </h2>

          {/* Statements stack vertically; the 5-point scale now runs
              horizontally beneath each statement instead of beside it —
              cuts the height each item takes up considerably. */}
          <div className="space-y-6">
            {zoneStatements.map((statement) => (
              <div
                key={statement.statement_id}
                className="rounded-2xl border border-white/20 bg-white/[0.16] backdrop-blur-md p-5 sm:p-6"
              >
                <p
                  className="text-white text-base sm:text-lg leading-relaxed mb-4"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
                >
                  {statement.statement_text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {RATING_OPTIONS.map((opt) => (
                    <RatingButton
                      key={opt.label}
                      text={opt.text}
                      color={opt.color}
                      selected={ratings[statement.statement_id] === opt.label}
                      disabled={savingId === statement.statement_id}
                      onClick={() => selectRating(statement, opt.label)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Zone progress + back-to-previous-zone link, beneath the items */}
          <ZoneStepper zoneIndex={zoneIndex} onBack={handleBackZone} />
        </div>
      </section>

      <div className="sticky bottom-0 z-20 bg-[#0b0f1a]/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between gap-4 shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
        <div className="text-sm text-white/80">
          {error ? (
            <span className="text-white">{error}</span>
          ) : (
            `${ratedCount} of ${statements.length} rated`
          )}
        </div>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!zoneAllRated}
          className="bg-[var(--color-purple)] text-white rounded-full px-8 py-3 font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLastZone ? "Continue" : "Next zone"}
        </button>
      </div>
    </div>
  );
}
