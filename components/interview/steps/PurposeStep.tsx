"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, Team } from "@/types/database";

export default function PurposeStep({
  member,
  team,
  supabase,
  onAdvance,
}: {
  member: Member;
  team: Team;
  supabase: AppSupabaseClient;
  onAdvance: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("purpose_responses")
      .insert({
        member_id: member.member_id,
        team_id: team.team_id,
        purpose_text: text,
      });

    if (insertError) {
      console.error("[interview/purpose] failed to save purpose response:", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
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
      <ChatBubble>
        Now I&apos;d like to understand how you see your team.
      </ChatBubble>
      <ChatBubble>
        In your own words — what do you understand to be your team&apos;s
        shared purpose? Why does this team exist, what is it working toward,
        and how does it connect to the broader organisation you&apos;re part
        of?
      </ChatBubble>
      <ChatBubble>
        Take your time. There&apos;s no right answer — I want to understand
        how you see it.
      </ChatBubble>

      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share what comes to mind..."
        className="form-input mt-6 mb-6"
      />

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
