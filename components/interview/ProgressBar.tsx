import type { InterviewStep } from "./types";

// Only the steps built so far count toward the bar — 'ps_diagnostic',
// 'fish', and 'close' aren't rendered yet (see types.ts).
const STEP_ORDER: InterviewStep[] = [
  "landing",
  "foreshadow",
  "consent",
  "profile",
  "personal_context",
  "purpose",
  "roster",
  "coordination",
  "ps_intro",
  "ps_frame",
  "ps_diagnostic",
  "ps_reflect",
];

export default function ProgressBar({ step }: { step: InterviewStep }) {
  const index = STEP_ORDER.indexOf(step);
  const fraction =
    step === "end_of_pass1" ? 1 : index === -1 ? 0 : (index + 1) / STEP_ORDER.length;

  return (
    <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden mb-12">
      <div
        className="h-full bg-[var(--color-purple)] transition-all duration-500 ease-out"
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}
