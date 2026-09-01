"use client";

// Phase 4 self-serve — consultant "Team Agreement" tab.
// Five sections in order: Pulse Check Results · Team Stories · Behaviour Board
// · Otis's Team Agreement (with Clarity) · Roadmap

import { useState, useEffect, useRef } from "react";
import { renderAgreementSentence } from "@/lib/agreementText";
import RoadmapInfographic from "@/components/phase4/RoadmapInfographic";
import type {
  Phase4Agreement, Phase4SelfServeJson, Phase4BehaviourGroup,
  SubmissionClassification, Phase3ReportJson,
} from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";

// ── Colour palette (matches survey diverging ramp) ────────────────────────────
const ALWAYS_COLOR = "#2D7A4F";
const SOMETIMES_COLOR = "#C4860A";
const NEVER_COLOR = "#B94040";
const NAVY = "#14203C";

const BUCKET_COLOR: Record<string, string> = {
  always: ALWAYS_COLOR,
  sometimes: SOMETIMES_COLOR,
  never: NEVER_COLOR,
};

const CLARITY_CLS: Record<string, string> = {
  clear: "bg-green-100 text-green-800",
  mixed: "bg-blue-100 text-blue-700",
  unclear: "bg-amber-100 text-amber-800",
};

const ZONE_NAMES = ["", "Safe to Belong", "Safe to Speak Freely", "Safe to Innovate"];
const MIN_N = 5;

const SITUATION_LABEL: Record<string, string> = {
  meeting: "team meetings",
  async_chat: "messaging / async chat",
  email: "email",
  document: "shared documents",
  project_task: "project work",
  other: "day-to-day work",
};

type PulseCheckRow = {
  read_key: string;
  accuracy_rating: string;
  comment: string | null;
  verbatim_allowed: boolean;
};

type PrivacySafeContextRow = {
  frequency: string | null;
  impact_text: string | null;
  verbatim_allowed: boolean;
};

type Props = {
  teamId: string;
  initial: Phase4SelfServeJson | null;
  allComplete: boolean;
  completedCount: number;
  totalCount: number;
  outstanding: string[];
  inProgress: string[];
  notStarted: string[];
  tier1: Tier1Result | null;
  tier2: Tier2Result | null;
  report: Phase3ReportJson | null;
};

// ── Layout primitives ─────────────────────────────────────────────────────────

function SectionHeader({ n, title, accent }: { n: number; title: string; accent: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white flex-shrink-0"
        style={{ background: accent }}>{n}</span>
      <h2 className="text-2xl font-semibold font-serif" style={{ fontFamily: "Playfair Display, serif" }}>{title}</h2>
    </div>
  );
}

function Divider() {
  return <div className="my-12 border-t border-black/15" />;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={{ padding: "20px 24px", ...style }}>
      {children}
    </div>
  );
}

// ── Pulse accuracy mini-chart ─────────────────────────────────────────────────
function PulseRatingBar({ checks }: { checks: PulseCheckRow[] }) {
  const ORDER = ["Very accurate", "Somewhat accurate", "Not at all accurate", "Don't know", "Decline to answer"];
  const counts: Record<string, number> = {};
  for (const c of checks) counts[c.accuracy_rating] = (counts[c.accuracy_rating] ?? 0) + 1;
  if (checks.length === 0) return <p className="text-sm text-[var(--color-grey)] italic">No ratings submitted yet.</p>;
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="space-y-1.5">
      {ORDER.filter((r) => counts[r]).map((r) => (
        <div key={r} className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-grey)] w-40 flex-shrink-0">{r}</span>
          <div className="flex-1 h-3 rounded-full bg-black/6 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(counts[r] / max) * 100}%`, background: ALWAYS_COLOR }} />
          </div>
          <span className="text-xs text-[var(--color-ink)] w-5 text-right">{counts[r]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Simple bar chart (commitment/frequency) ───────────────────────────────────
function BarChart({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (entries.length === 0) return <p className="text-xs text-[var(--color-grey)] italic">No responses yet.</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([label, n]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-grey)] w-52 flex-shrink-0 truncate" title={label}>{label}</span>
          <div className="flex-1 h-4 rounded bg-black/5 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(n / max) * 100}%`, background: NAVY }} />
          </div>
          <span className="text-xs text-[var(--color-ink)] w-5 text-right">{n}</span>
        </div>
      ))}
    </div>
  );
}

function DetailAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden" style={{ padding: 0 }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-black/[0.02]">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-[var(--color-grey)] text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-black/5 px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Interactive behavior picker (Section 4) ───────────────────────────────────
function BehaviorPicker({
  valence, groups, selected, onSelect,
}: {
  valence: "always" | "never";
  groups: Phase4BehaviourGroup[];
  selected: string[];
  onSelect: (behaviors: string[]) => void;
}) {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [openSupport, setOpenSupport] = useState<number | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpenDropdown(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const options = [...groups]
    .filter((g) => g.bucket === valence)
    .sort((a, b) => b.member_count - a.member_count);

  const color = valence === "always" ? ALWAYS_COLOR : NEVER_COLOR;

  // Ensure we always show exactly 2 slots
  const slots = [selected[0] ?? options[0]?.representative ?? "", selected[1] ?? options[1]?.representative ?? ""].slice(0, 2);

  return (
    <div className="space-y-3" ref={dropRef}>
      {slots.map((behavior, idx) => {
        const group = options.find((g) => g.representative === behavior);
        const subs = group?.contributing_submissions ?? [];
        const verbatimSubs = subs.filter((s) => s.verbatim_allowed === true);
        const anonCount = subs.length - verbatimSubs.length;

        return (
          <div key={idx} className="rounded-xl border-2 overflow-hidden"
            style={{ borderColor: `${color}40` }}>
            {/* Clickable behavior chip */}
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === idx ? null : idx)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
            >
              <span className="font-medium text-base leading-snug"
                style={{ color }}>
                {behavior || <span className="text-[var(--color-grey)] italic">Select a behaviour…</span>}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {group && (
                  <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                    ×{group.member_count} members
                  </span>
                )}
                <span className="text-[var(--color-grey)] text-sm">▾</span>
              </div>
            </button>

            {/* Dropdown of alternatives */}
            {openDropdown === idx && (
              <div className="border-t border-black/8 bg-white divide-y divide-black/5 max-h-64 overflow-y-auto shadow-lg z-30 relative">
                {options.map((opt) => (
                  <button
                    key={opt.representative}
                    type="button"
                    onClick={() => {
                      const next = [...slots];
                      next[idx] = opt.representative;
                      onSelect(next);
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-black/[0.03] transition-colors ${opt.representative === behavior ? "font-medium" : ""}`}
                  >
                    <span>{opt.representative}</span>
                    <span className="text-xs text-[var(--color-grey)] flex-shrink-0">
                      {opt.member_count} member{opt.member_count !== 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Team support toggle */}
            {subs.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setOpenSupport(openSupport === idx ? null : idx)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs border-t border-black/8 text-[var(--color-grey)] hover:text-[var(--color-ink)] hover:bg-black/[0.015] transition-colors"
                >
                  <span>{openSupport === idx ? "▲ Hide" : "▼ Show"} team support ({subs.length} submission{subs.length !== 1 ? "s" : ""})</span>
                </button>

                {openSupport === idx && (
                  <div className="border-t border-black/5 px-4 py-3 space-y-2 bg-black/[0.015]">
                    {verbatimSubs.length > 0 && (
                      <div className="space-y-1.5">
                        {verbatimSubs.map((s) => (
                          <p key={s.submission_id} className="text-sm text-[var(--color-ink)] leading-relaxed">
                            &ldquo;{s.text}&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                    {anonCount > 0 && (
                      <p className="text-xs text-[var(--color-grey)] italic">
                        +{anonCount} anonymous submission{anonCount !== 1 ? "s" : ""} (member{anonCount !== 1 ? "s" : ""} opted out of verbatim sharing)
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Agreement editor helpers ──────────────────────────────────────────────────
function ListEditor({ label, items, max, onChange }: { label: string; items: string[]; max: number; onChange: (items: string[]) => void }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-[11px] uppercase tracking-wide text-[var(--color-grey)]">{label}</p>}
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input value={it} onChange={(e) => onChange(items.map((x, j) => j === i ? e.target.value : x))} className="form-input text-sm flex-1" />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-xs text-[var(--color-grey)] hover:text-red-600">✕</button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, ""])} className="text-xs text-[var(--color-purple)] hover:underline">+ add</button>
      )}
    </div>
  );
}
// ── Click-to-edit (mirrors Phase3ReleasePreview's EditableBubble) ─────────────
function ClickToEdit({
  value, onChange, rows, placeholder, original, showOriginal,
}: {
  value: string; onChange: (v: string) => void; rows?: number;
  placeholder?: string; original?: string | null; showOriginal?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  return editing ? (
    <div>
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={rows ?? 5}
        className="form-input text-sm w-full resize-y"
      />
      {showOriginal && original && (
        <p className="text-xs text-[var(--color-grey)] border-l-2 border-black/10 pl-3 mt-2 whitespace-pre-wrap">
          Otis original: {original}
        </p>
      )}
    </div>
  ) : (
    <button type="button" onClick={() => setEditing(true)} className="w-full text-left group">
      <p className="text-sm leading-relaxed text-[var(--color-ink)] whitespace-pre-line">
        {value.trim() || <span className="italic text-[var(--color-grey)]">{placeholder ?? "— empty —"}</span>}
      </p>
      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-purple)]">
        <span className="px-2 py-0.5 rounded-full border border-[var(--color-purple)]/40 group-hover:bg-[var(--color-purple)]/8">
          ✎ Click to edit
        </span>
      </span>
    </button>
  );
}

// ── Formatted agreement — 2-column layout with clear per-behaviour separation ─
function FormattedAgreement({ a }: { a: Phase4Agreement }) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-[var(--color-grey)]">
        In order to make this team a place where{" "}
        <strong className="text-[var(--color-ink)]">{a.ps_item || "…"}</strong>
        {a.situations.length > 0 && (
          <>, especially during{" "}
            <strong className="text-[var(--color-ink)]">
              {a.situations.join(" and ")}
            </strong>
          </>
        )}:
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* ALWAYS column */}
        <div className="rounded-lg px-4 py-3 space-y-2" style={{ background: `${ALWAYS_COLOR}0E`, border: `1px solid ${ALWAYS_COLOR}30` }}>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ALWAYS_COLOR }}>We will ALWAYS</p>
          <ul className="space-y-2">
            {(a.always.length ? a.always : ["—"]).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-medium leading-snug" style={{ color: ALWAYS_COLOR }}>
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: ALWAYS_COLOR }} />
                {b}
              </li>
            ))}
          </ul>
        </div>
        {/* NEVER column */}
        <div className="rounded-lg px-4 py-3 space-y-2" style={{ background: `${NEVER_COLOR}0E`, border: `1px solid ${NEVER_COLOR}30` }}>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: NEVER_COLOR }}>We will NEVER</p>
          <ul className="space-y-2">
            {(a.never.length ? a.never : ["—"]).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-medium leading-snug" style={{ color: NEVER_COLOR }}>
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: NEVER_COLOR }} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Phase4Panel({
  teamId, initial, allComplete, completedCount, totalCount, outstanding, inProgress, notStarted,
  tier1, tier2, report,
}: Props) {
  const [json, setJson] = useState<Phase4SelfServeJson | null>(initial);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [releasedAt, setReleasedAt] = useState<string | null>(initial?.released_at ?? null);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [skippedCount, setSkippedCount] = useState<number | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [confirmResendAll, setConfirmResendAll] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [lowParticipationWarning, setLowParticipationWarning] = useState<string | null>(null);

  // Data for sections
  const [contextRows, setContextRows] = useState<PrivacySafeContextRow[]>([]);
  const [pulseChecks, setPulseChecks] = useState<PulseCheckRow[]>([]);
  const [rawBehaviors, setRawBehaviors] = useState<Array<{ id: string; text: string; bucket: string }>>([]);
  const [storyTags, setStoryTags] = useState<Record<string, number>>({});
  const [storyCount, setStoryCount] = useState(0);

  // Verbatim flags — use behavior verbatim for the agreement section
  useEffect(() => {
    if (!initial) return;
    void fetchData();
  }, [teamId, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    const response = await fetch(`/api/teams/${teamId}/phase4-data`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setErr(data.error ?? "Unable to load supporting Phase 4 data.");
      return;
    }
    setContextRows((data.context as PrivacySafeContextRow[] | undefined) ?? []);
    setPulseChecks((data.pulse_checks as PulseCheckRow[] | undefined) ?? []);
    setRawBehaviors((data.behaviors as Array<{ id: string; text: string; bucket: string }> | undefined) ?? []);
    const stories = (data.story_tags as Array<{ situation_tag: string | null }> | undefined) ?? [];
    setStoryCount(stories.length);
    const counts: Record<string, number> = {};
    for (const s of stories) {
      const t = s.situation_tag as string | null;
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    }
    setStoryTags(counts);
  }

  const includesPurpose = !!report?.shared_purpose_read?.trim();

  const checksFor = (key: string) => pulseChecks.filter((c) => c.read_key === key);

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function generate() {
    setGenerating(true); setErr(null);
    try {
      const res = await fetch("/api/phase4/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          data.error === "members_incomplete" ? "No members have finished the Results & Team Agreement Activity yet."
            : data.error === "no_focus_item" ? "No focus item yet — set one on the Report & Activity Release tab first."
              : `Generation failed: ${[data.error, data.detail].filter(Boolean).join(" — ") || "unknown"}`
        );
        setGenerating(false); return;
      }
      setJson(data.insights as Phase4SelfServeJson);
      setReleasedAt((data.insights as Phase4SelfServeJson).released_at);
      setLowParticipationWarning(data.low_participation
        ? `${data.completed_count ?? completedCount} of ${data.total_count ?? totalCount} members finished — wait for ≥80% for best results.`
        : null);
      await fetchData();
    } catch {
      setErr("Something went wrong. Please try again.");
    }
    setGenerating(false);
  }

  function editAgreement(next: Phase4Agreement) {
    setJson((prev) => prev ? { ...prev, agreement: next, agreement_text: renderAgreementSentence(next) } : prev);
    setSavedAt(null);
  }
  function setField(key: "what_to_do_next" | "closing_note", value: string) {
    setJson((prev) => prev ? { ...prev, [key]: value } : prev);
    setSavedAt(null);
  }
  function toggleRoadmapForMembers() {
    setJson((prev) => prev ? { ...prev, roadmap_shown_to_members: !prev.roadmap_shown_to_members } : prev);
    setSavedAt(null);
  }

  function rescueUnbucketed(submissionId: string, targetLabel: string) {
    setJson((prev) => {
      if (!prev) return prev;
      const sub = (prev.unbucketed_submissions ?? []).find((s) => s.submission_id === submissionId);
      if (!sub) return prev;
      const updated: SubmissionClassification = { ...sub, final_bucket_id: targetLabel, pass2_action: "rescued", pass2_reason: "manually assigned" };
      const board = prev.behaviour_board.map((g) => {
        if (g.representative !== targetLabel) return g;
        if ((g.contributing_submissions ?? []).some((s) => s.submission_id === submissionId)) return g;
        return { ...g, member_count: new Set([...(g.contributing_submissions ?? []).map((s) => s.member_id), sub.member_id]).size, contributing_submissions: [...(g.contributing_submissions ?? []), updated] };
      });
      return { ...prev, behaviour_board: board, unbucketed_submissions: (prev.unbucketed_submissions ?? []).filter((s) => s.submission_id !== submissionId) };
    });
    setSavedAt(null);
  }

  async function save(dryRun: boolean, resendAll = false) {
    if (!json) return;
    setBusy(true); setErr(null); setSentCount(null); setSkippedCount(null);
    const res = await fetch("/api/phase4/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, selfserve: json, dry_run: dryRun, resend_all: resendAll }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error ?? "Something went wrong."); setBusy(false); return; }
    if (dryRun) {
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    } else {
      setReleasedAt(data.released_at ?? new Date().toISOString());
      setSentCount(data.sent_count ?? 0);
      setSkippedCount(data.skipped_already_sent ?? 0);
      setJson((prev) => prev ? { ...prev, released_at: data.released_at } : prev);
    }
    setConfirmRelease(false); setConfirmResendAll(false); setBusy(false);
  }

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (!json) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="card border border-dashed border-black/20 text-center" style={{ padding: "36px 28px" }}>
          <h1 className="text-2xl mb-2" style={{ fontFamily: "Playfair Display, serif" }}>Team Agreement</h1>
          <p className="text-sm text-[var(--color-grey)] max-w-md mx-auto mb-5">
            Once members have finished the Results &amp; Team Agreement Activity, Otis classifies their behaviours into standard patterns, drafts a Team Behaviour Agreement, assesses how much the team converged, and builds a 30-day roadmap.
          </p>
          <div className="max-w-sm mx-auto mb-6">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-[var(--color-grey)]">Finished the Results &amp; Team Agreement Activity</span>
              <span className="font-medium">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`, background: NAVY }} />
            </div>
            {!allComplete && outstanding.length > 0 && (
              <div className="mt-2 space-y-1 text-left">
                {inProgress.length > 0 && <p className="text-xs text-amber-700">In progress: {inProgress.join(", ")}</p>}
                {notStarted.length > 0 && <p className="text-xs text-[var(--color-grey)]">Not started: {notStarted.join(", ")}</p>}
              </div>
            )}
          </div>
          <button type="button" onClick={() => void generate()} disabled={completedCount === 0 || generating} className="btn-primary">
            {generating ? "Otis is working…" : "Generate insights"}
          </button>
          {err && <p className="text-sm text-red-600 mt-4">{err}</p>}
        </div>
      </div>
    );
  }

  const a = json.agreement;
  const unbucketed = json.unbucketed_submissions ?? [];
  const bucketLabels = json.behaviour_board.map((g) => g.representative);
  const hasDoubleCountedBehaviours = json.behaviour_board.some(
    (g) => (g.contributing_submissions ?? []).some((s) => s.pass2_action === "moved")
  );

  const frequencyCounts: Record<string, number> = {};
  for (const r of contextRows) {
    if (r.frequency) frequencyCounts[r.frequency] = (frequencyCounts[r.frequency] ?? 0) + 1;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* ── Dashboard header ─────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-4xl sm:text-5xl mb-3" style={{ fontFamily: "Playfair Display, serif" }}>Team Agreement</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${allComplete ? "bg-green-100 text-green-800" : completedCount > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
            {completedCount}/{totalCount} finished the Results &amp; Team Agreement Activity
          </span>
          {releasedAt && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-700">
              Released {new Date(releasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
          <button type="button" onClick={() => void generate()} disabled={generating}
            className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline ml-auto">
            {generating ? "Re-classifying…" : "Re-generate insights"}
          </button>
        </div>
        {lowParticipationWarning && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">{lowParticipationWarning}</p>
          </div>
        )}
        {!allComplete && (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <p className="text-sm text-amber-800">
              {totalCount - completedCount} of {totalCount} members haven&apos;t responded yet — this reflects part of the team, not all of it.
            </p>
          </div>
        )}
        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1 — PULSE CHECK RESULTS                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <SectionHeader n={1} title="Pulse Check Results" accent="#1A5A6E" />

      <div className="space-y-5 mb-0">
        {/* Shared purpose at the top (if included) */}
        {includesPurpose && (() => {
          const checks = checksFor("purpose");
          const canShowComments =
            checks.length >= MIN_N &&
            checks.every((c) => c.verbatim_allowed);
          const verbatimComments = canShowComments ? checks.filter((c) => c.comment?.trim()) : [];
          return (
            <Card style={{ borderLeft: "4px solid #6B4EA8" }}>
              <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">Shared Purpose</p>
              <PulseRatingBar checks={checks} />
              {verbatimComments.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Member comments</p>
                  {verbatimComments.map((c, i) => (
                    <blockquote key={i} className="text-sm italic text-[var(--color-grey)] border-l-2 border-black/10 pl-3">
                      &ldquo;{c.comment}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </Card>
          );
        })()}

        {/* Zone 1–3 pulse checks — ratings and comments only, no repeated reads */}
        {([1, 2, 3] as const).map((n) => {
          const checks = checksFor(`zone${n}`);
          const canShowComments =
            checks.length >= MIN_N &&
            checks.every((c) => c.verbatim_allowed);
          const verbatimComments = canShowComments ? checks.filter((c) => c.comment?.trim()) : [];
          const zone = tier1?.ps_zones.find((z) => z.zone === n);
          const accent = zone ? (zone.band === "green" ? ALWAYS_COLOR : zone.band === "yellow" ? SOMETIMES_COLOR : NEVER_COLOR) : "#1A5A6E";

          return (
            <Card key={n} style={{ borderLeft: `4px solid ${accent}` }}>
              <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">Zone {n} · {ZONE_NAMES[n]}</p>
              <PulseRatingBar checks={checks} />
              {verbatimComments.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Member comments</p>
                  {verbatimComments.map((c, i) => (
                    <blockquote key={i} className="text-sm italic text-[var(--color-grey)] border-l-2 border-black/10 pl-3">
                      &ldquo;{c.comment}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Divider />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2 — TEAM STORIES                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <SectionHeader n={2} title="Team Stories" accent="#A05A46" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Situations */}
        <Card>
          <h3 className="text-base font-medium mb-3">Situations discussed</h3>
          {storyCount === 0 ? (
            <p className="text-sm text-[var(--color-grey)] italic">No stories recorded yet.</p>
          ) : Object.keys(storyTags).length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">
              {storyCount} member{storyCount !== 1 ? "s" : ""} shared stories. Re-generate insights to see situation breakdown — the tagger runs automatically.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {Object.entries(storyTags).sort(([, a], [, b]) => b - a).map(([tag, count]) => (
                <li key={tag} className="flex items-start gap-2">
                  <span className="text-[var(--color-grey)] mt-0.5">·</span>
                  <span>
                    {count} member{count !== 1 ? "s" : ""} discussed situations in{" "}
                    <span className="font-medium">{SITUATION_LABEL[tag] ?? tag}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Frequency */}
        <Card>
          <h3 className="text-base font-medium mb-3">How often it happens</h3>
          {Object.keys(frequencyCounts).length === 0 ? (
            <p className="text-sm text-[var(--color-grey)] italic">No frequency responses yet.</p>
          ) : (
            <BarChart counts={frequencyCounts} />
          )}
        </Card>
      </div>

      {(() => {
        const impactRows = contextRows.filter((r) => r.impact_text?.trim());
        if (impactRows.length === 0) return null;
        const canShowImpact =
          impactRows.length >= MIN_N &&
          impactRows.every((r) => r.verbatim_allowed);
        return (
          <div className="mt-4">
            <DetailAccordion title={`Impact on the team's work (${impactRows.length} responses)`}>
              <p className="text-xs text-[var(--color-grey)] mb-3">Exact answers are shown without names only when every contributor allowed short excerpts to be used.</p>
              {!canShowImpact ? (
                <p className="text-sm text-[var(--color-grey)] italic">
                  {impactRows.length < MIN_N
                    ? "Individual responses are not shown for groups fewer than 5 to protect anonymity."
                    : "Individual responses are not shown — not all members opted in to sharing their exact words."}
                </p>
              ) : (
                <div className="space-y-2">
                  {impactRows.map((r, i) => (
                    <p key={i} className="text-sm leading-relaxed">{r.impact_text}</p>
                  ))}
                </div>
              )}
            </DetailAccordion>
          </div>
        );
      })()}

      <Divider />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3 — ALWAYS & NEVER BEHAVIOUR BOARD                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <SectionHeader n={3} title="Always & Never Behaviour Board" accent={ALWAYS_COLOR} />

      {tier2?.focus_hypothesis?.statement_text && (
        <p className="text-sm text-[var(--color-grey)] mb-5 border-l-4 pl-4 leading-relaxed"
          style={{ borderColor: ALWAYS_COLOR }}>
          Members were asked: if the team&apos;s goal is to be a place where{" "}
          <span className="font-medium text-[var(--color-ink)]">{tier2.focus_hypothesis.statement_text.toLowerCase()}</span>
          {" "}— what behaviours would they always or never want to see?
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {(["always", "sometimes", "never"] as const).map((bucket) => {
          const items = rawBehaviors.filter((b) => b.bucket === bucket);
          return (
            <div key={bucket}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: BUCKET_COLOR[bucket] }}>{bucket}</span>
                <span className="text-xs text-[var(--color-grey)]">({items.length})</span>
              </div>
              {items.length === 0
                ? <p className="text-xs text-[var(--color-grey)] italic">None submitted.</p>
                : <div className="space-y-2">
                    {items.map((b) => (
                      <div key={b.id} className="rounded-lg px-3 py-2 text-sm leading-relaxed"
                        style={{ background: `${BUCKET_COLOR[bucket]}10`, borderLeft: `3px solid ${BUCKET_COLOR[bucket]}55` }}>
                        {b.text}
                      </div>
                    ))}
                  </div>
              }
            </div>
          );
        })}
      </div>

      <Divider />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4 — OTIS'S TEAM AGREEMENT                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <SectionHeader n={4} title="Otis's Team Agreement" accent={NAVY} />

      {/* §4.6.1 — Heads-up */}
      <div className="rounded-xl border border-black/10 bg-black/[0.02] px-5 py-4 mb-5">
        <p className="text-sm font-medium mb-1">How this agreement was built</p>
        <p className="text-sm text-[var(--color-grey)] leading-relaxed">
          Otis has categorised the ALWAYS &amp; NEVER behaviours the team submitted into{" "}
          <strong>a pre-existing standard list of behaviours</strong>.
          {" "}These standard labels are what appears in the formal agreement — the team&apos;s own submissions drive which label wins.
        </p>
        {hasDoubleCountedBehaviours && (
          <p className="text-sm text-[var(--color-grey)] mt-2 leading-relaxed">
            <span className="font-medium text-blue-700">Note:</span> Where Otis&apos;s two classification passes disagreed on a behaviour, it appears in both categories. This can increase support counts. One member&apos;s submission never adds more than 1 to any single category&apos;s count.
          </p>
        )}
      </div>

      {/* §4.6.3 — Clarity assessment */}
      <Card style={{ marginBottom: "20px" }}>
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-base font-medium">Clarity Assessment</h3>
          <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${CLARITY_CLS[json.clarity.state]}`}>
            {json.clarity.state}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-grey)] mb-2">{json.clarity.message}</p>
        <p className="text-xs text-[var(--color-grey)]">
          Clarity is based on: how many members&apos; submissions funnelled into the same top behaviours, whether any behaviours received conflicting ALWAYS/NEVER votes, and whether members described similar situations.
        </p>
        {json.clarity.split_behaviours.length > 0 && (
          <p className="text-xs text-[var(--color-grey)] mt-2">
            Behaviours with split votes: {json.clarity.split_behaviours.map((b) => `"${b}"`).join(", ")}
          </p>
        )}

        {/* Unbucketed */}
        {unbucketed.length > 0 && (
          <div className="mt-4 pt-4 border-t border-black/8">
            <p className="text-xs font-medium mb-2">Didn&apos;t fit any standard pattern ({unbucketed.length})</p>
            <p className="text-xs text-[var(--color-grey)] mb-3">Otis couldn&apos;t confidently place these. They may still be worth discussing.</p>
            <div className="space-y-2">
              {unbucketed.map((s) => (
                <div key={s.submission_id} className="rounded-lg border border-black/10 bg-black/[0.015] px-3 py-2 space-y-1.5">
                  <p className="text-sm">&ldquo;{s.text}&rdquo;</p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[var(--color-grey)]">Assign to:</label>
                    <select className="text-xs border border-black/15 rounded px-2 py-1 bg-white"
                      defaultValue="" onChange={(e) => { if (e.target.value) rescueUnbucketed(s.submission_id, e.target.value); }}>
                      <option value="">— select a bucket —</option>
                      {bucketLabels.map((label) => <option key={label} value={label}>{label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* The agreement itself — visually prominent */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${NAVY}` }}>
        {/* Header band */}
        <div className="px-6 py-4" style={{ background: NAVY }}>
          <p className="text-xs uppercase tracking-widest text-white/60 mb-0.5">The Team Agreement Otis Proposes For Your Team</p>
          {a.ps_item ? (
            <p className="text-white text-base font-medium leading-snug">
              A place where <span className="text-white font-bold">{a.ps_item}</span>
              {a.situations.length > 0 && (
                <span className="font-normal opacity-80">, especially during {a.situations.join(" and ")}</span>
              )}
            </p>
          ) : (
            <p className="text-white/50 italic text-sm">Set the goal and situations using the pickers below</p>
          )}
        </div>

        {/* Behaviour pickers */}
        <div className="px-6 py-5 space-y-6" style={{ background: `${NAVY}04` }}>
          {/* ALWAYS / NEVER side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: ALWAYS_COLOR }}>We will ALWAYS</p>
              <BehaviorPicker
                valence="always"
                groups={json.behaviour_board}
                selected={a.always.slice(0, 2)}
                onSelect={(behaviors) => editAgreement({ ...a, always: behaviors })}
              />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: NEVER_COLOR }}>We will NEVER</p>
              <BehaviorPicker
                valence="never"
                groups={json.behaviour_board}
                selected={a.never.slice(0, 2)}
                onSelect={(behaviors) => editAgreement({ ...a, never: behaviors })}
              />
            </div>
          </div>

          {/* Situations */}
          <div className="space-y-2 pt-2 border-t border-black/8">
            <p className="text-xs uppercase tracking-widest text-[var(--color-grey)]">Especially during (edit below)</p>
            <ListEditor label="" items={a.situations} max={2}
              onChange={(items) => editAgreement({ ...a, situations: items })} />
          </div>

          {/* Live formatted preview */}
          <div className="rounded-xl px-5 py-4" style={{ background: "white", border: `1px solid ${NAVY}20` }}>
            <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">
              Formal agreement — updates live ↑
            </p>
            <FormattedAgreement a={a} />
          </div>

          <button type="button" onClick={() => setShowOriginal((v) => !v)}
            className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
            {showOriginal ? "Hide Otis's original" : "See Otis's original"}
          </button>
          {showOriginal && (
            <p className="text-xs text-[var(--color-grey)] border-l-2 border-black/10 pl-3">
              Otis original: {json.otis_original.agreement_text}
            </p>
          )}
        </div>
      </div>

      <Divider />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5 — AGREEMENT RELEASE & ROADMAP                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <SectionHeader n={5} title="Agreement Release & Roadmap" accent="#2E6E5E" />

      <p className="text-sm text-[var(--color-grey)] mb-5 max-w-2xl">
        Preview what members will see when you release. Edit the editable sections below, then save draft and release.
      </p>

      {/* Storyboard preview — mirrors Report & Activity Release visual format */}
      <div className="space-y-3 mb-8">
        {/* 1. The agreement — fixed, driven by the pickers above */}
        <div className="rounded-xl border bg-white px-4 py-3" style={{ opacity: 0.72 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#14203C" }}>Agreement</span>
            <span className="text-sm font-medium text-[var(--color-ink)]">Team agreement</span>
            <span className="ml-auto text-xs text-[var(--color-grey)]">🔒 edit above in Section 4</span>
          </div>
          <FormattedAgreement a={a} />
        </div>

        {/* 2. What to do next — click-to-edit */}
        <div className="rounded-xl border-2 border-dashed bg-white px-4 py-3" style={{ borderColor: "#9A5B0666" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#9A5B06" }}>Roadmap</span>
            <span className="text-sm font-medium text-[var(--color-ink)]">What to do next</span>
            <span className="ml-auto text-xs text-[var(--color-purple)]">✎ editable</span>
          </div>
          <ClickToEdit
            value={json.what_to_do_next}
            onChange={(v) => setField("what_to_do_next", v)}
            rows={6}
            placeholder="What members should do after receiving their results…"
            original={json.otis_original.what_to_do_next}
            showOriginal={showOriginal}
          />
        </div>

        {/* 3. Roadmap timeline + Otis's recommendation — both optional, both default ON */}
        <div className="rounded-xl border-2 border-dashed bg-white px-4 py-3" style={{ borderColor: "#2E6E5E66" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#2E6E5E" }}>Roadmap</span>
            <span className="text-sm font-medium text-[var(--color-ink)]">30-day roadmap (optional)</span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-grey)] cursor-pointer select-none">
              <input type="checkbox" checked={json.roadmap_shown_to_members !== false}
                onChange={toggleRoadmapForMembers}
                className="h-3.5 w-3.5 accent-[var(--color-purple)]" />
              Include for members
            </label>
          </div>
          <div className={json.roadmap_shown_to_members === false ? "opacity-40 pointer-events-none" : ""}>
            <RoadmapInfographic teamId={teamId} />
            {json.roadmap && (
              <div className="mt-3 pt-3 border-t border-black/8">
                <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-1.5">Otis&apos;s recommendation</p>
                <p className="text-sm leading-relaxed text-[var(--color-grey)]">{json.roadmap}</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Guide downloads — always shown */}
        <div className="rounded-xl border bg-white px-4 py-3" style={{ opacity: 0.8 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#2E6E5E" }}>Guides</span>
            <span className="text-sm font-medium text-[var(--color-ink)]">Downloadable guides</span>
            <span className="ml-auto text-xs text-[var(--color-grey)]">🔒 always included</span>
          </div>
          <div className="space-y-1.5">
            {["Your 30-Day Game Plan", "Team Meeting Agenda", "Weekly Check-In Protocol"].map((g) => (
              <div key={g} className="flex items-center justify-between rounded-lg border border-black/8 px-3 py-2 text-sm">
                <span>{g}</span><span className="text-[var(--color-grey)] text-xs">Open →</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Closing note — click-to-edit */}
        <div className="rounded-xl border-2 border-dashed bg-white px-4 py-3" style={{ borderColor: "#2E6E5E66" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#2E6E5E" }}>Finish</span>
            <span className="text-sm font-medium text-[var(--color-ink)]">Closing note</span>
            <span className="ml-auto text-xs text-[var(--color-purple)]">✎ editable</span>
          </div>
          <ClickToEdit
            value={json.closing_note}
            onChange={(v) => setField("closing_note", v)}
            rows={2}
            placeholder="A short closing message for members…"
          />
        </div>
      </div>

      {/* Commitment & synchronicity data — consultant-only context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-sm font-semibold mb-3">30-day commitment responses</h3>
          <BarChart counts={json.commitment_distribution.counts} />
          <p className="text-xs text-[var(--color-grey)] mt-2">{json.commitment_distribution.summary}</p>
          {json.low_commitment_note && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">{json.low_commitment_note}</p>
            </div>
          )}
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-3">Meeting synchronously</h3>
          <BarChart counts={json.touchpoint_distribution.counts} />
          <p className="text-xs text-[var(--color-grey)] mt-2">{json.touchpoint_distribution.summary}</p>
          {json.touchpoint_note && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-800">{json.touchpoint_note}</p>
            </div>
          )}
        </Card>
      </div>

      {json.async_skew && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 mb-6">
          <p className="text-sm font-medium text-amber-800 mb-1">Async alternatives recommended</p>
          <p className="text-sm text-amber-700">Many members indicated the team doesn&apos;t meet easily. Lean on asynchronous check-ins rather than assuming a live session.</p>
        </div>
      )}

      {/* Originals toggle */}
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => setShowOriginal((v) => !v)}
          className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
          {showOriginal ? "Hide Otis's originals" : "View Otis's originals"}
        </button>
      </div>

      {/* ── Release controls ─────────────────────────────────────────────────── */}
      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-black/10">
        <div className="space-y-1">
          {savedAt && !busy && <p className="text-xs text-[var(--color-grey)]">Draft saved at {savedAt}</p>}
          {releasedAt && sentCount !== null && (
            <p className="text-xs text-green-700">
              {sentCount > 0 ? `Sent to ${sentCount} member${sentCount !== 1 ? "s" : ""}.` : "No new emails sent."}
              {skippedCount !== null && skippedCount > 0 && (
                <span className="text-amber-600"> {skippedCount} already sent.</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void save(true)} disabled={busy}
            className="btn-secondary" style={{ padding: "8px 18px", fontSize: "13px" }}>
            {busy ? "Saving…" : "Save draft"}
          </button>
          {!confirmRelease ? (
            <button type="button" onClick={() => setConfirmRelease(true)} disabled={busy} className="btn-primary" style={{ padding: "8px 20px", fontSize: "13px" }}>
              {releasedAt ? "Re-release to team" : "Release to team"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-grey)]">Send results to members?</span>
              <button type="button" onClick={() => void save(false)} disabled={busy}
                className="btn-primary" style={{ padding: "6px 14px", fontSize: "13px", background: NAVY }}>
                {busy ? "Sending…" : "Confirm"}
              </button>
              <button type="button" onClick={() => setConfirmRelease(false)} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">Cancel</button>
            </div>
          )}
          {releasedAt && !confirmRelease && (
            confirmResendAll ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-grey)]">Re-send to everyone?</span>
                <button type="button" onClick={() => void save(false, true)} disabled={busy}
                  className="btn-secondary" style={{ padding: "6px 14px", fontSize: "13px" }}>
                  {busy ? "Sending…" : "Confirm"}
                </button>
                <button type="button" onClick={() => setConfirmResendAll(false)} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmResendAll(true)} disabled={busy}
                className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">Re-send to all</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
