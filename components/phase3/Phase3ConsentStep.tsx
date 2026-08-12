"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";

type Variant = "story" | "behavior";

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`card w-full text-left border-2 ${selected ? "border-[var(--color-purple)] bg-[var(--color-purple)]/5" : "border-transparent"}`}>
      {children}
    </button>
  );
}

// Phase 3 no longer creates a separate name-sharing consent. It simply lets a
// participant reaffirm or change the global exact-word preference selected at
// the mandatory beta privacy gate.
export default function Phase3ConsentStep({
  variant,
  memberName,
  readAloud = false,
  onSaved,
  onComplete,
}: {
  variant: Variant;
  memberName: string;
  readAloud?: boolean;
  onSaved: (verbatim: boolean) => void;
  onComplete: () => void;
  bigOtis?: boolean;
}) {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = variant === "story" ? "stories" : "behaviours";

  async function continueToNext() {
    if (choice === null) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/member/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verbatim_preference: choice ? "verbatim" : "summary_only" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Something went wrong saving your choice. Please try again.");
        return;
      }
      onSaved(choice);
      onComplete();
    } catch {
      setError("Something went wrong saving your choice. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-4 pb-16">
      <img src="/octopus-logo.png" alt="" className="otis-float h-28 w-auto mx-auto mb-8" />
      <ChatBubble readAloud={readAloud} hideAvatar centered>
        Before we continue, confirm how you would like your {label} handled, {memberName}.
      </ChatBubble>
      <p className="text-sm text-[var(--color-grey)] mt-4 mb-4">You already acknowledged the current beta privacy notice. This only reviews or updates your global exact-word choice; your name is never attached to an excerpt.</p>
      <div className="space-y-3">
        <Choice selected={choice === false} onClick={() => setChoice(false)}><strong>Use summaries and paraphrases only.</strong><br />Do not use my exact words in team materials.</Choice>
        <Choice selected={choice === true} onClick={() => setChoice(true)}><strong>Permit short exact excerpts without my name.</strong><br />Otis may use a short exact excerpt in team material, never attributed to you by name.</Choice>
      </div>
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      <button type="button" onClick={continueToNext} disabled={choice === null || saving} className="btn-primary mt-6">{saving ? "Saving..." : "Continue →"}</button>
    </div>
  );
}
