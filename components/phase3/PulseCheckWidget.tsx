"use client";

// §2.5 — Per-zone pulse check widget.
// Shown inline beside each zone read and the shared-purpose read.
// Two parts: forced-choice rating (auto-saves on selection) + optional comment expander.

import { useEffect, useState } from "react";
import type { PulseCheckKey, PulseCheckRating } from "@/types/database";

const RATINGS: PulseCheckRating[] = [
  "Not at all accurate",
  "Somewhat accurate",
  "Very accurate",
  "Don't know",
  "Decline to answer",
];

type Props = {
  memberId: string;
  teamId: string;
  readKey: PulseCheckKey;
};

export default function PulseCheckWidget({ memberId, teamId, readKey }: Props) {
  const [rating, setRating] = useState<PulseCheckRating | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [commentSaved, setCommentSaved] = useState(false);

  // Restore prior answer on mount.
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

  async function saveRating(r: PulseCheckRating) {
    setRating(r);
    setSaving(true);
    await fetch("/api/phase3/pulse-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, team_id: teamId, read_key: readKey, accuracy_rating: r, comment: comment || null }),
    });
    setSaving(false);
  }

  async function saveComment() {
    if (!rating) return;
    setSaving(true);
    await fetch("/api/phase3/pulse-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, team_id: teamId, read_key: readKey, accuracy_rating: rating, comment: comment || null }),
    });
    setSaving(false);
    setCommentSaved(true);
    setTimeout(() => setCommentSaved(false), 2000);
  }

  return (
    <div className="pt-3 border-t border-black/8 space-y-3">
      <p className="text-xs font-medium text-[var(--color-grey)]">
        How accurate do you feel Otis&apos;s conclusions are?
      </p>

      {/* Forced-choice rating */}
      <div className="flex flex-wrap gap-2">
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => void saveRating(r)}
            disabled={saving}
            className={[
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              rating === r
                ? "bg-[var(--color-purple)] border-[var(--color-purple)] text-white"
                : "border-black/15 text-[var(--color-grey)] hover:border-[var(--color-purple)]/50 hover:text-[var(--color-ink)]",
            ].join(" ")}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Optional comment expander */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--color-grey)] hover:text-[var(--color-ink)] select-none">
          Share a comment (optional)
        </summary>
        <div className="mt-2 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => { setComment(e.target.value); setCommentSaved(false); }}
            rows={3}
            placeholder="Your thoughts…"
            className="form-input text-sm w-full resize-y"
          />
          <p className="text-[10px] text-[var(--color-grey)]">
            This stays private to your consultant.
          </p>
          <button
            type="button"
            onClick={() => void saveComment()}
            disabled={saving || !rating}
            className="btn-secondary"
            style={{ padding: "4px 12px", fontSize: "12px" }}
          >
            {saving ? "Saving…" : commentSaved ? "Saved" : "Save comment"}
          </button>
        </div>
      </details>
    </div>
  );
}
