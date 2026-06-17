"use client";

import { useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";

export default function CloseStep({
  member,
  supabase,
  onSaved,
  onFinish,
}: {
  member: Member;
  supabase: AppSupabaseClient;
  onSaved: (fields: Partial<Member>) => void;
  onFinish: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setSaving(true);
    setError(null);

    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("members")
      .update({ status: "complete", completed_at: completedAt })
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/close] failed to set status=complete:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      setError("Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    onSaved({ status: "complete", completed_at: completedAt });
    onFinish();
  }

  return (
    <div className="text-center py-8">
      <img
        src="/octopus-logo.png"
        alt=""
        className="h-20 w-auto mx-auto mb-8"
      />

      <h1
        className="text-4xl font-serif mb-4"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        Thank you,{" "}
        <span className="purple">{member.display_name.split(" ")[0]}.</span>
      </h1>

      <p className="accent text-xl mb-6">
        That was a meaningful conversation.
      </p>

      <p className="text-[var(--color-grey)] max-w-md mx-auto mb-8">
        I&apos;m going to sit with what you&apos;ve shared and bring it
        together with your team&apos;s responses. Once everyone has spoken
        with me, I&apos;ll come back to you.
      </p>

      {error && (
        <p className="text-sm text-[var(--color-grey)] mb-4">{error}</p>
      )}

      <button
        type="button"
        onClick={handleFinish}
        disabled={saving}
        className="btn-primary"
      >
        {saving ? "Saving..." : "Finish"}
      </button>
    </div>
  );
}
