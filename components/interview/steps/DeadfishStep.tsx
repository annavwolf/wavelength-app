"use client";

import { useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Fish, Member, SeverityLabel, Team } from "@/types/database";

// 4-point severity scale — rated for each fish the team is being assessed on.
const SEVERITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Not really us" },
  { value: 2, label: "Occasionally" },
  { value: 3, label: "A real pattern" },
  { value: 4, label: "A big problem" },
];

function SeverityButton({
  value,
  label,
  selected,
  disabled,
  onClick,
}: {
  value: number;
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  // Colour ramps from neutral → warm amber → coral as severity rises.
  const color =
    value === 1
      ? "#7AA8A0"
      : value === 2
      ? "#D9A441"
      : value === 3
      ? "#C97064"
      : "#A03A2E";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`text-sm px-3 py-2 rounded-full border-2 transition-all flex items-center gap-1.5 ${
        selected ? "text-white scale-105" : "text-[var(--color-grey)]"
      } disabled:opacity-60`}
      style={{
        borderColor: color,
        backgroundColor: selected ? color : "transparent",
      }}
    >
      {selected && <span>✓</span>}
      {label}
    </button>
  );
}

export default function DeadfishStep({
  member,
  team,
  fish,
  supabase,
  ratings,
  onRatingsChange,
  rowIds,
  onRowIdsChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  fish: Fish[];
  supabase: AppSupabaseClient;
  ratings: Record<string, number>;
  onRatingsChange: (ratings: Record<string, number>) => void;
  rowIds: Record<string, string>;
  onRowIdsChange: (rowIds: Record<string, string>) => void;
  onAdvance: () => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectRating(f: Fish, severity: number) {
    setSavingId(f.fish_id);
    setError(null);

    const existingRowId = rowIds[f.fish_id];

    if (existingRowId) {
      const { error: updateError } = await supabase
        .from("fish_responses")
        .update({ severity_label: severity as SeverityLabel })
        .eq("id", existingRowId);

      if (updateError) {
        console.error("[interview/deadfish] failed to update rating:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
        setError("That didn't save. Please try again.");
        setSavingId(null);
        return;
      }

      onRatingsChange({ ...ratings, [f.fish_id]: severity });
      setSavingId(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("fish_responses")
      .insert({
        member_id: member.member_id,
        team_id: team.team_id,
        fish_id: f.fish_id,
        severity_label: severity as SeverityLabel,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      console.error("[interview/deadfish] failed to save rating:", {
        message: insertError?.message,
        details: insertError?.details,
        hint: insertError?.hint,
        code: insertError?.code,
      });
      setError("That didn't save. Please try again.");
      setSavingId(null);
      return;
    }

    onRowIdsChange({ ...rowIds, [f.fish_id]: data.id });
    onRatingsChange({ ...ratings, [f.fish_id]: severity });
    setSavingId(null);
  }

  const ratedCount = fish.filter((f) => ratings[f.fish_id] !== undefined).length;
  const allRated = ratedCount === fish.length;

  return (
    <div>
      <p className="text-[var(--color-grey)] mb-8">
        For each pattern below, choose how much it applies to your team.
      </p>

      <div className="space-y-5 mb-8">
        {fish.map((f) => (
          <div key={f.fish_id} className="card">
            <p className="font-medium text-lg mb-1">{f.name}</p>
            {f.description && (
              <p className="text-sm text-[var(--color-grey)] mb-4 leading-relaxed">
                {f.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {SEVERITY_OPTIONS.map((opt) => (
                <SeverityButton
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  selected={ratings[f.fish_id] === opt.value}
                  disabled={savingId === f.fish_id}
                  onClick={() => selectRating(f, opt.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

      <p className="text-sm text-[var(--color-grey)] mb-4">
        {ratedCount} of {fish.length} rated
      </p>

      <button
        type="button"
        onClick={onAdvance}
        disabled={!allRated}
        className="btn-primary"
      >
        Continue
      </button>
    </div>
  );
}
