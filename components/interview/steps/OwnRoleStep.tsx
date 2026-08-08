"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import VoiceTextarea from "@/components/interview/VoiceTextarea";

function isThin(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 40) return true;
  if (/^(yes|no|yeah|nope|sure|not really|i think so|i guess|maybe|idk|i don'?t know)\.?$/.test(t))
    return true;
  return false;
}

type Phase = "input" | "nudge" | "done";

export default function OwnRoleStep({
  readAloud,
  text,
  onTextChange,
  onAdvance,
}: {
  readAloud: boolean;
  text: string;
  onTextChange: (value: string) => void;
  onAdvance: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("input");

  function handleSubmit() {
    if (phase === "input" && isThin(text)) {
      setPhase("nudge");
      return;
    }
    setPhase("done");
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        And how about your role on the team? What skills, knowledge, or
        abilities do you contribute?
      </ChatBubble>

      {phase === "input" && (
        <>
          <div className="mt-6 mb-6">
            <VoiceTextarea
              value={text}
              onChange={onTextChange}
              rows={4}
              placeholder="Share what comes to mind..."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="btn-primary"
            >
              Share this
            </button>
            <button type="button" onClick={onAdvance} className="btn-secondary">
              Skip
            </button>
          </div>
        </>
      )}

      {phase === "nudge" && (
        <>
          <MemberBubble>{text}</MemberBubble>
          <ChatBubble readAloud={readAloud}>
            Can you give me a sense of what that looks like in practice —
            something specific you contribute that others might find hard to
            substitute?
          </ChatBubble>
          <div className="mt-6 mb-6">
            <VoiceTextarea
              value={text}
              onChange={onTextChange}
              rows={4}
              placeholder="A little more detail..."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPhase("done")}
              disabled={!text.trim()}
              className="btn-primary"
            >
              Share this
            </button>
            <button type="button" onClick={onAdvance} className="btn-secondary">
              Continue
            </button>
          </div>
        </>
      )}

      {phase === "done" && (
        <>
          <MemberBubble>{text}</MemberBubble>
          <button type="button" onClick={onAdvance} className="btn-primary mt-4">
            Continue
          </button>
        </>
      )}
    </div>
  );
}
