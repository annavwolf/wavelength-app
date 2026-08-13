"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import MemberBubble from "@/components/interview/MemberBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { Member } from "@/types/database";

const FAQ_ITEMS = [
  {
    question: "Can I stop and come back?",
    answer:
      "Yes. You can close this at any point and return using the same link. Your progress is saved automatically.",
  },
  {
    question: "What happens after this?",
    answer:
      "Once enough team members have participated, Otis can create a team-level analysis. Your consultant will decide when to share any next steps with the team.",
  },
  {
    question: "Is this being used to assess my performance?",
    answer:
      "No. This is not a performance assessment. Nothing you say here will be used to evaluate you, or anyone else, individually.",
  },
  {
    question: "What is psychological safety?",
    answer:
      "Psychological safety is the shared sense that it is safe to be oneself, speak up, and take risks without fear of being punished or humiliated.",
  },
];

const QA_MATCHES: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["stop", "come back", "return", "progress", "save", "pause", "later", "close"],
    answer:
      "Yes. You can close this at any point and return using the same link. Your progress is saved automatically.",
  },
  {
    keywords: ["after", "happens", "next", "then", "what will", "timeline"],
    answer:
      "Once enough team members have participated, your consultant can ask Otis to analyse team-level patterns and will be in touch about next steps.",
  },
  {
    keywords: ["performance", "assess", "evaluate", "judge", "rate"],
    answer:
      "No. This is not a performance assessment. Nothing you share here will be used to evaluate you, or anyone else, individually.",
  },
  {
    keywords: ["psychological safety", "what is", "define", "definition", "mean", "concept", "what does"],
    answer:
      "Psychological safety is the shared sense that it is safe to be yourself, speak up, and take calculated risks without fear of being penalized or humiliated.",
  },
];

function findAnswer(question: string): string | null {
  const normalized = question.toLowerCase();
  return QA_MATCHES.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)))?.answer ?? null;
}

export default function FaqStep({
  member,
  readAloud,
  question,
  onQuestionChange,
  acknowledged,
  onAcknowledged,
  onAdvance,
}: {
  member: Member;
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

  function toggleFaq(index: number) {
    setOpenIndices((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleAskQuestion() {
    if (!question.trim()) return;
    setSaving(true);
    setAskedQuestion(question);

    const matched = findAnswer(question);
    if (matched) {
      setOtisReply(matched);
    } else {
      try {
        const response = await fetch("/api/interview/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: member.member_id, kind: "question", question_text: question }),
        });
        setOtisReply(
          response.ok
            ? "I do not have an answer to that right now, but I have made a note so your consultant can follow up. Your question is recorded without adding a name-to-answer label."
            : "I could not save that question right now. Please try again, or ask your consultant directly."
        );
      } catch {
        setOtisReply("I could not save that question right now. Please try again, or ask your consultant directly.");
      }
    }
    onAcknowledged();
    setSaving(false);
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>Before we move on to the assessment, do you have any questions for me? Feel free to read these FAQs.</ChatBubble>
      <p className="text-base text-[var(--color-grey)] mt-6 mb-3">Here are a few practical questions. Your privacy and participation choices are already covered in the privacy information you acknowledged.</p>
      <div className="space-y-2 mb-8">
        {FAQ_ITEMS.map((item, index) => (
          <div key={item.question} className="card p-0 overflow-hidden">
            <button type="button" onClick={() => toggleFaq(index)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-medium">
              <span>{item.question}</span>
              <span className="flex-shrink-0 text-[var(--color-purple)]" aria-hidden>{openIndices.has(index) ? "−" : "+"}</span>
            </button>
            {openIndices.has(index) && <div className="px-5 pb-4 text-[var(--color-grey)] border-t border-black/5 pt-3">{item.answer}</div>}
          </div>
        ))}
      </div>

      {!acknowledged ? (
        <div className="space-y-3 mb-6">
          <label className="form-label">Something on your mind? Ask me here (optional):</label>
          <VoiceTextInput value={question} onChange={onQuestionChange} placeholder="Type or speak your question..." />
          {question.trim() && <button type="button" onClick={handleAskQuestion} disabled={saving} className="btn-secondary">{saving ? "Thinking..." : "Ask this"}</button>}
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {askedQuestion && <MemberBubble>{askedQuestion}</MemberBubble>}
          {otisReply && <ChatBubble readAloud={readAloud}>{otisReply}</ChatBubble>}
        </div>
      )}

      <button type="button" onClick={onAdvance} className="btn-primary">Start the assessment</button>
    </div>
  );
}
