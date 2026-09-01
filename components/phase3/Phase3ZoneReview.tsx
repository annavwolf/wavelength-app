"use client";

// One zone's review screen in the member Assessment Results flow.
//   Reveal 0: the zone statistics card (lifted from the dashboard, NOT read
//     aloud) + Otis's read for the zone (read aloud). "Next" reveals the rest.
//   Reveal 1: the same content stays, plus the accuracy pulse check and an open
//     "your thoughts" box. "Next" advances to the following zone.
// Pulse ratings + comment persist to /api/phase3/pulse-check (per-zone read_key).

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import ZoneStatCard from "@/components/dashboard/ZoneStatCard";
import type { ZoneScore } from "@/components/dashboard/types";
import type { PulseCheckKey, PulseCheckRating } from "@/types/database";

const RATINGS: PulseCheckRating[] = [
  "Not at all accurate",
  "Somewhat accurate",
  "Very accurate",
  "Don't know",
  "Decline to answer",
];

type Props = {
  zone: 1 | 2 | 3;
  score: ZoneScore | undefined;
  read: string | undefined;
  memberId: string;
  teamId: string;
  readAloud: boolean;
  onNext: () => void;
  nextLabel?: string;
};

export default function Phase3ZoneReview({
  zone, score, read, memberId, teamId, readAloud, onNext, nextLabel = "Next →",
}: Props) {
  const readKey = `zone${zone}` as PulseCheckKey;
  const [rating, setRating] = useState<PulseCheckRating | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore any prior answer for this zone.
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/phase3/pulse-check?member_id=${memberId}&team_id=${teamId}`);
      if (!res.ok) return;
      const data = await res.json();
      const existing = (data.checks ?? []).find(
        (c: { read_key: string; accuracy_rating: PulseCheckRating; comment: string | null }) => c.read_key === readKey
      );
      if (existing) {
        setRating(existing.accuracy_rating);
        setComment(existing.comment ?? "");
      }
    }
    void load();
  }, [memberId, teamId, readKey]);

  async function save(nextRating: PulseCheckRating, nextComment: string): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/phase3/pulse-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          team_id: teamId,
          read_key: readKey,
          accuracy_rating: nextRating,
          comment: nextComment || null,
        }),
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

  function chooseRating(r: PulseCheckRating) {
    setRating(r);
    void save(r, comment);
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
      {/* Statistics card — the exact dashboard card, not read aloud */}
      {score && <ZoneStatCard z={score} />}

      {/* Otis's read — read aloud */}
      {read && <ChatBubble readAloud={readAloud}>{read}</ChatBubble>}

      {/* Accuracy pulse + open thoughts, shown together (no hidden step). */}
      <ChatBubble readAloud={readAloud}>How accurate do you feel my interpretations are?</ChatBubble>

      <div className="flex flex-wrap gap-2.5">
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => chooseRating(r)}
            disabled={saving}
            className={`select-pill text-base px-5 py-2.5 ${rating === r ? "is-selected" : ""}`}
          >
            {r}
          </button>
        ))}
      </div>

      <ChatBubble readAloud={readAloud}>Tell me your thoughts on these results.</ChatBubble>
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
