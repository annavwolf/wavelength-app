"use client";

import { useEffect, useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, PsLabel, PsStatement, Team, Zone } from "@/types/database";

const LABEL_VALUE: Record<PsLabel, number> = {
  strongly_disagree: 1,
  disagree: 2,
  neutral: 3,
  agree: 4,
  strongly_agree: 5,
};

const ZONE_CONFIG: Record<
  Zone,
  { label: string; eyebrow: string; backgroundPositionY: number }
> = {
  1: { label: "Safe to Belong", eyebrow: "Zone 1", backgroundPositionY: 0 },
  2: { label: "Safe to Speak Freely", eyebrow: "Zone 2", backgroundPositionY: 50 },
  3: { label: "Safe to Innovate", eyebrow: "Zone 3", backgroundPositionY: 100 },
};

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
      className={`inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-full border-2 text-left transition-all ${
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

export default function PsDiagnosticStep({
  member,
  team,
  statements,
  supabase,
  ratings,
  onRatingsChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  statements: PsStatement[];
  supabase: AppSupabaseClient;
  ratings: Record<number, PsLabel>;
  onRatingsChange: (ratings: Record<number, PsLabel>) => void;
  onAdvance: () => void;
}) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const allRated = ratedCount === statements.length;

  return (
    <div className="relative">
      {([1, 2, 3] as Zone[]).map((zone) => {
        const zoneConfig = ZONE_CONFIG[zone];
        const zoneStatements = statements.filter((s) => s.zone === zone);

        return (
          <section
            key={zone}
            className="relative px-6 sm:px-10 lg:px-16 py-16 sm:py-20"
            style={{
              backgroundImage: "url(/ps-ocean.png)",
              backgroundSize: "100% 300%",
              backgroundPosition: `50% ${zoneConfig.backgroundPositionY}%`,
              backgroundRepeat: "no-repeat",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, rgba(6,18,28,0.5), rgba(6,18,28,0.2) 55%, rgba(6,18,28,0.05) 90%)",
              }}
            />

            <div className="relative z-10 max-w-2xl">
              <p className="text-xs uppercase tracking-widest text-white/60 mb-2">
                {zoneConfig.eyebrow}
              </p>
              <h2
                className="text-3xl italic text-white mb-10"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                {zoneConfig.label}
              </h2>

              <div className="space-y-6">
                {zoneStatements.map((statement) => (
                  <div
                    key={statement.statement_id}
                    className="rounded-2xl border border-white/20 bg-white/[0.16] backdrop-blur-md p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5"
                  >
                    <p
                      className="text-white text-base sm:text-lg leading-relaxed flex-1"
                      style={{ textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
                    >
                      {statement.statement_text}
                    </p>
                    <div className="flex flex-wrap sm:flex-col gap-2 sm:w-56 sm:flex-shrink-0">
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
            </div>
          </section>
        );
      })}

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
          onClick={onAdvance}
          disabled={!allRated}
          className="bg-[var(--color-purple)] text-white rounded-full px-8 py-3 font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
