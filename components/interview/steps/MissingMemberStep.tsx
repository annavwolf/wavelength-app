"use client";

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, Team } from "@/types/database";

export default function MissingMemberStep({
  member,
  team,
  allMembers,
  supabase,
  readAloud,
  teamNameText,
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
  teamNameText: string;
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
  const [answered, setAnswered] = useState(noted);
  const [savingFlag, setSavingFlag] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  const teamLabel = teamNameText.trim() || "this team";

  // Restore state from DB on mount — so returning to this step always reflects
  // what was previously submitted.
  useEffect(() => {
    supabase
      .from("missing_member_flags")
      .select("missing_name, missing_role")
      .eq("reported_by_member_id", member.member_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.missing_name) {
          onMissingNameChange(data.missing_name);
          onMissingRoleChange(data.missing_role ?? "");
          onNotedChange(true);
          setAnswered(true);
        } else if (noted) {
          setAnswered(true);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleMissingSubmit() {
    setSavingFlag(true);
    setFlagError(null);

    // Delete any existing flag first to prevent duplicate rows.
    await supabase
      .from("missing_member_flags")
      .delete()
      .eq("reported_by_member_id", member.member_id);

    const { error: insertError } = await supabase
      .from("missing_member_flags")
      .insert({
        team_id: team.team_id,
        reported_by_member_id: member.member_id,
        missing_name: missingName,
        missing_role: missingRole || null,
      });

    if (insertError) {
      console.error("[interview/missing_member] save failed:", {
        message: insertError.message,
        code: insertError.code,
      });
      setFlagError("Something went wrong saving that. Please try again.");
      setSavingFlag(false);
      return;
    }

    setSavingFlag(false);
    onNotedChange(true);
    setAnswered(true);
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
        Is there anyone you feel is missing from this team list? Someone core
        to the team? Keep in mind that not everyone you work closely with may
        be a part of this team — they might belong to other teams.
      </ChatBubble>

      <ChatBubble
        readAloud={readAloud}
        speakText={`So, thinking of ${teamLabel} and your shared purpose, is a core member missing?`}
      >
        So, thinking of <strong>{teamLabel}</strong> and your shared purpose,
        is a core member missing?
      </ChatBubble>

      {noted ? (
        <div className="card mt-4 mb-4 bg-[var(--color-purple)]/5 border border-[var(--color-purple)]/20 space-y-1">
          <p className="text-sm font-medium text-[var(--color-purple)]">✓ Noted</p>
          <p className="text-sm text-[var(--color-grey)]">
            You flagged <strong>{missingName}</strong>
            {missingRole ? ` (${missingRole})` : ""} as potentially missing.
          </p>
        </div>
      ) : (
        <>
          {!answered && !showMissingField && (
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                type="button"
                onClick={() => setAnswered(true)}
                className="btn-primary"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => onShowMissingFieldChange(true)}
                className="btn-secondary"
              >
                I think so
              </button>
            </div>
          )}

          {showMissingField && !noted && (
            <div className="card space-y-4 mt-6">
              <div>
                <label className="form-label">Their name</label>
                <VoiceTextInput value={missingName} onChange={onMissingNameChange} />
              </div>
              <div>
                <label className="form-label">Their role (optional)</label>
                <VoiceTextInput value={missingRole} onChange={onMissingRoleChange} />
              </div>

              {flagError && <p className="text-[var(--color-grey)]">{flagError}</p>}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleMissingSubmit}
                  disabled={!missingName.trim() || savingFlag}
                  className="btn-primary"
                >
                  {savingFlag ? "Saving..." : "Add note"}
                </button>
                <button
                  type="button"
                  onClick={() => { onShowMissingFieldChange(false); setAnswered(true); }}
                  className="btn-secondary"
                >
                  Actually, no
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {answered && (
        <button type="button" onClick={onAdvance} className="btn-primary mt-6">
          Continue
        </button>
      )}
    </div>
  );
}
