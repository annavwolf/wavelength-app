"use client";

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { CoordinationFrequency, Member } from "@/types/database";
import type { InterviewRosterMember } from "@/components/interview/types";

const OPTIONS: { value: CoordinationFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "occasionally", label: "Occasionally" },
  { value: "rarely", label: "Rarely or never" },
];

export default function CoordinationStep({
  member,
  otherMembers,
  readAloud,
  ratings,
  onRatingsChange,
  onAdvance,
}: {
  member: Member;
  otherMembers: InterviewRosterMember[];
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
    void fetch(`/api/interview/responses?member_id=${encodeURIComponent(member.member_id)}&kind=coordination`)
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!response.ok || !Array.isArray(data.ratings) || data.ratings.length === 0) return;
        const populated: Record<string, CoordinationFrequency> = {};
        for (const row of data.ratings) {
          const match = row.target_roster_key
            ? otherMembers.find((member) => member.roster_key === row.target_roster_key)
            : otherMembers.find((member) => member.display_name.toLowerCase() === row.target_member_name.toLowerCase());
          if (match) populated[match.roster_key] = row.frequency as CoordinationFrequency;
        }
        if (Object.keys(populated).length > 0) onRatingsChange(populated);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectFrequency(target: InterviewRosterMember, frequency: CoordinationFrequency) {
    setSavingId(target.roster_key);
    setError(null);

    const response = await fetch("/api/interview/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: member.member_id,
        kind: "coordination",
        target_roster_key: target.roster_key,
        frequency,
      }),
    });
    if (!response.ok) {
      setError("Something went wrong saving that. Please try again.");
      setSavingId(null);
      return;
    }

    onRatingsChange({ ...ratings, [target.roster_key]: frequency });
    setSavingId(null);
  }

  const allRated = otherMembers.every((m) => ratings[m.roster_key]);

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        One more thing. I want to understand how closely you work with each
        person on this team. For each person, just tell me how often you
        need to coordinate with them to do your work.
      </ChatBubble>

      <div className="space-y-4 mt-6 mb-6">
        {otherMembers.map((m) => (
          <div key={m.roster_key} className="card">
            <p className="font-medium mb-3">
              {m.display_name}
            </p>
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingId === m.roster_key}
                  onClick={() => selectFrequency(m, opt.value)}
                  className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                    ratings[m.roster_key] === opt.value
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
