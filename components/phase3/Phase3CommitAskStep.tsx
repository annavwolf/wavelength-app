"use client";

// Team Agreement — the 30-day commitment question. Clickable option cards that
// colour when selected; after a choice, Otis asks "What do you think the result
// would be?" (replaces the old free-text "tell me more").

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { ContextCommitment } from "@/types/database";

const COMMITMENTS: ContextCommitment[] = ["Yes", "It depends", "I don't think so"];

type Props = {
  memberId: string;
  teamId: string;
  readAloud?: boolean;
  onComplete: () => void;
};

export default function Phase3CommitAskStep({ memberId, teamId, readAloud = false, onComplete }: Props) {
  const [commitment, setCommitment] = useState<ContextCommitment | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/phase3/context?member_id=${memberId}&team_id=${teamId}`);
        const data = await res.json().catch(() => ({}));
        if (data?.context?.commitment) setCommitment(data.context.commitment as ContextCommitment);
        if (data?.context?.commitment_result) setResult(data.context.commitment_result as string);
      } catch { /* non-blocking */ }
    })();
  }, [memberId, teamId]);

  async function submit() {
    if (!commitment) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/phase3/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId, team_id: teamId, phase: "commitment",
          commitment, commitment_result: result.trim(),
        }),
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
        Would you be open to forming an agreement with your team about which ALWAYS and NEVER behaviours to follow, and
        sticking to this for 30 days?
      </ChatBubble>

      <div className="space-y-2">
        {COMMITMENTS.map((c) => {
          const selected = commitment === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCommitment(c)}
              disabled={busy}
              className={`select-option w-full text-left px-4 py-3.5 text-base ${selected ? "is-selected font-medium" : ""}`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {commitment && (
        <div className="space-y-2">
          <ChatBubble readAloud={readAloud}>What do you think the result would be?</ChatBubble>
          <VoiceTextarea value={result} onChange={setResult} rows={3} placeholder="Share what comes to mind…" />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={() => void submit()} disabled={!commitment || busy} className="btn-primary">
        {busy ? "Saving…" : "Continue →"}
      </button>
    </div>
  );
}
