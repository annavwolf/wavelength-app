"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { Member } from "@/types/database";

function isThin(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed.length < 40 || /^(yes|no|yeah|nope|sure|not really|i think so|i guess|maybe|idk|i don't know)\.?$/.test(trimmed);
}

type Stage = "role_check" | "role_update" | "contribution" | "nudge" | "done";

export default function OwnRoleStep({
  member,
  readAloud,
  text,
  onTextChange,
  onRoleSaved,
  onAdvance,
}: {
  member: Member;
  readAloud: boolean;
  text: string;
  onTextChange: (value: string) => void;
  onRoleSaved: (role: string | null) => Promise<boolean>;
  onAdvance: () => void;
}) {
  const [stage, setStage] = useState<Stage>(member.role ? "role_check" : "contribution");
  const [role, setRole] = useState(member.role ?? "");
  const [savingRole, setSavingRole] = useState(false);

  async function saveRoleAndContinue() {
    setSavingRole(true);
    const saved = await onRoleSaved(role.trim() || null);
    setSavingRole(false);
    if (saved) setStage("contribution");
  }

  function handleSubmit() {
    if (stage === "contribution" && isThin(text)) {
      setStage("nudge");
      return;
    }
    setStage("done");
  }

  return (
    <div>
      {stage === "role_check" && (
        <>
          <ChatBubble readAloud={readAloud}>Otis has your role as <strong>{member.role}</strong>. Is that still right?</ChatBubble>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setStage("contribution")} className="btn-primary">Yes, that&apos;s right</button>
            <button type="button" onClick={() => setStage("role_update")} className="btn-secondary">Update my role</button>
          </div>
        </>
      )}

      {stage === "role_update" && (
        <>
          <ChatBubble readAloud={readAloud}>What role should Otis use instead?</ChatBubble>
          <div className="mt-6 mb-6">
            <label className="form-label">Your role</label>
            <VoiceTextInput value={role} onChange={setRole} placeholder="For example, product manager" />
          </div>
          <button type="button" onClick={saveRoleAndContinue} disabled={savingRole} className="btn-primary">{savingRole ? "Saving..." : "Save and continue"}</button>
        </>
      )}

      {stage === "contribution" && (
        <>
          <ChatBubble readAloud={readAloud}>
            And what skills, knowledge, abilities, or other strengths do you contribute to the team? A few concrete examples are useful.
          </ChatBubble>
          <div className="mt-6 mb-6">
            <VoiceTextarea value={text} onChange={onTextChange} rows={4} placeholder="Share what comes to mind..." />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleSubmit} disabled={!text.trim()} className="btn-primary">Share this</button>
            <button type="button" onClick={onAdvance} className="btn-secondary">Skip</button>
          </div>
        </>
      )}

      {stage === "nudge" && (
        <>
          <MemberBubble>{text}</MemberBubble>
          <ChatBubble readAloud={readAloud}>Can you give an example of something you contribute that others might find hard to substitute?</ChatBubble>
          <div className="mt-6 mb-6"><VoiceTextarea value={text} onChange={onTextChange} rows={4} placeholder="A little more detail..." /></div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStage("done")} disabled={!text.trim()} className="btn-primary">Share this</button>
            <button type="button" onClick={onAdvance} className="btn-secondary">Continue</button>
          </div>
        </>
      )}

      {stage === "done" && (
        <>
          <MemberBubble>{text}</MemberBubble>
          <button type="button" onClick={onAdvance} className="btn-primary mt-4">Continue</button>
        </>
      )}
    </div>
  );
}
