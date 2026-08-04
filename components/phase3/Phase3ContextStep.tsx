"use client";

// Phase 4 self-serve §1.1 — asked after storytelling, before the never/always
// board. Impact (open response, with one optional Otis follow-up) + Frequency.

import { useState } from "react";
import type { ContextFrequency } from "@/types/database";

const FREQUENCIES: ContextFrequency[] = [
  "Several times a day",
  "Several times a week",
  "Several times a month",
  "Several times a year",
];

type Props = {
  memberId: string;
  teamId: string;
  onComplete: () => void;
};

export default function Phase3ContextStep({ memberId, teamId, onComplete }: Props) {
  const [impact, setImpact] = useState("");
  const [frequency, setFrequency] = useState<ContextFrequency | null>(null);
  const [followup, setFollowup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = impact.trim().length > 0 && frequency !== null;

  async function submit(skipFollowup: boolean) {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/phase3/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          team_id: teamId,
          phase: "context",
          impact_text: impact.trim(),
          frequency,
          skip_followup: skipFollowup,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      if (data.followup && !skipFollowup) {
        setFollowup(data.followup as string);
        setBusy(false);
        return;
      }
      onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex-1">
      <div className="w-full max-w-2xl mx-auto px-6 pt-12 pb-16 space-y-8">
        <img src="/octopus-logo.png" alt="" className="h-10 w-auto" />

        <div className="rounded-2xl border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/4 px-6 py-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-[var(--color-purple)]">Otis</p>
          <p className="text-base leading-relaxed">
            Before we move on, two quick questions about what you&apos;ve been describing.
          </p>
        </div>

        {/* Impact */}
        <div className="space-y-2">
          <label className="text-base leading-relaxed block">
            What impact do you think incidents like this have on the quality of the team&apos;s work, or on the welfare of the team?
          </label>
          <textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            rows={4}
            className="form-input text-sm w-full resize-y"
            placeholder="Share what comes to mind…"
            disabled={busy}
          />
        </div>

        {/* Follow-up (shown once if only one dimension was addressed) */}
        {followup && (
          <div className="rounded-2xl border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/4 px-5 py-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-[var(--color-purple)]">Otis</p>
            <p className="text-sm leading-relaxed">{followup}</p>
            <p className="text-xs text-[var(--color-grey)]">Add to your answer above, then continue.</p>
          </div>
        )}

        {/* Frequency */}
        <div className="space-y-2">
          <label className="text-base leading-relaxed block">
            How often do you experience things like this happening?
          </label>
          <div className="space-y-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                disabled={busy}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                  frequency === f
                    ? "border-[var(--color-navy)] bg-[var(--color-navy)]/5 font-medium"
                    : "border-black/10 hover:border-black/25"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => void submit(followup !== null)}
          disabled={!canSubmit || busy}
          className="btn-primary"
        >
          {busy ? "Saving…" : "Continue →"}
        </button>
      </div>
    </main>
  );
}
