"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";

// Optional, member-volunteered context. The demographic fields are explicitly
// opt-in and never shared individually — the consent note above them says so.
export default function PersonalContextStep({
  member,
  supabase,
  readAloud,
  language,
  onLanguageChange,
  context,
  onContextChange,
  genderIdentity,
  onGenderIdentityChange,
  ethnicityCultural,
  onEthnicityCulturalChange,
  ageText,
  onAgeTextChange,
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
  genderIdentity: string;
  onGenderIdentityChange: (value: string) => void;
  ethnicityCultural: string;
  onEthnicityCulturalChange: (value: string) => void;
  ageText: string;
  onAgeTextChange: (value: string) => void;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(fields: Partial<Member>) {
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
      gender_identity: genderIdentity.trim() || null,
      ethnicity_cultural: ethnicityCultural.trim() || null,
      age: ageText.trim() || null,
    });
    if (ok) onAdvance();
  }

  function handleSkip() {
    onAdvance();
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        I&apos;d like to know more about you. It&apos;s completely optional to
        share. Mind telling me...
      </ChatBubble>

      <div className="mt-6 mb-4 space-y-4">
        <div>
          <label className="form-label">What languages you speak (optional)</label>
          <VoiceTextInput
            value={language}
            onChange={onLanguageChange}
            placeholder="e.g. English, Spanish, Mandarin..."
          />
        </div>
      </div>

      {/* Demographic fields — with explicit consent note */}
      <div className="card mt-2 mb-6 space-y-4">
        <p className="text-sm text-[var(--color-grey)] leading-relaxed">
          These are completely optional and never shared individually — I ask
          because team experience can differ across backgrounds.
        </p>

        <div>
          <label className="form-label">Your gender identity (optional)</label>
          <VoiceTextInput
            value={genderIdentity}
            onChange={onGenderIdentityChange}
            placeholder="e.g. woman, man, non-binary, prefer not to say..."
          />
        </div>
        <div>
          <label className="form-label">
            Your ethnicity, nationality, or cultural background (optional)
          </label>
          <VoiceTextInput
            value={ethnicityCultural}
            onChange={onEthnicityCulturalChange}
            placeholder="Describe in your own words..."
          />
        </div>
        <div>
          <label className="form-label">Your age (optional)</label>
          <VoiceTextInput
            value={ageText}
            onChange={onAgeTextChange}
            placeholder="e.g. 34"
          />
        </div>
        <div>
          <label className="form-label">Anything else you&apos;d like me to know? (optional)</label>
          <VoiceTextarea
            value={context}
            onChange={onContextChange}
            rows={3}
            placeholder="Loved ones, passions, talents, favourite things..."
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
