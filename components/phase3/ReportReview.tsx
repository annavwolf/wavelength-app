"use client";

// Report & Activity Release — a single member-preview storyboard the consultant
// edits in place. Two columns: (1) Results — the assessment reads members see and
// rate; (2) Activity — the focus choice, Team Stories, and Team Agreement members
// build. Editable reads use one-click edit-then-lock with Otis's original kept.
// Releasing emails Phase 3 links (unchanged flow).

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Phase3ReportJson, FocusCandidate } from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";
import { ZONE_NAME, ZONE_BADGE, ZONE_SHORT } from "@/components/dashboard/types";
import { PLACE_PHRASES } from "@/prompts/phase3_conversation";
import { sharedPurposeClassificationLabel } from "@/lib/phase3Copy";
import { SECTION_COLOR, PreviewBubble, EditableBubble } from "@/components/phase3/Phase3ReleasePreview";

type Props = {
  teamId: string;
  tier1: Tier1Result;
  tier2: Tier2Result | null;
  existingReport: Phase3ReportJson | null;
};

const FLAGGED_CLASSIFICATIONS = ["fuzzy", "bifurcated", "fragmented"];

function candidatesFrom(tier2: Tier2Result | null): FocusCandidate[] {
  const raw = tier2?.focus_candidates;
  if (raw && raw.length) {
    return raw
      .filter((c) => typeof c.statement_id === "number")
      .map((c) => ({ statement_id: c.statement_id!, statement_text: c.statement_text ?? "", zone: c.zone ?? 0, why: c.why ?? "" }));
  }
  const fh = tier2?.focus_hypothesis;
  if (fh && typeof fh.statement_id === "number") {
    return [{ statement_id: fh.statement_id, statement_text: fh.statement_text ?? "", zone: fh.zone ?? 0, why: fh.hypothesis ?? "" }];
  }
  return [];
}

function seedReport(tier2: Tier2Result | null, existing: Phase3ReportJson | null): Phase3ReportJson {
  const recommendSP = FLAGGED_CLASSIFICATIONS.includes(tier2?.shared_purpose_read?.classification ?? "")
    || !!(tier2?.welfare_or_sensitive_note && tier2.welfare_or_sensitive_note !== "none");
  if (existing) {
    return { ...existing, focus_candidates: existing.focus_candidates ?? candidatesFrom(tier2) };
  }
  return {
    ps_read_overall: tier2?.ps_read?.overall_shape ?? "",
    ps_read_zone1: tier2?.ps_read?.zone1 ?? "",
    ps_read_zone2: tier2?.ps_read?.zone2 ?? "",
    ps_read_zone3: tier2?.ps_read?.zone3 ?? "",
    shared_purpose_read: tier2?.shared_purpose_read?.read ?? "",
    focus_statement_id: tier2?.focus_hypothesis?.statement_id ?? null,
    focus_narrative: tier2?.focus_hypothesis?.hypothesis ?? "",
    workshop_intro: "",
    focus_candidates: candidatesFrom(tier2),
    include_shared_purpose: recommendSP,
    include_stories: true,
    include_rationalization_in_report: false,
    released_at: null,
    sent_member_ids: [],
  };
}

