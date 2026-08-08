"use client";

// Team Agreement — synchronicity question. Roster shown Phase-1 style (chips)
// instead of names inline in the prompt.

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { ContextSynchronicity } from "@/types/database";

const SYNC_OPTIONS: ContextSynchronicity[] = [
  "Easily, we do it regularly",
  "Pretty easily, we do it occasionally",
  "Not so easy, we do it sometimes",
  "Difficult, we rarely meet all together",
  "It's easier with some people but not others",
];

type Props = {
  memberId: string;
  teamId: string;
  rosterNames: string[];
  readAloud?: boolean;
  onComplete: () => void;
};

export default function Phase3SyncStep({ memberId, teamId, rosterNames, readAloud = false, onComplete }: Props) {
  const [synchronicity, setSynchronicity] = useState<ContextSynchronicity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/phase3/context?member_id=${memberId}&team_id=${teamId}`);
        const data = await res.json().catch(() => ({}));
        if (data?.context?.synchronicity) setSynchronicity(data.context.synchronicity as ContextSynchronicity);
      } catch { /* non-blocking */ }
    })();
  }, [memberId, teamId]);

  async function submit() {
    if (!synchronicity) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/phase3/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, team_id: teamId, phase: "commitment", synchronicity }),
      });
      if (!res.ok) { setError("Something went wrong. Please try again."); setBusy(false); return; }
      onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-4 pb-16 space-y-6">
      <ChatBubble readAloud={readAloud}>
        How often does your team meet all together? How easily is this arranged? Remember, these are the people
        I&apos;m including in your team.
      </ChatBubble>

      {rosterNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rosterNames.map((name) => (
            <span
              key={name}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm text-[var(--color-ink)]"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {SYNC_OPTIONS.map((s) => {
          const selected = synchronicity === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSynchronicity(s)}
              disabled={busy}
              className={`select-option w-full text-left px-4 py-3.5 text-base ${selected ? "is-selected font-medium" : ""}`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={() => void submit()} disabled={!synchronicity || busy} className="btn-primary">
        {busy ? "Saving…" : "Continue →"}
      </button>
    </div>
  );
}
