"use client";

import { useEffect, useRef, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, PsLabel, PsStatement, Team } from "@/types/database";
import { selectProbeItems, type ProbeSelection, type SelectedItem } from "@/lib/psSelection";
import { ALL_POSITIVE_ITEM_IDS, type Bucket } from "@/prompts/ps_interview";
import { PS_LABEL_WORD } from "@/lib/psLabels";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ProbeState = {
  turns: Record<Bucket, number>;
  buckets: Record<Bucket, string>;
};

// The item currently being probed, plus the flag that shifts the script to the
// §5 reframed wording.
type ActiveItem = {
  statement: PsStatement;
  label: PsLabel;
  isAllPositive: boolean;
};

export default function PsInterviewStep({
  member,
  team,
  statements,
  supabase,
  ratings,
  readAloud,
  onAdvance,
}: {
  member: Member;
  team: Team;
  statements: PsStatement[];
  supabase: AppSupabaseClient;
  ratings: Record<number, PsLabel>;
  readAloud: boolean;
  onAdvance: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selection, setSelection] = useState<ProbeSelection | null>(null);
  // Labels resolved for reference in the opening recap and all-positive save.
  const [resolvedRatings, setResolvedRatings] = useState<Record<number, PsLabel>>({});

  // Negative branch: the ordered items still to probe. All-positive: filled
  // once the member picks an item.
  const [queue, setQueue] = useState<SelectedItem[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);

  // All-positive picker state.
  const [needsPick, setNeedsPick] = useState(false);

  // Active-item conversation state.
  const [active, setActive] = useState<ActiveItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [probeState, setProbeState] = useState<ProbeState | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const kickedOffFor = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ── Load: resolve ratings, compute selection, find what's already done ──────
  useEffect(() => {
    async function load() {
      let effRatings = ratings;
      // On resume the in-memory draft is empty — rebuild from the DB.
      if (Object.keys(effRatings).length === 0) {
        const { data } = await supabase
          .from("ps_responses")
          .select("statement_id, label")
          .eq("member_id", member.member_id)
          .eq("round", 1);
        const rebuilt: Record<number, PsLabel> = {};
        for (const row of data ?? []) rebuilt[row.statement_id] = row.label as PsLabel;
        effRatings = rebuilt;
      }
      setResolvedRatings(effRatings);

      const sel = selectProbeItems(statements, effRatings);
      setSelection(sel);

      // Which items already have a saved interview row?
      const { data: doneRows } = await supabase
        .from("ps_interview_responses")
        .select("statement_id")
        .eq("member_id", member.member_id);
      const doneIds = new Set((doneRows ?? []).map((r) => r.statement_id));

      if (sel.allPositive) {
        // One reflection item, chosen by the member. If it's already saved,
        // we're done here.
        if (doneIds.size > 0) {
          onAdvance();
          return;
        }
        setNeedsPick(true);
        setLoading(false);
        return;
      }

      const remaining = sel.items.filter((i) => !doneIds.has(i.statement.statement_id));
      if (remaining.length === 0) {
        onAdvance();
        return;
      }
      setQueue(remaining);
      setQueueIdx(0);
      setActive({
        statement: remaining[0].statement,
        label: remaining[0].label,
        isAllPositive: false,
      });
      setLoading(false);
    }
    load().catch((e) => {
      console.error("[interview/ps_interview] load failed:", e);
      setError("Something went wrong loading your interview. Please refresh.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kick off the entry line whenever a new active item starts ───────────────
  useEffect(() => {
    if (!active) return;
    if (kickedOffFor.current === active.statement.statement_id) return;
    kickedOffFor.current = active.statement.statement_id;
    setMessages([]);
    setProbeState(null);
    void callProbe([], null, active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function callProbe(
    convo: ChatMessage[],
    state: ProbeState | null,
    item: ActiveItem
  ) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: member.member_id,
          statement_id: item.statement.statement_id,
          is_all_positive_branch: item.isAllPositive,
          messages: convo,
          state,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[interview/ps_interview] probe error:", data);
        setError("I had trouble responding just then. Please try again.");
        setSending(false);
        return;
      }

      const nextMessages: ChatMessage[] = [...convo, { role: "assistant", content: data.say }];
      setMessages(nextMessages);
      setProbeState(data.state as ProbeState);

      if (data.item_complete) {
        await saveItem(item, data.buckets as Record<Bucket, string>);
      }
    } catch (e) {
      console.error("[interview/ps_interview] probe fetch failed:", e);
      setError("I had trouble responding just then. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function saveItem(item: ActiveItem, buckets: Record<Bucket, string>) {
    const { error: saveError } = await supabase.from("ps_interview_responses").upsert(
      {
        member_id: member.member_id,
        team_id: team.team_id,
        statement_id: item.statement.statement_id,
        member_response_label: item.label,
        situation_text: buckets.situation || null,
        out_behavior_text: buckets.out_behavior || null,
        outcome_text: buckets.outcome || null,
        in_behavior_text: buckets.in_behavior || null,
        is_all_positive_branch: item.isAllPositive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,statement_id" }
    );

    if (saveError) {
      console.error("[interview/ps_interview] failed to save item:", {
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        code: saveError.code,
      });
      setError("That didn't save. Please try sending your last message again.");
      return;
    }

    advanceItem(item);
  }

  function advanceItem(justSaved: ActiveItem) {
    if (justSaved.isAllPositive) {
      onAdvance();
      return;
    }
    const nextIdx = queueIdx + 1;
    if (nextIdx >= queue.length) {
      onAdvance();
      return;
    }
    setQueueIdx(nextIdx);
    setActive({
      statement: queue[nextIdx].statement,
      label: queue[nextIdx].label,
      isAllPositive: false,
    });
  }

  async function handleSend() {
    if (!input.trim() || sending || !active) return;
    const convo: ChatMessage[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(convo);
    setInput("");
    await callProbe(convo, probeState, active);
  }

  function pickAllPositiveItem(statementId: number) {
    const statement = statements.find((s) => s.statement_id === statementId);
    if (!statement) return;
    setNeedsPick(false);
    setActive({
      statement,
      // In the all-positive branch the member scored this item well; store
      // their actual rating for Phase 2 context.
      label: resolvedRatings[statementId] ?? "agree",
      isAllPositive: true,
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-16 text-center text-[var(--color-grey)]">
        Reviewing your responses...
      </div>
    );
  }

  if (error && !active && !needsPick) {
    return <div className="py-16 text-center text-[var(--color-grey)]">{error}</div>;
  }

  // All-positive branch: §5 opening + item picker.
  if (needsPick && selection?.allPositive) {
    return (
      <div>
        <ChatBubble readAloud={readAloud}>
          You scored your team well across every question. That&apos;s a good sign, and
          it&apos;s worth saying: it sounds like you experience this team as a
          psychologically safe place to be. I still want to walk through one short
          reflection with you, because even strong teams have moments they could sharpen.
        </ChatBubble>
        <ChatBubble readAloud={readAloud}>
          I believe there&apos;s always a little room to grow. So instead of looking for a
          problem, I want you to think of a moment your team did fine, but might have done
          something even better with a small change in how you worked together.
        </ChatBubble>
        <ChatBubble readAloud={readAloud}>
          Pick whichever of these feels easier to think about:
        </ChatBubble>
        <div className="space-y-3 mt-4">
          {ALL_POSITIVE_ITEM_IDS.map((id) => {
            const s = statements.find((st) => st.statement_id === id);
            if (!s) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pickAllPositiveItem(id)}
                className="card w-full text-left py-4 border-2 border-transparent hover:border-[var(--color-purple)] transition-colors"
              >
                {s.statement_text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard opening recap (§4.1), shown above the live conversation.
  const openingRecap = selection && !selection.allPositive && (
    <>
      <ChatBubble readAloud={readAloud}>
        Thank you for filling out the questionnaire. I want to focus on some of your
        responses.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        {selection.items.length === 2 ? (
          <>
            Your response was &lsquo;{PS_LABEL_WORD[selection.items[0].label]}&rsquo; to the
            question &lsquo;{selection.items[0].statement.statement_text}&rsquo;, and
            &lsquo;{PS_LABEL_WORD[selection.items[1].label]}&rsquo; to the question &lsquo;
            {selection.items[1].statement.statement_text}&rsquo;.
          </>
        ) : (
          <>
            Your response was &lsquo;{PS_LABEL_WORD[selection.items[0].label]}&rsquo; to the
            question &lsquo;{selection.items[0].statement.statement_text}&rsquo;.
          </>
        )}
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        I&apos;d like you to tell me more about what led you to give this answer. For each
        one, think about a situation from the recent past that involved at least part of
        your team — a moment during a meeting, a project or task, or any other time.
      </ChatBubble>
    </>
  );

  return (
    <div>
      {openingRecap}

      {/* Live conversation */}
      <div className="mt-2">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <ChatBubble key={i} readAloud={readAloud}>
              {m.content}
            </ChatBubble>
          ) : (
            <div key={i} className="flex justify-end mb-4">
              <div className="card py-3 px-5 max-w-[480px] bg-[var(--color-purple)]/10">
                <p>{m.content}</p>
              </div>
            </div>
          )
        )}
        {sending && (
          <p className="text-sm text-[var(--color-grey)] ml-13 mb-4">Otis is thinking…</p>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Member input */}
      <div className="mt-4 space-y-3">
        <VoiceTextarea
          value={input}
          onChange={setInput}
          rows={3}
          placeholder="Type your answer…"
        />
        {error && <p className="text-sm text-[var(--color-grey)]">{error}</p>}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  );
}
