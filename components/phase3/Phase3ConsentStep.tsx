"use client";

// Phase 3 has TWO independent confidentiality checks:
//   variant="story"    → after the stories (end of Team Stories)
//   variant="behavior" → after the board, in Finish
// Both default to opt-in (verbatim + name). Persisted on the members row via
// phase3_story_verbatim / phase3_behavior_verbatim.

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { AppSupabaseClient } from "@/components/interview/types";

type ShareChoice = "open" | "private";

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
        selected ? "border-2 border-[var(--color-purple)] bg-[var(--color-purple)]/5" : "border-2 border-transparent"
      }`}
    >
      <span
        className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs ${
          selected ? "border-[var(--color-purple)] bg-[var(--color-purple)] text-white" : "border-black/20 text-transparent"
        }`}
      >
        ✓
      </span>
      <span>{children}</span>
    </button>
  );
}

const COPY = {
  story: {
    intro: (name: string) =>
      `Thank you for sharing, ${name}. Please let me know if you're okay with me sharing your words verbatim along with your name, or if you'd rather keep your responses anonymous and have me paraphrase what you said.`,
    open: "Share my exact words, along with my name.",
    private: "Keep me anonymous — paraphrase what I said, don't attach my name.",
    noun: "stories",
  },
  behavior: {
    intro: () =>
      "I'd love to be able to share your ALWAYS and NEVER behaviours exactly as you've said them, along with your name. Is that okay with you?",
    open: "Share my behaviours in my exact words, along with my name.",
    private: "Keep me anonymous — paraphrase my behaviours, don't attach my name.",
    noun: "behaviours",
  },
};

type Props = {
  memberId: string;
  supabase: AppSupabaseClient;
  variant: "story" | "behavior";
  memberName: string;
  // Current stored value (true = opt-in verbatim + name).
  current: boolean;
  readAloud?: boolean;
  onSaved: (verbatim: boolean) => void;
  onComplete: () => void;
  bigOtis?: boolean;
};

export default function Phase3ConsentStep({
  memberId,
  supabase,
  variant,
  memberName,
  current,
  readAloud = false,
  onSaved,
  onComplete,
  bigOtis = true,
}: Props) {
  // Default opt-in unless the member has explicitly chosen private before.
  const [choice, setChoice] = useState<ShareChoice>(current === false ? "private" : "open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[variant];

  async function handleContinue() {
    setSaving(true);
    setError(null);
    const verbatim = choice === "open";
    const fields =
      variant === "story"
        ? { phase3_story_verbatim: verbatim }
        : { phase3_behavior_verbatim: verbatim };
    const { error: updateError } = await supabase
      .from("members")
      .update(fields)
      .eq("member_id", memberId);
    if (updateError) {
      console.error("[phase3/consent] failed to save:", updateError.message);
      setError("Something went wrong saving your choice. Please try again.");
      setSaving(false);
      return;
    }
    onSaved(verbatim);
    setSaving(false);
    onComplete();
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-4 pb-16">
      {bigOtis && <img src="/octopus-logo.png" alt="" className="otis-float h-28 w-auto mx-auto mb-8" />}

      <ChatBubble readAloud={readAloud} hideAvatar={bigOtis} centered={bigOtis}>
        {copy.intro(memberName)}
      </ChatBubble>

      <div className="space-y-3 mt-6 mb-6">
        <RadioCard selected={choice === "open"} onSelect={() => setChoice("open")}>
          {copy.open}
        </RadioCard>
        <RadioCard selected={choice === "private"} onSelect={() => setChoice("private")}>
          {copy.private}
        </RadioCard>
      </div>

      <p className="text-sm text-[var(--color-grey)] mb-4">
        Complete anonymity can never be fully guaranteed, especially in small teams. You can change this later.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button type="button" onClick={handleContinue} disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Continue →"}
      </button>
    </div>
  );
}
