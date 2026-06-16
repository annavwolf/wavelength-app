"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, Team } from "@/types/database";

export default function RosterStep({
  member,
  team,
  allMembers,
  supabase,
  readAloud,
  showMissingField,
  onShowMissingFieldChange,
  missingName,
  onMissingNameChange,
  missingRole,
  onMissingRoleChange,
  noted,
  onNotedChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  allMembers: Member[];
  supabase: AppSupabaseClient;
  readAloud: boolean;
  showMissingField: boolean;
  onShowMissingFieldChange: (value: boolean) => void;
  missingName: string;
  onMissingNameChange: (value: string) => void;
  missingRole: string;
  onMissingRoleChange: (value: string) => void;
  noted: boolean;
  onNotedChange: (value: boolean) => void;
  onAdvance: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMissingSubmit() {
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("missing_member_flags")
      .insert({
        team_id: team.team_id,
        reported_by_member_id: member.member_id,
        missing_name: missingName,
        missing_role: missingRole || null,
      });

    if (insertError) {
      console.error("[interview/roster] failed to save missing member flag:", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
      setError("Something went wrong saving that. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onNotedChange(true);
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Here&apos;s everyone I know about on this team. Does this look right
        to you?
      </ChatBubble>

      <div className="space-y-3 mt-6 mb-6">
        {allMembers.map((m) => (
          <div key={m.member_id} className="card flex items-center py-4">
            <div>
              <p className="font-medium">
                {m.display_name}
                {m.member_id === member.member_id && (
                  <span className="text-sm text-[var(--color-grey)]">
                    {" "}
                    (you)
                  </span>
                )}
              </p>
              {m.role && (
                <p className="text-sm text-[var(--color-grey)] mt-1">
                  {m.role}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!showMissingField && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onAdvance} className="btn-primary">
            Yes, that&apos;s the team
          </button>
          <button
            type="button"
            onClick={() => onShowMissingFieldChange(true)}
            className="btn-secondary"
          >
            Someone&apos;s missing
          </button>
        </div>
      )}

      {showMissingField && !noted && (
        <div className="card space-y-4">
          <div>
            <label className="form-label">Their name</label>
            <VoiceTextInput value={missingName} onChange={onMissingNameChange} />
          </div>
          <div>
            <label className="form-label">Their role</label>
            <VoiceTextInput value={missingRole} onChange={onMissingRoleChange} />
          </div>

          {error && <p className="text-[var(--color-grey)]">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleMissingSubmit}
              disabled={!missingName.trim() || saving}
              className="btn-primary"
            >
              {saving ? "Saving..." : "Add note"}
            </button>
            <button
              type="button"
              onClick={() => onShowMissingFieldChange(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {noted && (
        <>
          <p className="text-[var(--color-grey)] mb-6">
            Thanks — I&apos;ve made a note of that.
          </p>
          <button type="button" onClick={onAdvance} className="btn-primary">
            Continue
          </button>
        </>
      )}
    </div>
  );
}
