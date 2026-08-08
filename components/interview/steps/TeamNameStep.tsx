"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { Member } from "@/types/database";

export default function TeamNameStep({
  member,
  allMembers,
  readAloud,
  teamNameText,
  onTeamNameTextChange,
  onAdvance,
}: {
  member: Member;
  allMembers: Member[];
  readAloud: boolean;
  teamNameText: string;
  onTeamNameTextChange: (value: string) => void;
  onAdvance: () => void;
}) {
  const [submitted, setSubmitted] = useState(!!teamNameText);

  function handleSubmit() {
    setSubmitted(true);
  }

  return (
    <div>
      {/* Roster pinned at top */}
      <div className="space-y-2 mb-6">
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

      <ChatBubble readAloud={readAloud}>
        Does your team use a &ldquo;team name&rdquo; to refer to yourselves? If
        not, what would you name your team?
      </ChatBubble>

      {!submitted ? (
        <>
          <div className="mt-6 mb-6">
            <VoiceTextarea
              value={teamNameText}
              onChange={onTeamNameTextChange}
              rows={2}
              placeholder="e.g. The Revenue Team, Falcon Squad..."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!teamNameText.trim()}
              className="btn-primary"
            >
              Share this
            </button>
            <button type="button" onClick={onAdvance} className="btn-secondary">
              Skip
            </button>
          </div>
        </>
      ) : (
        <>
          {teamNameText && <MemberBubble>{teamNameText}</MemberBubble>}
          <button type="button" onClick={onAdvance} className="btn-primary mt-4">
            Continue
          </button>
        </>
      )}
    </div>
  );
}