export default function ReportReview({ teamId, tier1, tier2, existingReport }: Props) {
  const [report, setReport] = useState<Phase3ReportJson>(() => seedReport(tier2, existingReport));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [releasedAt, setReleasedAt] = useState<string | null>(existingReport?.released_at ?? null);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [skippedCount, setSkippedCount] = useState<number | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [confirmResendAll, setConfirmResendAll] = useState(false);

  useEffect(() => {
    setReport(seedReport(tier2, existingReport));
    setReleasedAt(existingReport?.released_at ?? null);
  }, [existingReport, tier2]);

  function set<K extends keyof Phase3ReportJson>(key: K, value: Phase3ReportJson[K]) {
    setReport((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  async function save(dryRun: boolean, resendAll = false) {
    setBusy(true); setErr(null); setSentCount(null); setSkippedCount(null);
    const res = await fetch("/api/phase3/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, report, dry_run: dryRun, resend_all: resendAll }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error ?? "Something went wrong. Please try again."); setBusy(false); return; }
    if (dryRun) {
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    } else {
      setReleasedAt(data.released_at ?? new Date().toISOString());
      setSentCount(data.sent_count ?? 0);
      setSkippedCount(data.skipped_already_sent ?? 0);
      setReport((prev) => ({ ...prev, released_at: data.released_at, sent_member_ids: [...(prev.sent_member_ids ?? [])] }));
      if (data.using_test_sender) {
        setErr("Using Resend's shared test domain — emails may land in spam. Add RESEND_FROM_EMAIL once you have a verified sender domain.");
      }
    }
    setConfirmRelease(false); setConfirmResendAll(false); setBusy(false);
  }

  const statements = tier1.ps_statements ?? [];
  const candidates = report.focus_candidates ?? candidatesFrom(tier2);
  const candidateIds = new Set(candidates.map((c) => c.statement_id));
  const otherStatements = statements.filter((s) => !candidateIds.has(s.statement_id));
  const spClassification = tier2?.shared_purpose_read?.classification;
  const recommendSP = FLAGGED_CLASSIFICATIONS.includes(spClassification ?? "")
    || !!(tier2?.welfare_or_sensitive_note && tier2.welfare_or_sensitive_note !== "none");
  const focusStatement = statements.find((s) => s.statement_id === report.focus_statement_id) ?? null;
  const tier2Missing = !tier2;
  const includeSP = !!report.include_shared_purpose;
  const includeStories = report.include_stories !== false;

  // Selecting one of Otis's top picks fills the reasoning box from that candidate;
  // selecting an off-list ("Other") item leaves the reasoning blank.
  function onFocusSelect(idStr: string) {
    const id = idStr ? Number(idStr) : null;
    const cand = candidates.find((c) => c.statement_id === id) ?? null;
    setReport((prev) => ({ ...prev, focus_statement_id: id, focus_narrative: cand ? cand.why : "" }));
    setSavedAt(null);
  }

  const selectedCandidate = candidates.find((c) => c.statement_id === report.focus_statement_id) ?? null;
  const fid = report.focus_statement_id ?? 0;
  const place = PLACE_PHRASES[fid] ?? "people can work well together";
  const storiesBody = focusStatement
    ? `Otis asks members to share stories about why the team might have responded unfavourably to: “${focusStatement.statement_text}”.\n\nThis helps teams contextualise the issue and the impact it has on the team, in preparation for the next activity.`
    : "— choose a focus item above to preview this —";
  const agreementBody = report.focus_statement_id
    ? `Members contribute ALWAYS / NEVER behaviours that will make the team a place where ${place}.`
    : "Members contribute ALWAYS / NEVER behaviours for the team agreement. Choose a focus item to preview the exact wording.";
  const spHint = recommendSP
    ? `Otis suggests including this — the team's alignment looks weak${spClassification ? ` (${spClassification})` : ""}.`
    : "Otis: the team's alignment looks healthy, so you can safely leave this out.";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="relative rounded-2xl overflow-hidden mb-6">
        <img src="/ps-ocean.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,32,60,0.92) 0%, rgba(20,32,60,0.78) 55%, rgba(20,32,60,0.60) 100%)" }} />
        <div className="relative px-8 py-11 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl text-white" style={{ fontFamily: "Playfair Display, serif", textShadow: "0 2px 14px rgba(0,0,0,0.45)" }}>
              Report &amp; Activity Release
            </h1>
            <p className="text-base md:text-lg text-white mt-3 max-w-2xl font-medium" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              Edit the reads and the focus, set what members see, then release. Members see nothing until you release.
            </p>
            <Link href={`/teams/${teamId}/journey`} className="inline-block mt-4 text-sm text-white underline underline-offset-2 hover:text-white/80">
              See the full member journey →
            </Link>
          </div>
          {releasedAt && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-white/20 text-white whitespace-nowrap flex-shrink-0 self-start">
              Released {new Date(releasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </section>

      {tier2Missing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 mb-6">
          <p className="text-sm text-amber-800">Run Otis&rsquo;s read on the Analytics tab first — the fields below pre-fill from it.</p>
        </div>
      )}
      {err && <p className="text-sm text-red-600 mb-4">{err}</p>}

      {/* ── Member preview band ────────────────────────────────────────────── */}
      <section className="rounded-2xl px-7 py-6 mb-7" style={{ background: "rgba(20,32,60,0.05)", border: "1px solid rgba(20,32,60,0.10)" }}>
        <h2 className="text-2xl mb-2" style={{ fontFamily: "Playfair Display, serif" }}>Member preview</h2>
        <p className="text-sm leading-relaxed text-[var(--color-ink)] max-w-3xl">
          A walkthrough of the results members will see and the Team Agreement activity they&rsquo;ll go through, exactly in the order they&rsquo;ll experience it.
        </p>
        <p className="text-sm leading-relaxed text-[var(--color-grey)] mt-2 max-w-3xl">
          You can edit portions of this section before releasing it to the team.
        </p>
      </section>

      {/* ── Two columns: 1 Results · 2 Activity ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ===== 1 · RESULTS ===== */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(26,90,110,0.05)", border: "1px solid rgba(26,90,110,0.14)" }}>
          <PartHeading n={1} title="Results" subtitle="The Team Assessment results shown to members." color={SECTION_COLOR.results} />

          <PreviewBubble section="Introduction" color={SECTION_COLOR.intro} title="Welcome back"
            body="Read-aloud offer, a warm welcome, and what today is about. (Fixed — not editable.)" />
          <PreviewBubble section="Assessment Results" color={SECTION_COLOR.results} title="The ocean recap"
            body="Otis re-introduces the three zones of psychological safety with the ocean visual. (Fixed.)" />

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-black/10" />
            <span className="text-[11px] uppercase tracking-widest text-[var(--color-grey)]">Members rate each read below</span>
            <span className="h-px flex-1 bg-black/10" />
          </div>

          <EditableBubble section="Assessment Results" color={SECTION_COLOR.results} pulse
            title={`Zone 1 · ${ZONE_NAME[1]}`} value={report.ps_read_zone1} original={tier2?.ps_read?.zone1}
            placeholder="— zone 1 read —" onChange={(v) => set("ps_read_zone1", v)} />
          <EditableBubble section="Assessment Results" color={SECTION_COLOR.results} pulse
            title={`Zone 2 · ${ZONE_NAME[2]}`} value={report.ps_read_zone2} original={tier2?.ps_read?.zone2}
            placeholder="— zone 2 read —" onChange={(v) => set("ps_read_zone2", v)} />
          <EditableBubble section="Assessment Results" color={SECTION_COLOR.results} pulse
            title={`Zone 3 · ${ZONE_NAME[3]}`} value={report.ps_read_zone3} original={tier2?.ps_read?.zone3}
            placeholder="— zone 3 read —" onChange={(v) => set("ps_read_zone3", v)} />

          {/* Shared purpose — opt in, blurred until included */}
          <div className="rounded-xl border px-4 py-3 space-y-2" style={{ borderColor: includeSP ? `${SECTION_COLOR.results}66` : "rgba(0,0,0,0.12)", background: includeSP ? "transparent" : "rgba(0,0,0,0.015)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: SECTION_COLOR.results }}>Assessment Results</span>
              <span className="text-sm font-medium">Shared purpose</span>
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full"
                style={includeSP ? { background: "rgba(45,122,79,0.12)", color: "#2D7A4F" } : { background: "rgba(0,0,0,0.06)", color: "var(--color-grey)" }}>
                {includeSP ? "Included in release" : "Not included"}
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={includeSP} onChange={(e) => set("include_shared_purpose", e.target.checked)} className="h-4 w-4 accent-[var(--color-purple)]" />
              Would you like to add a shared-purpose results section?
            </label>
            <p className={`text-xs ${recommendSP ? "text-amber-700" : "text-[var(--color-grey)]"}`}>{spHint}</p>
            <div style={includeSP ? undefined : { filter: "blur(3px)", opacity: 0.55, pointerEvents: "none", userSelect: "none" }} aria-hidden={!includeSP}>
              <EditableBubble section="Assessment Results" color={SECTION_COLOR.results} pulse
                title={`Shared purpose · ${sharedPurposeClassificationLabel(spClassification)}`}
                value={report.shared_purpose_read} original={tier2?.shared_purpose_read?.read}
                placeholder="— shared-purpose read —" onChange={(v) => set("shared_purpose_read", v)} />
            </div>
          </div>
        </div>

        {/* ===== 2 · ACTIVITY ===== */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(154,91,6,0.05)", border: "1px solid rgba(154,91,6,0.16)" }}>
          <PartHeading n={2} title="Activity" subtitle="The Team Stories they share, and the Team Agreement they build." color={SECTION_COLOR.agreement} />

          {/* Focus chooser */}
          <div className="rounded-xl border-2 border-dashed bg-white px-4 py-4 space-y-3" style={{ borderColor: `${SECTION_COLOR.stories}66` }}>
            <div>
              <h3 className="text-base font-semibold">Choose the focus of the Team Agreement activity</h3>
              <p className="text-xs text-[var(--color-grey)] mt-1 leading-relaxed">
                Members will be asked to think about an area of psychological safety the team scored poorly on. They&rsquo;ll contribute stories that may help explain why, and ideas for behaviours they ALWAYS / NEVER want to see if the team&rsquo;s goal is to improve. Otis has suggested where to focus, based on the survey responses.
              </p>
            </div>

            <select className="form-input text-sm w-full" value={report.focus_statement_id ?? ""} onChange={(e) => onFocusSelect(e.target.value)}>
              <option value="">— select a focus item —</option>
              {candidates.length > 0 && (
                <optgroup label="Otis's top picks">
                  {candidates.map((c, i) => (
                    <option key={c.statement_id} value={c.statement_id}>
                      #{i + 1} · {ZONE_SHORT[c.zone] ?? `Zone ${c.zone}`}: {c.statement_text}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherStatements.length > 0 && (
                <optgroup label="Other items">
                  {otherStatements.map((s) => (
                    <option key={s.statement_id} value={s.statement_id}>
                      {ZONE_SHORT[s.zone] ?? `Zone ${s.zone}`}: {s.statement_text}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {report.focus_statement_id && (
              <div className="flex items-center gap-2 flex-wrap">
                {focusStatement && ZONE_BADGE[focusStatement.zone] && <span className={ZONE_BADGE[focusStatement.zone]}>{ZONE_SHORT[focusStatement.zone]}</span>}
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={selectedCandidate ? { background: "rgba(45,122,79,0.12)", color: "#2D7A4F" } : { background: "rgba(0,0,0,0.06)", color: "var(--color-grey)" }}>
                  {selectedCandidate ? "Otis top pick" : "Your own choice"}
                </span>
              </div>
            )}

            <EditableBubble section="Focus" color={SECTION_COLOR.stories} title="Otis's reasoning — why focus here"
              value={report.focus_narrative} original={selectedCandidate?.why}
              placeholder={report.focus_statement_id ? "Otis's reasoning appears here when you pick one of Otis's top picks. Add your own if you like." : "Pick a focus item to see Otis's reasoning."}
              onChange={(v) => set("focus_narrative", v)} />

            <div className="flex items-center justify-between gap-4 pt-1">
              <p className="text-xs text-[var(--color-grey)]">Also show this reasoning to members in their report</p>
              <Toggle on={!!report.include_rationalization_in_report} onChange={(v) => set("include_rationalization_in_report", v)} />
            </div>
          </div>

          {/* Include Team Stories toggle */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium">Include the Team Stories section</p>
              <p className="text-xs text-[var(--color-grey)] mt-0.5">Members tell a short story about the focus before building the agreement.</p>
            </div>
            <Toggle on={includeStories} onChange={(v) => set("include_stories", v)} />
          </div>

          {/* Process preview */}
          {includeStories && (
            <PreviewBubble auto section="Team Stories" color={SECTION_COLOR.stories} title="Team Stories" body={storiesBody} />
          )}
          <PreviewBubble auto section="Team Agreement" color={SECTION_COLOR.agreement} title="Build the agreement" body={agreementBody} />
          <PreviewBubble section="Team Agreement" color={SECTION_COLOR.agreement} title="30-day commitment"
            body="Commitment question + how the team meets. (Fixed.)" />
          <PreviewBubble section="Finish" color={SECTION_COLOR.finish} title="Review & submit"
            body="Members review everything, may update their global exact-excerpt preference, can withdraw, download a report, and submit. (Fixed.)" />
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 mt-6 border-t border-black/10">
        <div className="space-y-1">
          {savedAt && !busy && <p className="text-xs text-[var(--color-grey)]">Draft saved at {savedAt}</p>}
          {!report.focus_statement_id && <p className="text-xs text-amber-700">Select a focus item before releasing.</p>}
          {releasedAt && sentCount !== null && (
            <p className="text-xs text-green-700">
              {sentCount > 0 ? `Sent to ${sentCount} member${sentCount !== 1 ? "s" : ""}.` : "No new emails sent."}
              {skippedCount !== null && skippedCount > 0 && <span className="text-[var(--color-amber)]"> {skippedCount} skipped — already sent.</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void save(true)} disabled={busy} className="btn-secondary" style={{ padding: "8px 18px", fontSize: "13px" }}>
            {busy ? "Saving…" : "Save draft"}
          </button>
          {!confirmRelease ? (
            <button type="button" onClick={() => setConfirmRelease(true)} disabled={busy || !report.focus_statement_id} className="btn-primary" style={{ padding: "8px 20px", fontSize: "13px" }}>
              {releasedAt ? "Re-release to team" : "Release to team"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-grey)]">Send Phase 3 links?</span>
              <button type="button" onClick={() => void save(false)} disabled={busy} className="btn-primary" style={{ padding: "6px 14px", fontSize: "13px" }}>{busy ? "Sending…" : "Confirm"}</button>
              <button type="button" onClick={() => setConfirmRelease(false)} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">Cancel</button>
            </div>
          )}
          {releasedAt && !confirmRelease && (
            confirmResendAll ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-grey)]">Re-send to everyone?</span>
                <button type="button" onClick={() => void save(false, true)} disabled={busy} className="btn-secondary" style={{ padding: "6px 14px", fontSize: "13px" }}>{busy ? "Sending…" : "Confirm"}</button>
                <button type="button" onClick={() => setConfirmResendAll(false)} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmResendAll(true)} disabled={busy} className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">Re-send to all</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function PartHeading({ n, title, subtitle, color }: { n: number; title: string; subtitle: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-shrink-0 h-8 w-8 rounded-full text-white text-sm font-semibold flex items-center justify-center" style={{ background: color }}>{n}</span>
      <div>
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        <p className="text-xs text-[var(--color-grey)]">{subtitle}</p>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--color-purple)" : "rgba(0,0,0,0.2)" }}>
      <span className="inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform" style={{ transform: on ? "translateX(22px)" : "translateX(2px)", marginTop: 2 }} />
    </button>
  );
}
