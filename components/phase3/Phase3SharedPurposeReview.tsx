"use client";

// Shared Purpose results — shown to members only when the consultant includes
// it, and placed BEFORE the psychological-safety zones. Mirrors the zone review:
// a plain-language classification visual + Otis's read + the accuracy pulse.

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { PulseCheckRating } from "@/types/database";
import { sharedPurposeClassificationLabel, sharedPurposeClassificationBlurb } from "@/lib/phase3Copy";

const RATINGS: PulseCheckRating[] = [
  "Not at all accurate",
  "Somewhat accurate",
  "Very accurate",
  "Don't know",
  "Decline to answer",
];

type Props = {
  read: string | undefined;
  classification: string | undefined;
  memberId: string;
  teamId: string;
  readAloud: boolean;
  onNext: () => void;
  nextLabel?: string;
};

export default function Phase3SharedPurposeReview({
  read, classification, memberId, teamId, readAloud, onNext, nextLabel = "Continue →",
}: Props) {
  const [rating, setRating] = useState<PulseCheckRating | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/phase3/pulse-check?member_id=${memberId}&team_id=${teamId}`);
      if (!res.ok) return;
      const data = await res.json();
      const existing = (data.checks ?? []).find(
        (c: { read_key: string; accuracy_rating: PulseCheckRating; comment: string | null }) => c.read_key === "purpose"
      );
      if (existing) { setRating(existing.accuracy_rating); setComment(existing.comment ?? ""); }
    }
    void load();
  }, [memberId, teamId]);

  async function save(nextRating: PulseCheckRating, nextComment: string): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/phase3/pulse-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, team_id: teamId, read_key: "purpose", accuracy_rating: nextRating, comment: nextComment || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "That rating was not saved. Please try again.");
        return false;
      }
      return true;
    } catch {
      setError("That rating was not saved. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function continueToNext() {
    if (!rating) {
      setError("Choose an answer before continuing. You can choose ‘Decline to answer’. ");
      return;
    }
    if (await save(rating, comment)) onNext();
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-4 pb-16 space-y-6">
      {/* Classification visual (qualitative, no raw numbers) */}
      <div className="rounded-2xl border border-[var(--color-navy)]/20 bg-[var(--color-navy)]/5 px-6 py-5">
        <p className="text-sm uppercase tracking-widest text-[var(--color-navy)] mb-1.5">Shared purpose</p>
        <p className="text-xl font-medium mb-1" style={{ fontFamily: "Playfair Display, serif" }}>
          {sharedPurposeClassificationLabel(classification)}
        </p>
        <p className="text-base text-[var(--color-ink)] leading-relaxed">
          {sharedPurposeClassificationBlurb(classification)}
        </p>
      </div>

      {read && <ChatBubble readAloud={readAloud}>{read}</ChatBubble>}

      <ChatBubble readAloud={readAloud}>How accurate do you feel my interpretation is?</ChatBubble>
      <div className="flex flex-wrap gap-2.5">
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => { setRating(r); void save(r, comment); }}
            disabled={saving}
            className={`select-pill text-base px-5 py-2.5 ${rating === r ? "is-selected" : ""}`}
          >
            {r}
          </button>
        ))}
      </div>

      <ChatBubble readAloud={readAloud}>Tell me your thoughts on this.</ChatBubble>
      <div>
        <VoiceTextarea value={comment} onChange={setComment} rows={3} placeholder="Your thoughts (optional)…" />
        <p className="text-sm text-[var(--color-grey)] mt-1">This stays private to your consultant.</p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button type="button" onClick={() => void continueToNext()} disabled={!rating || saving} className="btn-primary">
        {saving ? "Saving…" : nextLabel}
      </button>
    </div>
  );
}
