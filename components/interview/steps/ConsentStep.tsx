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
  // Selecting a card is purely local — instant feedback, no network round
  // trip in the way of the click. The actual save happens on Continue.
  const [choice, setChoice] = useState<ShareChoice | null>(
    choiceFromMember(member)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!choice) return;

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
      <ChatBubble readAloud={readAloud}>
        Before we go any further, I want to be clear about how I handle what
        you share with me.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Everything you say in this conversation is private. Your exact words
        are never shared with your manager, your team leader, or anyone else
        on your team.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        When I produce a report for the team, I describe patterns across the
        whole group — not what any individual person said. Where I do
        reference specific experiences, I paraphrase rather than quote.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Your responses are stored securely and linked to a private code, not
        your name, so that individual answers cannot be traced back to you
        in the team report.
      </ChatBubble>
      {smallTeam && (
        <ChatBubble readAloud={readAloud}>
          If your team has fewer than five members, I&apos;ll flag that some
          patterns may be easier to trace, and give you the option to review
          before anything is shared.
        </ChatBubble>
      )}

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
          I&apos;m comfortable sharing my exact words, and my name, with my
          team — as a step toward open conversation.
        </RadioCard>
      </div>

      {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!choice || saving}
        className="btn-primary"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
