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

export default function ConsentStep({
  member,
  smallTeam,
  supabase,
  onSaved,
  onAdvance,
}: {
  member: Member;
  smallTeam: boolean;
  supabase: AppSupabaseClient;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [choice, setChoice] = useState<ShareChoice | null>(
    choiceFromMember(member)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectChoice(next: ShareChoice) {
    setSaving(true);
    setError(null);

    const fields =
      next === "open"
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

    setChoice(next);
    onSaved(fields);
    setSaving(false);
  }

  return (
    <div>
      <ChatBubble>
        Before we go any further, I want to be clear about how I handle what
        you share with me.
      </ChatBubble>
      <ChatBubble>
        Everything you say in this conversation is private. Your exact words
        are never shared with your manager, your team leader, or anyone else
        on your team.
      </ChatBubble>
      <ChatBubble>
        When I produce a report for the team, I describe patterns across the
        whole group — not what any individual person said. Where I do
        reference specific experiences, I paraphrase rather than quote.
      </ChatBubble>
      <ChatBubble>
        Your responses are stored securely and linked to a private code, not
        your name, so that individual answers cannot be traced back to you
        in the team report.
      </ChatBubble>
      {smallTeam && (
        <ChatBubble>
          If your team has fewer than five members, I&apos;ll flag that some
          patterns may be easier to trace, and give you the option to review
          before anything is shared.
        </ChatBubble>
      )}

      <div className="space-y-3 mt-6 mb-6">
        <button
          type="button"
          onClick={() => selectChoice("private")}
          disabled={saving}
          className={`card w-full text-left py-4 transition-shadow ${
            choice === "private" ? "ring-2 ring-[var(--color-purple)]" : ""
          }`}
        >
          Keep my responses fully private — describe patterns, don&apos;t
          quote me, don&apos;t attach my name.
        </button>
        <button
          type="button"
          onClick={() => selectChoice("open")}
          disabled={saving}
          className={`card w-full text-left py-4 transition-shadow ${
            choice === "open" ? "ring-2 ring-[var(--color-purple)]" : ""
          }`}
        >
          I&apos;m comfortable sharing my exact words, and my name, with my
          team — as a step toward open conversation.
        </button>
      </div>

      {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

      <button
        type="button"
        onClick={onAdvance}
        disabled={!choice || saving}
        className="btn-primary"
      >
        Continue
      </button>
    </div>
  );
}
