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

export default function PsImportanceStep({
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
  // Preserve the first response separately so nudge/done can show it as a
  // locked bubble while the textarea collects the follow-up.
  const [firstResponse, setFirstResponse] = useState("");
  const [addingMore, setAddingMore] = useState(false);
  const [moreText, setMoreText] = useState("");

  function handleSubmit() {
    if (phase === "input" && isThin(text)) {
      setFirstResponse(text);
      // Clear the shared textarea for a fresh follow-up response.
      onTextChange("");
      setPhase("nudge");
      return;
    }
    setFirstResponse(text);
    setPhase("done");
  }

  function handleNudgeSubmit() {
    setPhase("done");
  }

  return (
    <div className="flex flex-col items-center">
      {/* Big Otis returns above the chat, matching landing/close layout */}
      <img
        src="/octopus-logo.png"
        alt=""
        aria-hidden="true"
        className="otis-float h-32 w-auto mb-10"
      />

      <div className="w-full max-w-xl">
        <ChatBubble readAloud={readAloud} hideAvatar centered>
          Based on how I&apos;ve described psychological safety, do you think
          it&apos;s important for your team? Why or why not?
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
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="btn-primary"
            >
              Share this
            </button>
          </>
        )}

        {phase === "nudge" && (
          <>
            {/* First response locked as a bubble above the follow-up */}
            <MemberBubble>{firstResponse}</MemberBubble>
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              What makes you say that? Think about specific moments with your
              team.
            </ChatBubble>
            <div className="mt-6 mb-6">
              <VoiceTextarea
                value={text}
                onChange={onTextChange}
                rows={4}
                placeholder="A little more..."
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleNudgeSubmit}
                disabled={!text.trim()}
                className="btn-primary"
              >
                Share this
              </button>
              <button
                type="button"
                onClick={() => {
                  onTextChange(firstResponse);
                  setPhase("done");
                }}
                className="btn-secondary"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            {/* Show both the initial and follow-up responses */}
            {firstResponse && <MemberBubble>{firstResponse}</MemberBubble>}
            {text && text !== firstResponse && <MemberBubble>{text}</MemberBubble>}

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
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (moreText.trim()) {
                        const combined = (text || firstResponse) + "\n\n" + moreText;
                        onTextChange(combined);
                        setMoreText("");
                        setAddingMore(false);
                      }
                    }}
                    disabled={!moreText.trim()}
                    className="btn-primary"
                  >
                    Add this
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
    </div>
  );
}
