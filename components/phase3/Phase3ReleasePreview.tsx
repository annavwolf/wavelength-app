"use client";

// Live "what the member will see" storyboard for the Report & Activity Release
// editor. Reflects the draft reads, the chosen focus item, and the release
// toggles in real time. Editable screens show the draft text; locked screens are
// greyed with a lock so the consultant sees the full journey and its order
// without implying they can change it.

import type { Phase3ReportJson } from "@/types/database";
import { SHARED_PURPOSE_INTRO, sharedPurposeClassificationLabel } from "@/lib/phase3Copy";
import { ACTION_PHRASES, PLACE_PHRASES } from "@/prompts/phase3_conversation";

type Screen = {
  section: string;
  color: string;
  title: string;
  body: string;
  locked: boolean;
  pulse?: boolean; // "members rate this"
};

const SECTION_COLOR = {
  intro: "#6B4EA8",
  results: "#1A5A6E",
  stories: "#A05A46",
  agreement: "#9A5B06",
  finish: "#2E6E5E",
};

export default function Phase3ReleasePreview({
  report,
  focusStatement,
  spClassification,
}: {
  report: Phase3ReportJson;
  // Only used as a "is a focus chosen?" signal — kept minimal on purpose.
  focusStatement: { statement_id: number } | null;
  spClassification?: string;
}) {
  const includeSP = !!report.include_shared_purpose;
  const includeStories = report.include_stories !== false;
  const fid = report.focus_statement_id ?? 0;
  const action = ACTION_PHRASES[fid] ?? "work well and safely together";
  const place = PLACE_PHRASES[fid] ?? "people can work well together";

  const screens: Screen[] = [];

  screens.push({
    section: "Introduction", color: SECTION_COLOR.intro, locked: true,
    title: "Welcome back",
    body: "Read-aloud offer, a warm welcome, and what today is about. (Fixed — not editable.)",
  });
  if (includeSP) {
    screens.push({
      section: "Introduction", color: SECTION_COLOR.intro, locked: true,
      title: "Shared purpose — heads up", body: SHARED_PURPOSE_INTRO,
    });
    screens.push({
      section: "Assessment Results", color: SECTION_COLOR.results, locked: false, pulse: true,
      title: `Shared purpose · ${sharedPurposeClassificationLabel(spClassification)}`,
      body: report.shared_purpose_read || "— your shared-purpose read will appear here —",
    });
  }
  screens.push({
    section: "Assessment Results", color: SECTION_COLOR.results, locked: true,
    title: "The ocean recap", body: "Otis re-introduces the three zones of psychological safety with the ocean visual. (Fixed.)",
  });
  screens.push({ section: "Assessment Results", color: SECTION_COLOR.results, locked: false, pulse: true, title: "Zone 1 · Safe to Belong", body: report.ps_read_zone1 || "— zone 1 read —" });
  screens.push({ section: "Assessment Results", color: SECTION_COLOR.results, locked: false, pulse: true, title: "Zone 2 · Safe to Speak Freely", body: report.ps_read_zone2 || "— zone 2 read —" });
  screens.push({ section: "Assessment Results", color: SECTION_COLOR.results, locked: false, pulse: true, title: "Zone 3 · Safe to Innovate", body: report.ps_read_zone3 || "— zone 3 read —" });

  screens.push({
    section: includeStories ? "Team Stories" : "Team Agreement",
    color: includeStories ? SECTION_COLOR.stories : SECTION_COLOR.agreement,
    locked: false,
    title: "The focus item",
    body: focusStatement
      ? `Otis names the focus: “making your team a safer place to ${action}.”${report.include_rationalization_in_report ? `\nWhy (shown to members): ${report.focus_narrative || "—"}` : ""}`
      : "— choose a focus item —",
  });

  if (includeStories) {
    screens.push({
      section: "Team Stories", color: SECTION_COLOR.stories, locked: true,
      title: "Stories → impact → frequency → consent",
      body: "Members tell stories, describe the impact on the work, rate how often it happens, and choose their sharing consent. (Fixed presentation.)",
    });
  }

  screens.push({
    section: "Team Agreement", color: SECTION_COLOR.agreement, locked: true,
    title: "Build the agreement",
    body: `Members contribute ALWAYS / NEVER behaviours for “a place where ${place}”, with examples and the board. (Fixed.)`,
  });
  screens.push({
    section: "Team Agreement", color: SECTION_COLOR.agreement, locked: true,
    title: "30-day commitment", body: "Commitment question + how the team meets. (Fixed.)",
  });
  screens.push({
    section: "Finish", color: SECTION_COLOR.finish, locked: true,
    title: "Review, consent & submit", body: "Members review everything, set both consent choices, can withdraw, download a report, and submit. (Fixed.)",
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-widest text-[var(--color-grey)]">Member preview</span>
        <span className="text-[11px] text-[var(--color-grey)]">· live, reflects your edits</span>
      </div>
      <ol className="space-y-2.5">
        {screens.map((s, i) => (
          <li
            key={i}
            className="rounded-xl border bg-white px-4 py-3"
            style={{ borderColor: s.locked ? "rgba(0,0,0,0.1)" : `${s.color}55`, opacity: s.locked ? 0.72 : 1 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: s.color }}>{s.section}</span>
              <span className="text-sm font-medium text-[var(--color-ink)]">{s.title}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {s.pulse && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-navy)]/10 text-[var(--color-navy)]">members rate this</span>}
                {s.locked ? <span title="Fixed — not editable" className="text-xs text-[var(--color-grey)]">🔒</span> : <span title="Editable" className="text-xs text-[var(--color-purple)]">✎</span>}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-ink)] whitespace-pre-line">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
