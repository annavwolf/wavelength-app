"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, SeverityLabel, Team } from "@/types/database";

const SEVERITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Minor" },
  { value: 2, label: "Occasional" },
  { value: 3, label: "A real pattern" },
  { value: 4, label: "A big problem" },
];

export default function DeadfishOpenStep({
  member,
  team,
  supabase,
  readAloud,
  customText,
  onCustomTextChange,
  customSeverity,
  onCustomSeverityChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  supabase: AppSupabaseClient;
  readAloud: boolean;
  customText: string;
  onCustomTextChange: (value: string) => void;
  customSeverity: number | null;
  onCustomSeverityChange: (value: number | null) => void;
  onAdvance: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!customText.trim() || customSeverity === null) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("fish_responses")
      .insert({
        member_id: member.member_id,
        team_id: team.team_id,
        fish_id: null,
        custom_text: customText.trim(),
        severity_label: customSeverity as SeverityLabel,
      });

    if (insertError) {
      console.error("[interview/deadfish_open] failed to save custom fish:", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
      setError("That didn't save. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
  }

  const canSave = customText.trim().length > 0 && customSeverity !== null;

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Is there anything else — a pattern that&apos;s getting in the way
        on this team — that isn&apos;t captured above?
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        This is optional. If something comes to mind, describe it in your
        own words.
      </ChatBubble>

      <div className="mt-6 mb-6 space-y-4">
        {!saved ? (
          <>
            <VoiceTextarea
              value={customText}
              onChange={onCustomTextChange}
              rows={4}
              placeholder="Describe a pattern you've noticed..."
            />

            {customText.trim() && (
              <div>
                <p className="form-label mb-2">How significant is it?</p>
                <div className="flex flex-wrap gap-2">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        onCustomSeverityChange(
                          customSeverity === opt.value ? null : opt.value
                        )
                      }
                      className={`text-sm px-4 py-2 rounded-full border-2 transition-all ${
                        customSeverity === opt.value
                          ? "bg-[var(--color-navy)] text-white border-[var(--color-navy)]"
                          : "border-black/15 text-[var(--color-ink)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-[var(--color-grey)]">{error}</p>}

            <div className="flex flex-wrap gap-3">
              {canSave && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-secondary"
                >
                  {saving ? "Saving..." : "Save this"}
                </button>
              )}
              <button type="button" onClick={onAdvance} className="btn-primary">
                {customText.trim() && !saved
                  ? "Continue without saving"
                  : "Nothing else to add"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[var(--color-grey)]">
              ✓ Got it — I&apos;ve noted that.
            </p>
            <button type="button" onClick={onAdvance} className="btn-primary">
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
