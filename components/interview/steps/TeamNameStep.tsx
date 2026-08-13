"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { InterviewRosterMember } from "@/components/interview/types";

type Stage = "choose" | "suggest" | "confirmed";

export default function TeamNameStep({
  allMembers,
  teamName,
  readAloud,
  teamNameText,
  onTeamNameTextChange,
  onAdvance,
}: {
  allMembers: InterviewRosterMember[];
  teamName: string;
  readAloud: boolean;
  teamNameText: string;
  onTeamNameTextChange: (value: string) => void;
  onAdvance: () => void;
}) {
  const isSavedAlternative = Boolean(teamNameText.trim() && teamNameText.trim() !== teamName);
  const [stage, setStage] = useState<Stage>(isSavedAlternative ? "confirmed" : "choose");

  function useNameOnFile() {
    onTeamNameTextChange(teamName);
    setStage("confirmed");
  }

  function confirmAlternative() {
    if (!teamNameText.trim()) return;
    setStage("confirmed");
  }

  return (
    <div>
      <div className="space-y-2 mb-6">
        {allMembers.map((participant) => (
          <div key={participant.roster_key} className="card flex items-center py-3">
            <p className="font-medium">
              {participant.display_name}
              {participant.is_self && <span className="text-sm text-[var(--color-grey)]"> (you)</span>}
            </p>
          </div>
        ))}
      </div>

      <ChatBubble readAloud={readAloud}>
        Otis has <strong>{teamName}</strong> on file as your team&apos;s name. Does that fit how you refer to yourselves, or is there another name that suits the team better?
      </ChatBubble>

      {stage === "choose" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={useNameOnFile} className="btn-primary">Use “{teamName}”</button>
          <button type="button" onClick={() => setStage("suggest")} className="btn-secondary">Suggest a different name</button>
        </div>
      )}

      {stage === "suggest" && (
        <div className="mt-6 space-y-4">
          <div>
            <label className="form-label">A name that fits your team better</label>
            <VoiceTextarea value={teamNameText === teamName ? "" : teamNameText} onChange={onTeamNameTextChange} rows={2} placeholder="For example, Falcon Squad" />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={confirmAlternative} disabled={!teamNameText.trim() || teamNameText.trim() === teamName} className="btn-primary">Use this name</button>
            <button type="button" onClick={useNameOnFile} className="btn-secondary">Keep “{teamName}”</button>
          </div>
        </div>
      )}

      {stage === "confirmed" && (
        <>
          <MemberBubble>{teamNameText.trim() || teamName}</MemberBubble>
          <p className="mt-4 text-base leading-relaxed text-[var(--color-grey)]">Otis will use this name for the rest of your assessment.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={onAdvance} className="btn-primary">Continue</button>
            <button type="button" onClick={() => setStage("choose")} className="btn-secondary">Change this</button>
          </div>
        </>
      )}
    </div>
  );
}
