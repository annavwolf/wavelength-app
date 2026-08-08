"use client";

import ChatBubble from "@/components/interview/ChatBubble";
import type { Member, Team } from "@/types/database";

export default function RosterStep({
  member,
  allMembers,
  onAdvance,
  readAloud,
}: {
  member: Member;
  team: Team;
  allMembers: Member[];
  readAloud: boolean;
  onAdvance: () => void;
}) {
  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        I also have some information about a team you belong to.   
      </ChatBubble>

      {/* Roster — names only */}
      <div className="space-y-2 mt-6 mb-6">
        {allMembers.map((m) => (
          <div key={m.member_id} className="card flex items-center py-3">
            <p className="font-medium">
              {m.display_name}
              {m.member_id === member.member_id && (
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
