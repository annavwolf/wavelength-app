"use client";

import { useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, PsLabel, PsStatement, Team, Zone } from "@/types/database";

const LABEL_VALUE: Record<PsLabel, number> = {
  green: 3,
  yellow: 2,
  red: 1,
};

const ZONE_CONFIG: Record<
  Zone,
  { label: string; eyebrow: string; backgroundPositionY: number }
> = {
  1: { label: "Safe to Belong", eyebrow: "Zone 1", backgroundPositionY: 0 },
  2: {
    label: "Safe to Speak Freely",
    eyebrow: "Zone 2",
    backgroundPositionY: 50,
  },
  3: { label: "Safe to Innovate", eyebrow: "Zone 3", backgroundPositionY: 100 },
};

const RATING_OPTIONS: { label: PsLabel; text: string; colorVar: string }[] = [
  { label: "green", text: "Sounds like my team", colorVar: "--color-safety-green" },
  { label: "yellow", text: "Sometimes / not sure", colorVar: "--color-safety-yellow" },
  { label: "red", text: "Doesn't sound like my team", colorVar: "--color-safety-red" },
];

function RatingButton({
  text,
  colorVar,
  selected,
  disabled,
  onClick,
}: {
  text: string;
  colorVar: string;
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
      className={`inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-full border-2 transition-all ${
        selected ? "scale-105 text-white" : "text-white/85"
      } disabled:opacity-60`}
      style={{
        borderColor: `var(${colorVar})`,
        backgroundColor: selected ? `var(${colorVar})` : "rgba(255,255,255,0.08)",
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
  rowIds,
  onRowIdsChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  statements: PsStatement[];
  supabase: AppSupabaseClient;
  ratings: Record<number, PsLabel>;
  onRatingsChange: (ratings: Record<number, PsLabel>) => void;
  rowIds: Record<number, string>;
  onRowIdsChange: (rowIds: Record<number, string>) => void;
  onAdvance: () => void;
}) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectRating(statement: PsStatement, label: PsLabel) {
    setSavingId(statement.statement_id);
    setError(null);

    const responseValue = LABEL_VALUE[label];
    const existingRowId = rowIds[statement.statement_id];

    if (existingRowId) {
      const { error: updateError } = await supabase
        .from("ps_responses")
        .update({ label, response_value: responseValue })
        .eq("id", existingRowId);

      if (updateError) {
        console.error("[interview/ps_diagnostic] failed to update rating:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
        setError("Something went wrong saving that. Please try again.");
        setSavingId(null);
        return;
      }

      onRatingsChange({ ...ratings, [statement.statement_id]: label });
      setSavingId(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("ps_responses")
      .insert({
        member_id: member.member_id,
        team_id: team.team_id,
        statement_id: statement.statement_id,
        zone: statement.zone,
        label,
        response_value: responseValue,
        round: 1,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      console.error("[interview/ps_diagnostic] failed to save rating:", {
        message: insertError?.message,
        details: insertError?.details,
        hint: insertError?.hint,
        code: insertError?.code,
      });
      setError("Something went wrong saving that. Please try again.");
      setSavingId(null);
      return;
    }

    onRowIdsChange({ ...rowIds, [statement.statement_id]: data.id });
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
                  "linear-gradient(to right, rgba(6,18,28,0.7), rgba(6,18,28,0.35) 50%, rgba(6,18,28,0.05) 85%)",
              }}
            />

            <div className="relative z-10 max-w-md">
              <p className="text-xs uppercase tracking-widest text-white/60 mb-2">
                {zoneConfig.eyebrow}
              </p>
              <h2
                className="text-3xl italic text-white mb-10"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                {zoneConfig.label}
              </h2>

              <div className="space-y-10">
                {zoneStatements.map((statement) => (
                  <div key={statement.statement_id}>
                    <p
                      className="text-white text-lg leading-relaxed mb-4"
                      style={{ textShadow: "0 1px 8px rgba(0,0,0,0.45)" }}
                    >
                      {statement.statement_text}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {RATING_OPTIONS.map((opt) => (
                        <RatingButton
                          key={opt.label}
                          text={opt.text}
                          colorVar={opt.colorVar}
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
