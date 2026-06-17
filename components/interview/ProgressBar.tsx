import type { InterviewStep } from "./types";

const STEP_ORDER: InterviewStep[] = [
  "landing",
  "foreshadow",
  "faq",
  "consent",
  "profile",
  "personal_context",
  "purpose",
  "roster",
  "coordination",
  "ps_intro_open",
  "ps_descent",
  "ps_intro_close",
  "ps_frame",
  "ps_diagnostic",
  "deadfish_intro",
  "deadfish",
  "deadfish_open",
  "review",
  // "close" is the terminal step — fraction reaches 1 when we get there.
];

export default function ProgressBar({ step }: { step: InterviewStep }) {
  const index = STEP_ORDER.indexOf(step);
  const fraction =
    step === "close" ? 1 : index === -1 ? 0 : (index + 1) / STEP_ORDER.length;

  return (
    <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden mb-12">
      <div
        className="h-full bg-[var(--color-purple)] transition-all duration-500 ease-out"
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}
