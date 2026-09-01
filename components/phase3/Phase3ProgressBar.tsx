"use client";

import type { Phase3StepId } from "@/lib/phase3Progress";

// Phase 3 report progress bar — mirrors the Phase 1 interview ProgressBar,
// grouping the member's Phase 3 steps into sections. Clicking a reached section
// jumps back (or forward, up to the furthest step reached).
//
// The old single "Building Psych Safety" section is now split into
// "Team Stories" and "Team Agreement", with a final "Finish" section.

export type Phase3Step = Phase3StepId;

const SECTIONS: { label: string; steps: Phase3Step[]; color: string }[] = [
  {
    label: "Introduction",
    steps: ["intro", "sp_intro"],
    color: "#6B4EA8", // purple — app primary accent
  },
  {
    label: "Assessment Results",
    steps: ["shared_purpose", "results", "zone1", "zone2", "zone3"],
    color: "#1A5A6E", // ocean teal — matches the PS section theme
  },
  {
    label: "Team Stories",
    steps: ["focus", "focus2", "stories_intro", "chat", "impact", "frequency", "story_consent"],
    color: "#A05A46", // warm terracotta — matches Phase 1's "personal" wash
  },
  {
    label: "Team Agreement",
    steps: ["agreement_intro", "examples_meaning", "examples_behaviors", "board", "commit_praise", "commit_ask", "commit_sync"],
    color: "#9A5B06", // warm gold
  },
  {
    label: "Finish",
    steps: ["finish_wellDone", "finish_next", "behavior_consent", "finish_review", "review"],
    color: "#2E6E5E", // deep green
  },
];

export const PHASE3_SECTIONS = SECTIONS;

// Section background tint for a step (matches the bar colour), used as a subtle
// overlay wash on the page — same idea as the Phase 1 interview.
export function phase3SectionOverlay(step: Phase3Step): string {
  const hexToTint: Record<string, string> = {
    "#6B4EA8": "rgba(107, 78, 168, 0.05)",
    "#1A5A6E": "rgba(26, 90, 110, 0.055)",
    "#A05A46": "rgba(160, 90, 70, 0.055)",
    "#9A5B06": "rgba(154, 91, 6, 0.055)",
    "#2E6E5E": "rgba(46, 110, 94, 0.055)",
  };
  const section = SECTIONS.find((s) => s.steps.includes(step));
  return section ? hexToTint[section.color] ?? "transparent" : "transparent";
}

export default function Phase3ProgressBar({
  step,
  reachedStep,
  complete = false,
  onSectionClick,
  activeSteps,
}: {
  step: Phase3Step;
  // Furthest step the member has reached — enables forward navigation to
  // sections already started, even after navigating backward.
  reachedStep?: Phase3Step;
  // When the member has finished (the "done" screen), fill the whole bar.
  complete?: boolean;
  onSectionClick?: (firstStep: Phase3Step) => void;
  // The steps actually active for this member (toggles can drop the shared
  // purpose and/or Team Stories steps). Sections filter to these; empty
  // sections are hidden.
  activeSteps?: Phase3Step[];
}) {
  // Filter each section to the active steps, drop empty sections.
  const sections = (activeSteps
    ? SECTIONS.map((s) => ({ ...s, steps: s.steps.filter((st) => activeSteps.includes(st)) }))
    : SECTIONS
  ).filter((s) => s.steps.length > 0);
  const ORDERED: Phase3Step[] = sections.flatMap((s) => s.steps);

  const currentIdx = complete ? ORDERED.length : ORDERED.indexOf(step);
  const reachedIdx = reachedStep ? ORDERED.indexOf(reachedStep) : currentIdx;
  const maxIdx = complete ? ORDERED.length : Math.max(currentIdx, reachedIdx);

  return (
    <div className="mb-8 w-full sm:mb-10">
      <div className="flex gap-1 h-3 mb-2">
        {sections.map((section) => {
          const fill = complete
            ? 1
            : currentIdx === -1
              ? 0
              : section.steps.filter((s) => ORDERED.indexOf(s) < currentIdx).length /
                section.steps.length;

          const sectionFirstIdx = ORDERED.indexOf(section.steps[0]);
          const isCurrent = !complete && section.steps.includes(step);

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
                  opacity: isCurrent ? 1 : currentIdx > sectionFirstIdx ? 0.7 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:gap-1">
        {sections.map((section) => {
          const sectionFirstIdx = ORDERED.indexOf(section.steps[0]);
          const reachable = maxIdx >= sectionFirstIdx;
          const isCurrent = !complete && section.steps.includes(step);

          return (
            <button
              key={section.label}
              type="button"
              disabled={!reachable || !onSectionClick}
              onClick={() => reachable && onSectionClick?.(section.steps[0])}
              aria-current={isCurrent ? "step" : undefined}
              className={`min-h-11 rounded-md px-1 text-left text-xs leading-tight transition-colors sm:min-h-0 sm:px-0 sm:text-[13px] ${
                isCurrent
                  ? "font-semibold"
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
