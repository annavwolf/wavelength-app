"use client";

import { useEffect, useRef, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import MicButton from "@/components/interview/MicButton";
import type { Phase3ConversationKind } from "@/types/database";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ConvState = {
  story_complete: boolean;
  bridge_complete: boolean;
  story_text: string;
  impact_complete: boolean;
  impact_text: string;
};

function emptyState(): ConvState {
  return { story_complete: false, bridge_complete: false, story_text: "", impact_complete: false, impact_text: "" };
}

type Props = {
  memberId: string;
  teamId: string;
  statementId: number;
  memberName: string;
  // "story" = Team Stories chat; "impact" = impact-on-work chat.
  kind?: Phase3ConversationKind;
  // Called when the conversation is fully done (bridge for story, complete for impact).
  onComplete: () => void;
  // Reports whether Otis is loading/thinking, so the parent can block "Continue"
  // until a turn has finished (avoids breezing past mid-response).
  onBusyChange?: (busy: boolean) => void;
  // An external nudge from the behaviors API — Otis displays it as a message.
  nudge?: string | null;
  onNudgeSeen?: () => void;
  readAloud?: boolean;
};

export default function Phase3Chat({
  memberId,
  teamId,
  statementId,
  memberName,
  kind = "story",
  onComplete,
  onBusyChange,
  nudge,
  onNudgeSeen,
  readAloud = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ConvState>(emptyState());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const kickedOff = useRef(false);

  // Load the durable transcript first; only kick off a fresh opening if none.
  useEffect(() => {
    if (kickedOff.current) return;
    kickedOff.current = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/phase3/conversation?member_id=${memberId}&team_id=${teamId}&kind=${kind}`
        );
        const data = await res.json().catch(() => ({}));
        const existing: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
        const existingState: ConvState = data.state ? { ...emptyState(), ...data.state } : emptyState();
        if (existing.length > 0) {
          setMessages(existing);
          setState(existingState);
          setLoading(false);
          return;
        }
      } catch {
        // fall through to kick-off
      }
      setLoading(false);
      await callConversation([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, nudge]);

  // Surface busy state to the parent so it can gate its "Continue" button.
  useEffect(() => {
    onBusyChange?.(sending || loading);
  }, [sending, loading, onBusyChange]);

  async function callConversation(convo: ChatMessage[]) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/phase3/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          team_id: teamId,
          statement_id: statementId,
          member_name: memberName,
          kind,
          messages: convo,
          state,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setSending(false);
        return;
      }

      setMessages([...convo, { role: "assistant", content: data.say }]);
      setState(data.state as ConvState);

      if (kind === "impact" ? data.impact_complete : data.story_complete) {
        onComplete();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    const convo: ChatMessage[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(convo);
    setInput("");
    await callConversation(convo);
  }

  const isDone = kind === "impact" ? state.impact_complete : state.story_complete;

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m, i) =>
        m.role === "assistant" ? (
          <ChatBubble key={i} readAloud={readAloud}>
            {m.content}
          </ChatBubble>
        ) : (
          <MemberBubble key={i}>{m.content}</MemberBubble>
        )
      )}

      {/* Nudge from coaching checks shown as an Otis message */}
      {nudge && (
        <ChatBubble readAloud={readAloud}>
          {nudge}
          {onNudgeSeen && (
            <button
              type="button"
              onClick={onNudgeSeen}
              className="block mt-2 text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline"
            >
              Got it
            </button>
          )}
        </ChatBubble>
      )}

      {(sending || loading) && (
        <p className="text-sm text-[var(--color-grey)] ml-13 mb-2">Otis is thinking…</p>
      )}

      <div ref={scrollRef} />

      {/* Input stays available even after Otis stops — the member can keep
          adding. A fresh, empty box each turn (Phase 1 pattern). */}
      {!loading && (
        <div className="flex gap-2 mt-1">
          <div className="relative flex-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
              placeholder={isDone ? "Add anything else…" : "Reply to Otis…"}
              className="form-input w-full text-sm pr-12"
              disabled={sending}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <MicButton
                onResult={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !input.trim()}
            className="btn-primary"
            style={{ padding: "8px 18px", fontSize: "14px" }}
          >
            Send
          </button>
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-grey)]">{error}</p>}
    </div>
  );
}
