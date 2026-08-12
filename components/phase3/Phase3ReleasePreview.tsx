"use client";

// Bubble primitives for the Report & Activity Release editor. The consultant
// edits the member-facing reads directly on the storyboard: fixed screens are
// locked (🔒), auto screens update from the focus choice, and editable screens
// use a one-click edit-then-lock interaction with "See / Revert to Otis's
// original". Consumed by components/phase3/ReportReview.tsx.

import { useEffect, useRef, useState } from "react";
import type { Phase3ReportJson } from "@/types/database";
import { PLACE_PHRASES } from "@/prompts/phase3_conversation";
import { SHARED_PURPOSE_INTRO, sharedPurposeClassificationLabel } from "@/lib/phase3Copy";

export const SECTION_COLOR = {
  intro: "#6B4EA8",
  results: "#1A5A6E",
  stories: "#A05A46",
  agreement: "#9A5B06",
  finish: "#2E6E5E",
} as const;

function SectionTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
      {children}
    </span>
  );
}

// Fixed (🔒) or auto-generated (updates from your choices) non-editable bubble.
export function PreviewBubble({
  section, color, title, body, auto = false,
}: {
  section: string; color: string; title: string; body: string; auto?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.1)", opacity: auto ? 0.95 : 0.72 }}>
      <div className="flex items-center gap-2 mb-1">
        <SectionTag color={color}>{section}</SectionTag>
        <span className="text-sm font-medium text-[var(--color-ink)]">{title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {auto ? (
            <span title="Updates automatically from your focus choice" className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-[var(--color-grey)]">auto</span>
          ) : (
            <span title="Fixed — not editable" className="text-xs text-[var(--color-grey)]">🔒</span>
          )}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-ink)] whitespace-pre-line">{body}</p>
    </div>
  );
}

// One-click-to-edit, locks on blur. Shows "See / Revert to Otis's original".
export function EditableBubble({
  section, color, title, value, original, placeholder, pulse = false, onChange,
}: {
  section: string; color: string; title: string;
  value: string; original?: string; placeholder?: string; pulse?: boolean;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showOrig, setShowOrig] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const orig = (original ?? "").trim();
  const hasOrig = orig !== "";
  const changed = hasOrig && value.trim() !== orig;

  return (
    <div className="rounded-xl border-2 border-dashed bg-white px-4 py-3" style={{ borderColor: `${color}66` }}>
      <div className="flex items-center gap-2 mb-1">
        <SectionTag color={color}>{section}</SectionTag>
        <span className="text-sm font-medium text-[var(--color-ink)]">{title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {pulse && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-navy)]/10 text-[var(--color-navy)]">members rate this</span>}
          <span title="Editable" className="text-xs text-[var(--color-purple)]">✎</span>
        </span>
      </div>

      {editing ? (
        <textarea
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={4}
          className="form-input text-sm w-full resize-y"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="w-full text-left group">
          <p className="text-sm leading-relaxed text-[var(--color-ink)] whitespace-pre-line">
            {value.trim() ? value : <span className="text-[var(--color-grey)] italic">{placeholder ?? "— empty —"}</span>}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-purple)]">
            <span className="px-2 py-0.5 rounded-full border border-[var(--color-purple)]/40 group-hover:bg-[var(--color-purple)]/10">✎ Click to edit</span>
          </span>
        </button>
      )}

      {hasOrig && (
        <div className="mt-2 flex items-center gap-3 text-[11px]">
          <button type="button" onClick={() => setShowOrig((v) => !v)} className="text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
            {showOrig ? "Hide Otis’s original" : "See Otis’s original"}
          </button>
          {changed && (
            <button type="button" onClick={() => onChange(orig)} className="text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
              Revert to Otis&rsquo;s original
            </button>
          )}
        </div>
      )}
      {showOrig && hasOrig && (
        <p className="mt-1.5 text-xs text-[var(--color-grey)] border-l-2 border-black/10 pl-3 whitespace-pre-line">Otis: {orig}</p>
      )}
    </div>
  );
}

