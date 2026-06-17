"use client";

import { useEffect, useState } from "react";
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
  onAdvance,
}: {
  member: Member;
  team: Team;
  otherMembers: Member[];
  supabase: AppSupabaseClient;
  readAloud: boolean;
  ratings: Record<string, CoordinationFrequency>;
  onRatingsChange: (ratings: Record<string, CoordinationFrequency>) => void;
  onAdvance: () => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate saved ratings so a resuming member sees their previous answers.
  useEffect(() => {
    if (Object.keys(ratings).length > 0) return;
    supabase
      .from("coordination_ratings")
      .select("target_member_name, frequency")
      .eq("member_id", member.member_id)
      .then(({ data }) => {
        if (!data?.length) return;
        const populated: Record<string, CoordinationFrequency> = {};
        for (const row of data) {
          const match = otherMembers.find(
            (m) => m.display_name.toLowerCase() === row.target_member_name.toLowerCase()
          );
          if (match) populated[match.member_id] = row.frequency as CoordinationFrequency;
        }
        if (Object.keys(populated).length > 0) onRatingsChange(populated);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectFrequency(target: Member, frequency: CoordinationFrequency) {
    setSavingId(target.member_id);
    setError(null);

    // Check for an existing row keyed on (member_id, target_member_name)
    // so we update in place instead of inserting a duplicate.
    const { data: existing } = await supabase
      .from("coordination_ratings")
      .select("id")
      .eq("member_id", member.member_id)
      .eq("target_member_name", target.display_name)
      .maybeSingle();

    const saveError = existing
      ? (
          await supabase
            .from("coordination_ratings")
            .update({ frequency })
            .eq("id", existing.id)
        ).error
      : (
          await supabase.from("coordination_ratings").insert({
            member_id: member.member_id,
            team_id: team.team_id,
            target_member_name: target.display_name,
            frequency,
          })
        ).error;

    if (saveError) {
      console.error("[interview/coordination] failed to save rating:", {
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        code: saveError.code,
      });
      setError("Something went wrong saving that. Please try again.");
      setSavingId(null);
      return;
    }

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
