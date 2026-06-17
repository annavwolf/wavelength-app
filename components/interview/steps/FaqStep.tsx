"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, Team } from "@/types/database";

const FAQ_ITEMS = [
  {
    question: "Who will see my answers?",
    answer:
      "Nobody sees your exact words. Your manager, team leader, and teammates only see patterns across the whole group — never what you said individually.",
  },
  {
    question: "Can I stop and come back?",
    answer:
      "Yes. You can close this at any point and return using the same link. Your progress is saved automatically.",
  },
  {
    question: "How long will this take?",
    answer:
      "Around 20 to 30 minutes for this first conversation. You can go faster or slower — there's no time limit.",
  },
  {
    question: "What happens after this?",
    answer:
      "Once everyone on your team has spoken with me, I'll bring the findings together into a team report. Then I'll come back to each of you individually to check whether my conclusions make sense.",
  },
  {
    question: "Why is my organisation doing this?",
    answer:
      "Dr. Wolf, working with your team, wants to understand how the team is experiencing working together — and to open up an honest conversation about what could be better. This is about improving the team, not evaluating individuals.",
  },
  {
    question: "Is this being used to assess my performance?",
    answer:
      "No. This is not a performance assessment. Nothing you say here will be used to evaluate you individually or shared with anyone in a way that could affect your role.",
  },
  {
    question: "What if I decide I don't want to participate?",
    answer:
      "That's completely your choice. If you decide not to take part, just let Dr. Wolf know at anna.v.wolf@gmail.com and your data will be deleted within 30 days. You won't need to explain yourself.",
  },
  {
    question: "What is psychological safety?",
    answer:
      "Psychological safety is the shared sense that it's safe to speak up, take risks, and be honest on a team — without fear of being punished or embarrassed for doing so. It's one of the strongest predictors of how well teams perform, and it's what Wavelength is designed to help teams build.",
  },
];

export default function FaqStep({
  member,
  team,
  supabase,
  readAloud,
  question,
  onQuestionChange,
  acknowledged,
  onAcknowledged,
  onAdvance,
}: {
  member: Member;
  team: Team;
  supabase: AppSupabaseClient;
  readAloud: boolean;
  question: string;
  onQuestionChange: (value: string) => void;
  acknowledged: boolean;
  onAcknowledged: () => void;
  onAdvance: () => void;
}) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFaq(index: number) {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleSubmitQuestion() {
    if (!question.trim()) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("member_questions")
      .insert({
        member_id: member.member_id,
        team_id: team.team_id,
        question_text: question,
      });

    if (insertError) {
      console.error("[interview/faq] failed to save member question:", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
      // Show acknowledgment regardless — don't block progress over a question save.
    }

    setSaving(false);
    onAcknowledged();
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Before we get into the conversation itself, I want to make sure you
        feel comfortable. I&apos;ve put together answers to some questions
        people often have at this point — you can expand any of them below.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        And if you have something else on your mind, you can type it here
        — or, if you&apos;d like, this is a good moment to try the
        microphone. Just click the mic icon and speak naturally. I&apos;ll
        listen.
      </ChatBubble>

      <div className="space-y-2 mt-6 mb-8">
        {FAQ_ITEMS.map((item, i) => (
          <div key={item.question} className="card p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleFaq(i)}
              className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-medium"
            >
              <span>{item.question}</span>
              <span
                className="flex-shrink-0 text-[var(--color-purple)] transition-transform duration-200"
                style={{
                  transform: openIndices.has(i) ? "rotate(180deg)" : "none",
                }}
                aria-hidden
              >
                ▾
              </span>
            </button>
            {openIndices.has(i) && (
              <div className="px-5 pb-4 text-[var(--color-grey)] border-t border-black/5 pt-3">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>

      {!acknowledged ? (
        <div className="space-y-3 mb-6">
          <label className="form-label">
            Something on your mind? Ask me here (optional):
          </label>
          <VoiceTextInput
            value={question}
            onChange={onQuestionChange}
            placeholder="Type or speak your question..."
          />
          {error && (
            <p className="text-[var(--color-grey)] text-sm">{error}</p>
          )}
          {question.trim() && (
            <button
              type="button"
              onClick={handleSubmitQuestion}
              disabled={saving}
              className="btn-secondary"
            >
              {saving ? "Sending..." : "Ask this"}
            </button>
          )}
        </div>
      ) : (
        <div className="card mb-6 bg-[var(--color-purple)]/5 border border-[var(--color-purple)]/20">
          <p className="text-[var(--color-grey)]">
            Thanks for asking — I&apos;ve noted that, and you can always
            reach Dr. Wolf directly at anna.v.wolf@gmail.com.
          </p>
        </div>
      )}

      <button type="button" onClick={onAdvance} className="btn-primary">
        I&apos;m ready to begin
      </button>
    </div>
  );
}