// Read-only bubble for a member-facing read (shown on the full-journey viewer).
function ReadBubble({ section, color, title, body, pulse = false }: {
  section: string; color: string; title: string; body: string; pulse?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: `${color}40` }}>
      <div className="flex items-center gap-2 mb-1">
        <SectionTag color={color}>{section}</SectionTag>
        <span className="text-sm font-medium text-[var(--color-ink)]">{title}</span>
        {pulse && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-navy)]/10 text-[var(--color-navy)]">members rate this</span>}
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-ink)] whitespace-pre-line">{body}</p>
    </div>
  );
}

// Default export: the full member experience, read-only, for the transparency
// viewer (app/teams/[team_id]/journey). Mirrors the copy of the release editor.
export default function Phase3ReleasePreview({
  report, focusStatement, spClassification,
}: {
  report: Phase3ReportJson;
  focusStatement: { statement_id: number; statement_text?: string } | null;
  spClassification?: string;
}) {
  const includeSP = !!report.include_shared_purpose;
  const includeStories = report.include_stories !== false;
  const fid = report.focus_statement_id ?? 0;
  const place = PLACE_PHRASES[fid] ?? "people can work well together";
  const storiesBody = focusStatement?.statement_text
    ? `Otis asks members to share stories about why the team might have responded unfavourably to: “${focusStatement.statement_text}”.\n\nThis helps teams contextualise the issue and the impact it has on the team, in preparation for the next activity.`
    : "Members share a short story about the focus item.";
  const agreementBody = report.focus_statement_id
    ? `Members contribute ALWAYS / NEVER behaviours that will make the team a place where ${place}.`
    : "Members contribute ALWAYS / NEVER behaviours for the team agreement.";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-widest text-[var(--color-grey)]">Member preview</span>
        <span className="text-[11px] text-[var(--color-grey)]">· read-only</span>
      </div>
      <div className="space-y-2.5">
        <PreviewBubble section="Introduction" color={SECTION_COLOR.intro} title="Welcome back"
          body="Read-aloud offer, a warm welcome, and what today is about." />
        {includeSP && (
          <PreviewBubble section="Introduction" color={SECTION_COLOR.intro} title="Shared purpose — heads up" body={SHARED_PURPOSE_INTRO} />
        )}
        {includeSP && (
          <ReadBubble section="Assessment Results" color={SECTION_COLOR.results} pulse
            title={`Shared purpose · ${sharedPurposeClassificationLabel(spClassification)}`}
            body={report.shared_purpose_read || "— shared-purpose read —"} />
        )}
        <PreviewBubble section="Assessment Results" color={SECTION_COLOR.results} title="The ocean recap"
          body="Otis re-introduces the three zones of psychological safety with the ocean visual." />
        <ReadBubble section="Assessment Results" color={SECTION_COLOR.results} pulse title="Zone 1 · Safe to Belong" body={report.ps_read_zone1 || "— zone 1 read —"} />
        <ReadBubble section="Assessment Results" color={SECTION_COLOR.results} pulse title="Zone 2 · Safe to Speak Freely" body={report.ps_read_zone2 || "— zone 2 read —"} />
        <ReadBubble section="Assessment Results" color={SECTION_COLOR.results} pulse title="Zone 3 · Safe to Innovate" body={report.ps_read_zone3 || "— zone 3 read —"} />
        {includeStories && (
          <PreviewBubble auto section="Team Stories" color={SECTION_COLOR.stories} title="Team Stories" body={storiesBody} />
        )}
        <PreviewBubble auto section="Team Agreement" color={SECTION_COLOR.agreement} title="Build the agreement" body={agreementBody} />
        <PreviewBubble section="Team Agreement" color={SECTION_COLOR.agreement} title="30-day commitment" body="Commitment question + how the team meets." />
        <PreviewBubble section="Finish" color={SECTION_COLOR.finish} title="Review & submit"
          body="Members review everything, may update their global exact-excerpt preference, can withdraw, download a report, and submit." />
      </div>
    </div>
  );
}
