"use client";

// Phase 4 self-serve §1.2 — asked right before the end of Phase 3.
// Commitment (single select + conditional comment) + Synchronicity (single
// select whose wording lists all roster names Otis knows).

import { useState } from "react";
import type { ContextCommitment, ContextSynchronicity } from "@/types/database";

const COMMITMENTS: ContextCommitment[] = ["Yes", "It depends", "I don't think so"];

const SYNC_OPTIONS: ContextSynchronicity[] = [
  "Easy, we do it regularly",
  "It happens occasionally",
  "Easier with some people, but not everyone",
  "Not easy, we rarely do this",
];

type Props = {
  memberId: string;
  teamId: string;
  rosterNames: string[];
  onComplete: () => void;
};

export default function Phase3CommitmentStep({ memberId, teamId, rosterNames, onComplete }: Props) {
  const [commitment, setCommitment] = useState<ContextCommitment | null>(null);
  const [comment, setComment] = useState("");
  const [synchronicity, setSynchronicity] = useState<ContextSynchronicity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsComment = commitment === "It depends" || commitment === "I don't think so";
  const canSubmit = commitment !== null && synchronicity !== null;

  const rosterList =
    rosterNames.length > 0
      ? ` including ${rosterNames.join(", ")}`
      : "";

  async function submit() {
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
          phase: "commitment",
          commitment,
          commitment_comment: needsComment ? comment.trim() : "",
          synchronicity,
        }),
      });
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
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
          <p className="text-base leading-relaxed">Last two questions, then you&apos;re done.</p>
        </div>

        {/* Commitment */}
        <div className="space-y-2">
          <label className="text-base leading-relaxed block">
            Would you be open to a 30-day game plan where your team puts new behaviours into practice?
          </label>
          <div className="space-y-2">
            {COMMITMENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCommitment(c)}
                disabled={busy}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                  commitment === c
                    ? "border-[var(--color-navy)] bg-[var(--color-navy)]/5 font-medium"
                    : "border-black/10 hover:border-black/25"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {needsComment && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="form-input text-sm w-full resize-y mt-1"
              placeholder="Can you tell me more?"
              disabled={busy}
            />
          )}
        </div>

        {/* Synchronicity */}
        <div className="space-y-2">
          <label className="text-base leading-relaxed block">
            How easy is it for your team to meet synchronously on a weekly or bi-weekly basis{rosterList}?
          </label>
          <div className="space-y-2">
            {SYNC_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSynchronicity(s)}
                disabled={busy}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                  synchronicity === s
                    ? "border-[var(--color-navy)] bg-[var(--color-navy)]/5 font-medium"
                    : "border-black/10 hover:border-black/25"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit || busy}
          className="btn-primary"
        >
          {busy ? "Saving…" : "Finish →"}
        </button>
      </div>
    </main>
  );
}
