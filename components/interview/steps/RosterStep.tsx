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
  tenureStart,
  onTenureStartChange,
  tenureSaved,
  onTenureSaved,
  showMissingField,
  onShowMissingFieldChange,
  missingName,
  onMissingNameChange,
  missingRole,
  onMissingRoleChange,
  noted,
  onNotedChange,
  onSaved,
  onAdvance,
}: {
  member: Member;
  team: Team;
  allMembers: Member[];
  supabase: AppSupabaseClient;
  readAloud: boolean;
  tenureStart: string;
  onTenureStartChange: (value: string) => void;
  tenureSaved: boolean;
  onTenureSaved: () => void;
  showMissingField: boolean;
  onShowMissingFieldChange: (value: boolean) => void;
  missingName: string;
  onMissingNameChange: (value: string) => void;
  missingRole: string;
  onMissingRoleChange: (value: string) => void;
  noted: boolean;
  onNotedChange: (value: boolean) => void;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [savingTenure, setSavingTenure] = useState(false);
  const [tenureError, setTenureError] = useState<string | null>(null);
  const [savingFlag, setSavingFlag] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  async function handleSaveTenure() {
    if (!tenureStart.trim()) {
      onTenureSaved();
      return;
    }
    setSavingTenure(true);
    setTenureError(null);

    const { error: updateError } = await supabase
      .from("members")
      .update({ tenure_start: tenureStart })
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/roster] failed to save tenure:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      setTenureError("Couldn't save that — please try again.");
      setSavingTenure(false);
      return;
    }

    onSaved({ tenure_start: tenureStart });
    setSavingTenure(false);
    onTenureSaved();
  }

  async function handleMissingSubmit() {
    setSavingFlag(true);
    setFlagError(null);

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
      setFlagError("Something went wrong saving that. Please try again.");
      setSavingFlag(false);
      return;
    }

    setSavingFlag(false);
    onNotedChange(true);
  }

  return (
    <div>
      {/* ── Tenure question ── */}
      <ChatBubble readAloud={readAloud}>
        Roughly when did you join this team, or start working with them?
      </ChatBubble>

      {!tenureSaved ? (
        <div className="mt-4 mb-8 space-y-3">
          <VoiceTextInput
            value={tenureStart}
            onChange={onTenureStartChange}
            placeholder="e.g. January 2024, early 2023..."
          />
          {tenureError && (
            <p className="text-[var(--color-grey)] text-sm">{tenureError}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveTenure}
              disabled={savingTenure}
              className="btn-primary"
            >
              {savingTenure ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onTenureSaved}
              className="btn-secondary"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          {tenureStart ? (
            <p className="text-[var(--color-grey)]">
              ✓ {tenureStart}
            </p>
          ) : (
            <p className="text-[var(--color-grey)] text-sm">Skipped.</p>
          )}
        </div>
      )}

      {/* ── Team roster check ── */}
      <ChatBubble readAloud={readAloud}>
        Here&apos;s everyone I know about on this team. I want to check I
        have the team right.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        One thing to keep in mind: the question isn&apos;t whether
        there&apos;s someone you work with who isn&apos;t listed — you might
        work closely with people on other teams. The question is whether a
        core member of THIS team, someone who clearly belongs here, is
        missing.
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

      {!showMissingField && !noted && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onAdvance} className="btn-primary">
            Yes, this is the team
          </button>
          <button
            type="button"
            onClick={() => onShowMissingFieldChange(true)}
            className="btn-secondary"
          >
            Someone core is missing
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

          {flagError && (
            <p className="text-[var(--color-grey)]">{flagError}</p>
          )}

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
