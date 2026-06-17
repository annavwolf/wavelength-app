"use client";

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, Team } from "@/types/database";

export default function PurposeStep({
  member,
  team,
  supabase,
  readAloud,
  text,
  onTextChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  supabase: AppSupabaseClient;
  readAloud: boolean;
  text: string;
  onTextChange: (value: string) => void;
  onAdvance: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate textarea with any existing response so a resuming member
  // can review and update their answer rather than seeing a blank field.
  useEffect(() => {
    if (text) return;
    supabase
      .from("purpose_responses")
      .select("purpose_text")
      .eq("member_id", member.member_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.purpose_text) onTextChange(data.purpose_text);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    // Check for an existing row first so we can update in place rather than
    // relying on a DB unique constraint for the upsert's ON CONFLICT clause.
    const { data: existing } = await supabase
      .from("purpose_responses")
      .select("id")
      .eq("member_id", member.member_id)
      .maybeSingle();

    const saveError = existing
      ? (
          await supabase
            .from("purpose_responses")
            .update({ purpose_text: text })
            .eq("member_id", member.member_id)
        ).error
      : (
          await supabase
            .from("purpose_responses")
            .insert({ member_id: member.member_id, team_id: team.team_id, purpose_text: text })
        ).error;

    if (saveError) {
      console.error("[interview/purpose] failed to save purpose response:", {
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        code: saveError.code,
      });
      setError("Something went wrong saving your answer. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onAdvance();
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Now I&apos;d like to understand how you see your team.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        In your own words — what do you understand to be your team&apos;s
        shared purpose? Why does this team exist, what is it working toward,
        and how does it connect to the broader organisation you&apos;re part
        of?
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Take your time. There&apos;s no right answer — I want to understand
        how you see it.
      </ChatBubble>

      <div className="mt-6 mb-6">
        <VoiceTextarea
          value={text}
          onChange={onTextChange}
          rows={5}
          placeholder="Share what comes to mind..."
        />
      </div>

      {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !text.trim()}
        className="btn-primary"
      >
        {saving ? "Saving..." : "Share this"}
      </button>
    </div>
  );
}
