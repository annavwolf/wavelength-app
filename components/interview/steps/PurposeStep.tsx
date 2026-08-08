"use client";

import { useEffect, useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, Team } from "@/types/database";

function isThin(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 40) return true;
  if (/^(yes|no|yeah|nope|sure|not really|i think so|i guess|maybe|idk|i don'?t know)\.?$/.test(t))
    return true;
  return false;
}

type Phase = "input" | "nudge" | "done";

export default function PurposeStep({
  member,
  team,
  allMembers,
  supabase,
  readAloud,
  text,
  onTextChange,
  onAdvance,
}: {
  member: Member;
  team: Team;
  allMembers: Member[];
  supabase: AppSupabaseClient;
  readAloud: boolean;
  text: string;
  onTextChange: (value: string) => void;
  onAdvance: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    text ? "done" : "input"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMore, setAddingMore] = useState(false);
  const [moreText, setMoreText] = useState("");

  // Pre-populate from DB on mount if draft is empty (resumed session).
  useEffect(() => {
    if (text) return;
    supabase
      .from("purpose_responses")
      .select("purpose_text")
      .eq("member_id", member.member_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.purpose_text) {
          onTextChange(data.purpose_text);
          setPhase("done");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePurpose(finalText: string) {
    setSaving(true);
    setError(null);

    const { data: existing } = await supabase
      .from("purpose_responses")
      .select("id")
      .eq("member_id", member.member_id)
      .maybeSingle();

    const saveError = existing
      ? (
          await supabase
            .from("purpose_responses")
            .update({ purpose_text: finalText })
            .eq("member_id", member.member_id)
        ).error
      : (
          await supabase
            .from("purpose_responses")
            .insert({ member_id: member.member_id, team_id: team.team_id, purpose_text: finalText })
        ).error;

    if (saveError) {
      console.error("[interview/purpose] save failed:", saveError.message);
      setError("Something went wrong saving your answer. Please try again.");
      setSaving(false);
      return false;
    }

    setSaving(false);
    return true;
  }

  async function handleSubmit() {
    if (phase === "input" && isThin(text)) {
      setPhase("nudge");
      return;
    }
    const ok = await savePurpose(text);
    if (ok) setPhase("done");
  }

  async function handleMoreSubmit() {
    if (!moreText.trim()) return;
    const combined = text + "\n\n" + moreText;
    const ok = await savePurpose(combined);
    if (ok) {
      onTextChange(combined);
      setMoreText("");
      setAddingMore(false);
    }
  }

  return (
    <div>
      {/* Roster pinned at top throughout this screen */}
      <div className="space-y-2 mb-6">
        {allMembers.map((m) => (
          <div key={m.member_id} className="card flex items-center py-3">
            <p className="font-medium">
              {m.display_name}
              {m.member_id === member.member_id && (
                <span className="text-sm text-[var(--color-grey)]"> (you)</span>
              )}
            </p>
          </div>
        ))}
      </div>

      <ChatBubble readAloud={readAloud}>
        For me, a team exists when a group of people have complementary skills
        and depend on each other to reach common goals.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Looking at this team, can you tell me what it exists to do? What do you
        work together for — what&apos;s your shared goal and purpose?
      </ChatBubble>

      {phase === "input" && (
        <>
          <div className="mt-6 mb-6">
            <VoiceTextarea
              value={text}
              onChange={onTextChange}
              rows={5}
              placeholder="Share what comes to mind..."
            />
          </div>
          {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !text.trim()}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Share this"}
          </button>
        </>
      )}

      {phase === "nudge" && (
        <>
          <MemberBubble>{text}</MemberBubble>
          <ChatBubble readAloud={readAloud}>
            Can you say a bit more? What do you work together toward?
          </ChatBubble>
          <div className="mt-6 mb-6">
            <VoiceTextarea
              value={text}
              onChange={onTextChange}
              rows={5}
              placeholder="A little more detail..."
            />
          </div>
          {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !text.trim()}
              className="btn-primary"
            >
              {saving ? "Saving..." : "Share this"}
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await savePurpose(text);
                if (ok) setPhase("done");
              }}
              disabled={saving}
              className="btn-secondary"
            >
              Continue with this
            </button>
          </div>
        </>
      )}

      {phase === "done" && (
        <>
          <MemberBubble>{text}</MemberBubble>

          {addingMore ? (
            <>
              <div className="mt-4 mb-4">
                <VoiceTextarea
                  value={moreText}
                  onChange={setMoreText}
                  rows={3}
                  placeholder="Anything else to add..."
                />
              </div>
              {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleMoreSubmit}
                  disabled={saving || !moreText.trim()}
                  className="btn-primary"
                >
                  {saving ? "Saving..." : "Add this"}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingMore(false); setMoreText(""); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-3 mt-4">
              <button type="button" onClick={onAdvance} className="btn-primary">
                Continue
              </button>
              <button
                type="button"
                onClick={() => setAddingMore(true)}
                className="btn-secondary"
              >
                Add something else
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
