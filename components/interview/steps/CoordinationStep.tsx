"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { CoordinationFrequency, Member, Team } from "@/types/database";

const OPTIONS: { value: CoordinationFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "occasionally", label: "Occasionally" },
  { value: "rarely", label: "Rarely or never" },
];

export default function CoordinationStep({
  member,
  team,
  otherMembers,
  supabase,
  readAloud,
  ratings,
  onRatingsChange,
  rowIds,
  onRowIdsChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  otherMembers: Member[];
  supabase: AppSupabaseClient;
  readAloud: boolean;
  ratings: Record<string, CoordinationFrequency>;
  onRatingsChange: (ratings: Record<string, CoordinationFrequency>) => void;
  // Row ids are tracked client-side only — the live coordination_ratings
  // table has no target_member_id column, so this is the only way to know
  // which row belongs to which target without inserting a duplicate.
  rowIds: Record<string, string>;
  onRowIdsChange: (rowIds: Record<string, string>) => void;
  onAdvance: () => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectFrequency(
    target: Member,
    frequency: CoordinationFrequency
  ) {
    setSavingId(target.member_id);
    setError(null);

    const existingRowId = rowIds[target.member_id];

    if (existingRowId) {
      const { error: updateError } = await supabase
        .from("coordination_ratings")
        .update({ frequency })
        .eq("id", existingRowId);

      if (updateError) {
        console.error("[interview/coordination] failed to update rating:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
        setError("Something went wrong saving that. Please try again.");
        setSavingId(null);
        return;
      }

      onRatingsChange({ ...ratings, [target.member_id]: frequency });
      setSavingId(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("coordination_ratings")
      .insert({
        member_id: member.member_id,
        team_id: team.team_id,
        target_member_name: target.display_name,
        frequency,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      console.error("[interview/coordination] failed to save rating:", {
        message: insertError?.message,
        details: insertError?.details,
        hint: insertError?.hint,
        code: insertError?.code,
      });
      setError("Something went wrong saving that. Please try again.");
      setSavingId(null);
      return;
    }

    onRowIdsChange({ ...rowIds, [target.member_id]: data.id });
    onRatingsChange({ ...ratings, [target.member_id]: frequency });
    setSavingId(null);
  }

  const allRated = otherMembers.every((m) => ratings[m.member_id]);

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        One more thing. I want to understand how closely you work with each
        person on this team. For each person, just tell me how often you
        need to coordinate with them to do your work.
      </ChatBubble>

      <div className="space-y-4 mt-6 mb-6">
        {otherMembers.map((m) => (
          <div key={m.member_id} className="card">
            <p className="font-medium mb-3">
              {m.display_name}
              {m.role ? ` · ${m.role}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingId === m.member_id}
                  onClick={() => selectFrequency(m, opt.value)}
                  className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                    ratings[m.member_id] === opt.value
                      ? "bg-[var(--color-navy)] text-white border-[var(--color-navy)]"
                      : "border-black/15 text-[var(--color-ink)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

      <button
        type="button"
        onClick={onAdvance}
        disabled={!allRated}
        className="btn-primary"
      >
        Done
      </button>
    </div>
  );
}
