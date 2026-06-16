"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";

// Optional, member-volunteered context. Deliberately excludes gender,
// ethnicity, and age — GDPR special-category data with no validated
// relevance to this flow.
export default function PersonalContextStep({
  member,
  supabase,
  readAloud,
  language,
  onLanguageChange,
  context,
  onContextChange,
  onSaved,
  onAdvance,
}: {
  member: Member;
  supabase: AppSupabaseClient;
  readAloud: boolean;
  language: string;
  onLanguageChange: (value: string) => void;
  context: string;
  onContextChange: (value: string) => void;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(fields: {
    primary_language: string | null;
    personal_context: string | null;
  }) {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("members")
      .update(fields)
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/personal_context] failed to save:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      setError("Something went wrong saving that. Please try again.");
      setSaving(false);
      return false;
    }

    onSaved(fields);
    setSaving(false);
    return true;
  }

  async function handleContinue() {
    const ok = await save({
      primary_language: language.trim() || null,
      personal_context: context.trim() || null,
    });
    if (ok) onAdvance();
  }

  function handleSkip() {
    onAdvance();
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        I&apos;d also love to know a little more about you — if you&apos;re
        comfortable sharing. Things like: is English your first language, or
        do you work primarily in another language? And is there anything
        else about your background or working style that you&apos;d like me
        to keep in mind as we talk?
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        There&apos;s no obligation here — share as much or as little as
        you&apos;d like.
      </ChatBubble>

      <div className="mt-6 mb-6 space-y-4">
        <div>
          <label className="form-label">
            Language you work in (optional)
          </label>
          <VoiceTextInput
            value={language}
            onChange={onLanguageChange}
            placeholder="e.g. English, Spanish, Mandarin..."
          />
        </div>
        <div>
          <label className="form-label">Anything else? (optional)</label>
          <VoiceTextarea
            value={context}
            onChange={onContextChange}
            rows={4}
            placeholder="Share anything that would help me understand you better..."
          />
        </div>
      </div>

      {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={saving}
          className="btn-secondary"
        >
          Skip this
        </button>
      </div>
    </div>
  );
}
