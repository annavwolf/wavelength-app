"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";

type ShareChoice = "private" | "open";

function choiceFromMember(member: Member): ShareChoice | null {
  if (member.share_verbatim_with_team && member.share_name_with_team) {
    return "open";
  }
  if (!member.share_verbatim_with_team && !member.share_name_with_team) {
    return "private";
  }
  return null;
}

function RadioCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`card w-full text-left py-4 flex items-start gap-4 transition-colors ${
        selected
          ? "border-2 border-[var(--color-purple)] bg-[var(--color-purple)]/5"
          : "border-2 border-transparent"
      }`}
    >
      <span
        className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs ${
          selected
            ? "border-[var(--color-purple)] bg-[var(--color-purple)] text-white"
            : "border-black/20 text-transparent"
        }`}
      >
        ✓
      </span>
      <span>{children}</span>
    </button>
  );
}

export default function ConsentStep({
  member,
  smallTeam,
  supabase,
  readAloud,
  onSaved,
  onAdvance,
}: {
  member: Member;
  smallTeam: boolean;
  supabase: AppSupabaseClient;
  readAloud: boolean;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  // Default to "open" (opt-in). Only restore "private" if the member has
  // previously and explicitly chosen it (both share fields saved as false).
  const [choice, setChoice] = useState<ShareChoice>(
    choiceFromMember(member) === "private" ? "private" : "open"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {

    setSaving(true);
    setError(null);

    const fields =
      choice === "open"
        ? { share_verbatim_with_team: true, share_name_with_team: true }
        : { share_verbatim_with_team: false, share_name_with_team: false };

    const { error: updateError } = await supabase
      .from("members")
      .update(fields)
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/consent] failed to save share choice:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      setError("Something went wrong saving your choice. Please try again.");
      setSaving(false);
      return;
    }

    onSaved(fields);
    setSaving(false);
    onAdvance();
  }

  return (
    <div>
      <ChatBubble
        readAloud={readAloud}
        speakText="Before that, please know that everything you tell me can be held private if that's what you want."
      >
        Before that, please know that{" "}
        <strong>
          everything you tell me can be held private if that&apos;s what you
          want.
        </strong>
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        If you&apos;d like to be anonymous, I won&apos;t share your exact
        words or name. Instead, I&apos;ll paraphrase and replace your name
        with a random ID.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        {smallTeam
          ? "Please note that complete anonymity can never be guaranteed, especially with small groups like yours."
          : "Please note that complete anonymity can never be guaranteed, especially with small groups."}
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        What would you like to do? You can change this later.
      </ChatBubble>

      <div className="space-y-3 mt-6 mb-6">
        <RadioCard
          selected={choice === "private"}
          onSelect={() => setChoice("private")}
        >
          Keep my responses fully private — describe patterns, don&apos;t
          quote me, don&apos;t attach my name.
        </RadioCard>
        <RadioCard
          selected={choice === "open"}
          onSelect={() => setChoice("open")}
        >
          I&apos;m comfortable sharing my exact words with my team — shown under
          a random ID, not my name — as a step toward open conversation.
        </RadioCard>
      </div>

      {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

      <button
        type="button"
        onClick={handleContinue}
        disabled={saving}
        className="btn-primary"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
