"use client";

// Team Stories — the frequency pulse question, on its own page (split out from
// the old combined impact+frequency step). Impact is now a turn-based chat.

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { ContextFrequency } from "@/types/database";

const FREQUENCIES: ContextFrequency[] = [
  "Several times a day",
  "Several times a week",
  "Several times a month",
  "Several times a year",
];

// Semantic colour scale — more frequent reads as more pressing (red), less
// frequent as calmer (green).
const FREQ_COLOR: Record<ContextFrequency, string> = {
  "Several times a day": "#B94040",
  "Several times a week": "#C4860A",
  "Several times a month": "#4F9C82",
  "Several times a year": "#2D7A4F",
};

type Props = {
  memberId: string;
  teamId: string;
  onComplete: () => void;
  readAloud?: boolean;
};

export default function Phase3FrequencyStep({ memberId, teamId, onComplete, readAloud = false }: Props) {
  const [frequency, setFrequency] = useState<ContextFrequency | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume a previously chosen frequency.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/phase3/context?member_id=${memberId}&team_id=${teamId}`);
        const data = await res.json().catch(() => ({}));
        if (data?.context?.frequency) setFrequency(data.context.frequency as ContextFrequency);
      } catch {
        /* non-blocking */
      }
    })();
  }, [memberId, teamId]);

  async function submit() {
    if (!frequency) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/phase3/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, team_id: teamId, phase: "context", frequency }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = [data.error, data.detail].filter(Boolean).join(" — ");
        setError(detail ? `Couldn't save your answer: ${detail}` : "Something went wrong. Please try again.");
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
    <div className="w-full max-w-2xl mx-auto px-6 pt-6 pb-16 space-y-8">
      <ChatBubble readAloud={readAloud}>How often do you experience things like this happening?</ChatBubble>

      <div className="space-y-2.5">
        {FREQUENCIES.map((f) => {
          const selected = frequency === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              disabled={busy}
              className="w-full text-left rounded-xl border-2 px-4 py-3.5 text-base flex items-center gap-3 transition-all"
              style={{
                borderColor: FREQ_COLOR[f],
                backgroundColor: selected ? FREQ_COLOR[f] : `${FREQ_COLOR[f]}14`,
                color: selected ? "#fff" : "var(--color-ink)",
                fontWeight: selected ? 600 : 500,
                boxShadow: selected ? `0 2px 10px ${FREQ_COLOR[f]}55` : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <span
                aria-hidden
                className="flex-shrink-0 rounded-full border-2"
                style={{ width: 12, height: 12, backgroundColor: selected ? "#fff" : FREQ_COLOR[f], borderColor: selected ? "#fff" : FREQ_COLOR[f] }}
              />
              {f}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={() => void submit()} disabled={!frequency || busy} className="btn-primary">
        {busy ? "Saving…" : "Continue →"}
      </button>
    </div>
  );
}
