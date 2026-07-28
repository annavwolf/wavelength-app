"use client";

import { useEffect, useRef, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ConvState = {
  story_complete: boolean;
  bridge_complete: boolean;
  story_text: string;
};

type Props = {
  memberId: string;
  teamId: string;
  statementId: number;
  memberName: string;
  // Called when conversation is fully done (bridge delivered).
  onComplete: () => void;
  // An external nudge from the behaviors API — Otis displays it as a message.
  nudge: string | null;
  onNudgeSeen: () => void;
};

export default function Phase3Chat({
  memberId,
  teamId,
  statementId,
  memberName,
  onComplete,
  nudge,
  onNudgeSeen,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ConvState>({ story_complete: false, bridge_complete: false, story_text: "" });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const kickedOff = useRef(false);

  // Otis opens first.
  useEffect(() => {
    if (kickedOff.current) return;
    kickedOff.current = true;
    void callConversation([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, nudge]);

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

      const nextMessages: ChatMessage[] = [...convo, { role: "assistant", content: data.say }];
      setMessages(nextMessages);
      setState(data.state as ConvState);

      if (data.bridge_complete) {
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

  // After bridge is delivered, the chat becomes an assistance-only channel.
  const isBridgeDone = state.bridge_complete;

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m, i) =>
        m.role === "assistant" ? (
          <ChatBubble key={i} readAloud={false}>
            {m.content}
          </ChatBubble>
        ) : (
          <div key={i} className="flex justify-end">
            <div className="card py-3 px-5 max-w-[480px] bg-[var(--color-purple)]/10">
              <p className="text-sm">{m.content}</p>
            </div>
          </div>
        )
      )}

      {/* Nudge from coaching checks shown as an Otis message */}
      {nudge && (
        <ChatBubble readAloud={false}>
          {nudge}
          <button
            type="button"
            onClick={onNudgeSeen}
            className="block mt-2 text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline"
          >
            Got it
          </button>
        </ChatBubble>
      )}

      {sending && (
        <p className="text-sm text-[var(--color-grey)] ml-13 mb-2">Otis is thinking…</p>
      )}

      <div ref={scrollRef} />

      {/* Input — hidden after bridge is fully done unless there's a nudge to dismiss */}
      {!isBridgeDone && (
        <div className="flex gap-2 mt-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
            placeholder="Reply to Otis…"
            className="form-input flex-1 text-sm"
            disabled={sending}
          />
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
