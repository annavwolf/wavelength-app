"use client";

import ChatBubble from "@/components/interview/ChatBubble";
import type { Team } from "@/types/database";
import type { InterviewRosterMember } from "@/components/interview/types";

export default function RosterStep({
  team,
  allMembers,
  onAdvance,
  readAloud,
}: {
  team: Team;
  allMembers: InterviewRosterMember[];
  readAloud: boolean;
  onAdvance: () => void;
}) {
  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        I also have some information about <strong>{team.team_name}</strong>. This is the team we&apos;ll talk about today.
      </ChatBubble>

      {/* Roster — names only */}
      <div className="space-y-2 mt-6 mb-6">
        {allMembers.map((m) => (
          <div key={m.roster_key} className="card flex items-center py-3">
            <p className="font-medium">
              {m.display_name}
              {m.is_self && (
                <span className="text-sm text-[var(--color-grey)]"> (you)</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Directly show Continue button to move forward */}
      <button
        type="button"
        onClick={onAdvance}
        className="btn-primary mt-6"
      >
        Continue
      </button>
    </div>
  );
}
