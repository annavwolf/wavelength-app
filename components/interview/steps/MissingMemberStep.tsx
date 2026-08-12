"use client";

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { Member } from "@/types/database";

export default function MissingMemberStep({
  member,
  allMembers,
  readAloud,
  teamNameText,
  showMissingField,
  onShowMissingFieldChange,
  missingRole,
  onMissingRoleChange,
  noted,
  onNotedChange,
  onAdvance,
}: {
  member: Member;
  allMembers: Member[];
  readAloud: boolean;
  teamNameText: string;
  showMissingField: boolean;
  onShowMissingFieldChange: (value: boolean) => void;
  missingRole: string;
  onMissingRoleChange: (value: string) => void;
  noted: boolean;
  onNotedChange: (value: boolean) => void;
  onAdvance: () => void;
}) {
  const [answered, setAnswered] = useState(noted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teamLabel = teamNameText.trim() || "this team";

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/interview/missing-member?member_id=${encodeURIComponent(member.member_id)}`);
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.missing_role) {
        onMissingRoleChange(data.missing_role);
        onNotedChange(true);
        setAnswered(true);
      }
    })();
  }, [member.member_id, onMissingRoleChange, onNotedChange]);

  async function saveNote() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/missing-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: member.member_id, relationship: missingRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Something went wrong saving that. Please try again.");
        return;
      }
      onNotedChange(true);
      setAnswered(true);
    } catch {
      setError("Something went wrong saving that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="space-y-2 mb-6">
        {allMembers.map((participant) => (
          <div key={participant.member_id} className="card flex items-center py-3">
            <p className="font-medium">
              {participant.display_name}
              {participant.member_id === member.member_id && <span className="text-sm text-[var(--color-grey)]"> (you)</span>}
            </p>
          </div>
        ))}
      </div>
      <ChatBubble readAloud={readAloud}>
        Thinking of {teamLabel}, is a core team role or relationship missing from this list?
      </ChatBubble>
      <p className="text-sm text-[var(--color-grey)] mt-3">Please do not enter anyone&apos;s name. This note is about the team&apos;s coverage, not identifying a non-participant.</p>

      {noted ? (
        <div className="card mt-4 mb-4 bg-[var(--color-purple)]/5 border border-[var(--color-purple)]/20">
          <p className="text-sm font-medium text-[var(--color-purple)]">Noted</p>
          <p className="text-sm text-[var(--color-grey)] mt-1">You flagged a potentially missing core role: {missingRole}.</p>
        </div>
      ) : (
        <>
          {!answered && !showMissingField && (
            <div className="flex flex-wrap gap-3 mt-6">
              <button type="button" onClick={() => setAnswered(true)} className="btn-primary">No</button>
              <button type="button" onClick={() => onShowMissingFieldChange(true)} className="btn-secondary">I think so</button>
            </div>
          )}
          {showMissingField && (
            <div className="card space-y-4 mt-6">
              <div>
                <label className="form-label">Their role or relationship to the team</label>
                <VoiceTextInput value={missingRole} onChange={onMissingRoleChange} placeholder="For example, the delivery lead or a key partner team" />
              </div>
              {error && <p className="text-[var(--color-grey)]">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={saveNote} disabled={!missingRole.trim() || saving} className="btn-primary">{saving ? "Saving..." : "Add note"}</button>
                <button type="button" onClick={() => { onShowMissingFieldChange(false); setAnswered(true); }} className="btn-secondary">Actually, no</button>
              </div>
            </div>
          )}
        </>
      )}
      {answered && <button type="button" onClick={onAdvance} className="btn-primary mt-6">Continue</button>}
    </div>
  );
}
