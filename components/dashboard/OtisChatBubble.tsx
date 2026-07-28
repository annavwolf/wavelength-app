"use client";

import { useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };

// Floating, persistent Otis chat (spec §4): an octopus button fixed bottom-right
// that opens a chat panel overlaying the page, available in both tabs. Talks to
// /api/analysis/chat over the same tier1/tier2 package. Ephemeral — not saved.
export default function OtisChatBubble({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = [data.error, data.detail].filter(Boolean).join(" — ");
        setError(`Otis couldn't respond: ${detail || "unknown error"}`);
        setSending(false);
        return;
      }
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Something went wrong reaching Otis. Please try again.");
    }
    setSending(false);
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[min(92vw,380px)] max-h-[70vh] flex flex-col rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10">
            <div className="flex items-center gap-2">
              <img src="/octopus-logo.png" alt="" className="h-7 w-7 rounded object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <span className="text-sm font-medium" style={{ fontFamily: "Playfair Display, serif" }}>Talk it through with Otis</span>
            </div>
            <button type="button" onClick={() => setOpen(false)}
              className="text-[var(--color-grey)] hover:text-[var(--color-ink)] text-xl leading-none px-1">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--color-grey)]">
                Push back on the read, propose a different focus, or ask anything about the analysis. Otis follows your lead.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[var(--color-navy)] text-white"
                    : "bg-[var(--color-purple)]/8 border border-[var(--color-purple)]/20"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2 text-sm bg-[var(--color-purple)]/8 border border-[var(--color-purple)]/20 text-[var(--color-grey)] italic">
                  Otis is thinking...
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="border-t border-black/10 p-3">
            <div className="flex items-end gap-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
                placeholder="Ask Otis..." className="form-input flex-1" style={{ resize: "none" }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button type="button" onClick={send} disabled={sending || !input.trim()}
                className="btn-primary flex-shrink-0" style={{ padding: "8px 16px" }}>Send</button>
            </div>
            <p className="text-xs text-[var(--color-grey)] mt-2">Just for you — not saved, members never see it.</p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Talk to Otis"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-[var(--color-navy)] shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity">
        <img src="/octopus-logo.png" alt="" className="h-9 w-9 rounded object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      </button>
    </>
  );
}
