"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, Team } from "@/types/database";

const FAQ_ITEMS = [
  {
    question: "Who will see my answers?",
    answer:
      "Your team members and team lead. If you choose to remain anonymous, leads will see paraphrased information and team members will see patterns.",
  },
  {
    question: "Can I stop and come back?",
    answer:
      "Yes. You can close this at any point and return using the same link. Your progress is saved automatically.",
  },
  {
    question: "What happens after this?",
    answer:
      "Once everyone on your team has spoken with me, I'll analyze the information and get back to you with the results. We'll begin identifying ways to improve psychological safety.",
  },
  {
    question: "Is this being used to assess my performance?",
    answer:
      "No. This is not a performance assessment. Nothing you say here will be used to evaluate you, or anyone else, individually.",
  },
  {
    question: "What if I decide I don't want to participate?",
    answer:
      "That's completely your choice. If you decide not to take part there's an opt-out option at the end of this assessment.",
  },
  {
    question: "What is psychological safety?",
    answer:
      "Psychological safety is the shared sense that it's safe to be oneself, speak up, take risks, without fear of being punished for doing so.",
  },
];

// Keyword-based Q&A matching for Otis's live replies.
const QA_MATCHES: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["see", "who", "results", "access", "share", "view", "read"],
    answer:
      "Your team members and team lead will see the aggregated results. If you chose to remain anonymous, leads see paraphrased patterns — your specific words and name won't be attached.",
  },
  {
    keywords: ["stop", "come back", "return", "progress", "save", "pause", "later", "close"],
    answer:
      "Yes — you can close this at any point and return using the same link. Your progress is saved automatically.",
  },
  {
    keywords: ["after", "happens", "next", "then", "what will", "timeline"],
    answer:
      "Once everyone on your team has spoken with me, your consultant will analyze the results and be in touch. We'll identify where psychological safety could be stronger and how to build it.",
  },
  {
    keywords: ["performance", "assess", "evaluate", "judge", "rate"],
    answer:
      "No — this is not a performance assessment. Nothing you share here will be used to evaluate you, or anyone else, individually.",
  },
  {
    keywords: ["opt out", "don't want", "not participate", "leave", "quit", "withdraw", "skip"],
    answer:
      "Completely your choice. There's an opt-out option at the end of this assessment if you decide you'd rather not take part.",
  },
  {
    keywords: ["psychological safety", "what is", "define", "definition", "mean", "concept", "what does"],
    answer:
      "Psychological safety is the shared sense that it's safe to be yourself, speak up, and take calculated risks — without fear of being penalized for doing so.",
  },
  {
    keywords: ["anonymous", "anonymity", "private", "identity", "name", "confidential"],
    answer:
      "You'll choose your privacy level during the consent step. If you stay anonymous, your responses are paraphrased — your name is never attached to specific answers.",
  },
];

function findAnswer(question: string): string | null {
  const q = question.toLowerCase();
  for (const item of QA_MATCHES) {
    if (item.keywords.some((kw) => q.includes(kw))) return item.answer;
  }
  return null;
}

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
  const [otisReply, setOtisReply] = useState<string | null>(null);
  const [askedQuestion, setAskedQuestion] = useState("");

  const isAnonymous = !member.share_name_with_team;

  function toggleFaq(index: number) {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleAskQuestion() {
    if (!question.trim()) return;
    setSaving(true);

    const matched = findAnswer(question);
    setAskedQuestion(question);

    if (matched) {
      setOtisReply(matched);
    } else {
      // Save unmatched question to DB for follow-up.
      await supabase.from("member_questions").insert({
        member_id: member.member_id,
        team_id: team.team_id,
        question_text: question,
      });

      const anonNote = isAnonymous
        ? "Since you've chosen to stay anonymous, this note won't have your name attached."
        : "I've noted your name alongside the question so someone can get back to you directly.";

      setOtisReply(
        `I don't have an answer to that right now, but I've made a note of it so someone can follow up. ${anonNote}`
      );
    }

    onAcknowledged();
    setSaving(false);
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Got it. Do you have any questions for me at this point?
      </ChatBubble>

      <p className="text-sm text-[var(--color-grey)] mt-6 mb-3">
        Take a look at some frequently asked questions, if you like.
      </p>
      <div className="space-y-2 mb-8">
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
                style={{ transform: openIndices.has(i) ? "rotate(180deg)" : "none" }}
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
          {question.trim() && (
            <button
              type="button"
              onClick={handleAskQuestion}
              disabled={saving}
              className="btn-secondary"
            >
              {saving ? "Thinking..." : "Ask this"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {askedQuestion && <MemberBubble>{askedQuestion}</MemberBubble>}
          {otisReply && (
            <ChatBubble readAloud={readAloud}>{otisReply}</ChatBubble>
          )}
        </div>
      )}

      <button type="button" onClick={onAdvance} className="btn-primary">
        Start the Assessment
      </button>
    </div>
  );
}
