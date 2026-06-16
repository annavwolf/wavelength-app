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
  onAdvance,
}: {
  member: Member;
  team: Team;
  otherMembers: Member[];
  supabase: AppSupabaseClient;
  onAdvance: () => void;
}) {
  const [ratings, setRatings] = useState<Record<string, CoordinationFrequency>>(
    {}
  );
  // Tracks the row id we already inserted for each target, so re-tapping a
  // different option updates that row instead of inserting a duplicate.
  const [rowIds, setRowIds] = useState<Record<string, string>>({});
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

      setRatings((prev) => ({ ...prev, [target.member_id]: frequency }));
      setSavingId(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("coordination_ratings")
      .insert({
        member_id: member.member_id,
        team_id: team.team_id,
        target_member_id: target.member_id,
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

    setRowIds((prev) => ({ ...prev, [target.member_id]: data.id }));
    setRatings((prev) => ({ ...prev, [target.member_id]: frequency }));
    setSavingId(null);
  }

  const allRated = otherMembers.every((m) => ratings[m.member_id]);

  return (
    <div>
      <ChatBubble>
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
