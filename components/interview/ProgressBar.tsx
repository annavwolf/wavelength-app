import type { InterviewStep } from "./types";

const SECTIONS: { label: string; steps: InterviewStep[]; color: string }[] = [
  {
    label: "Introduction",
    steps: ["landing"],
    color: "#6B4EA8",   // purple — matches the app's primary accent
  },
  {
    label: "Personal & team info",
    steps: ["profile", "roster", "profile_details", "purpose", "team_name", "own_role", "coordination"],
    color: "#A05A46",   // terracotta — matches rgba(160, 90, 70) section tint
  },
  {
    label: "Psychological safety",
    steps: ["ps_why", "faq", "ps_descent", "ps_diagnostic", "ps_importance"],
    color: "#1A5A6E",   // ocean teal — matches rgba(26, 90, 110) section tint
  },
  {
    label: "Finish",
    steps: ["what_happens_next", "review", "close"],
    color: "#9A5B06",   // warm gold — matches rgba(154, 91, 6) section tint
  },
];

const ORDERED: InterviewStep[] = SECTIONS.flatMap((s) => s.steps);

export default function ProgressBar({
  step,
  reachedStep,
  onSectionClick,
}: {
  step: InterviewStep;
  // Highest step the member has reached — enables forward navigation to
  // sections already started, even after navigating backward.
  reachedStep?: InterviewStep;
  onSectionClick?: (firstStep: InterviewStep) => void;
}) {
  const isComplete = step === "already_complete";
  const currentIdx = isComplete ? ORDERED.length : ORDERED.indexOf(step);
  const reachedIdx = reachedStep ? ORDERED.indexOf(reachedStep) : currentIdx;
  // maxIdx controls reachability only (can you click this section?).
  // fill uses currentIdx so the bar reflects where you are right now.
  const maxIdx = isComplete ? ORDERED.length : Math.max(currentIdx, reachedIdx);

  return (
    <div className="mb-8 w-full sm:mb-12">
      <div className="flex gap-1 h-3 mb-2">
        {SECTIONS.map((section) => {
          // Fill = fraction of this section's steps that are behind current position.
          const fill = isComplete
            ? 1
            : currentIdx === -1
              ? 0
              : section.steps.filter((s) => ORDERED.indexOf(s) < currentIdx).length /
                section.steps.length;

          const sectionFirstIdx = ORDERED.indexOf(section.steps[0]);
          const isCurrent = section.steps.includes(step as InterviewStep);

          return (
            <div
              key={section.label}
              className="relative h-full rounded-full overflow-hidden"
              style={{
                flex: section.steps.length,
                backgroundColor: isCurrent ? `${section.color}25` : "rgba(0,0,0,0.08)",
              }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
                style={{
                  width: `${fill * 100}%`,
                  backgroundColor: section.color,
                  // Active section's filled portion is fully opaque; past sections slightly muted.
                  opacity: isCurrent ? 1 : currentIdx > sectionFirstIdx ? 0.7 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:gap-1">
        {SECTIONS.map((section) => {
          const sectionFirstIdx = ORDERED.indexOf(section.steps[0]);
          const reachable = maxIdx >= sectionFirstIdx;
          const isCurrent = section.steps.includes(step as InterviewStep);

          return (
            <button
              key={section.label}
              type="button"
              disabled={!reachable || !onSectionClick}
              onClick={() => reachable && onSectionClick?.(section.steps[0])}
              aria-current={isCurrent ? "step" : undefined}
              className={`min-h-11 rounded-md px-1 text-left text-xs leading-tight transition-colors focus-visible:outline-offset-1 sm:min-h-0 sm:px-0 sm:text-[13px] ${
                isCurrent
                  ? "text-[var(--color-ink)] font-semibold"
                  : reachable
                    ? "text-[var(--color-grey)] hover:text-[var(--color-ink)]"
                    : "text-[var(--color-grey)]/40 cursor-default"
              }`}
              style={{
                flex: section.steps.length,
                color: isCurrent ? section.color : undefined,
              }}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
