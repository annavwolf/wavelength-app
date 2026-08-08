"use client";

// Report & Activity Release — the consultant edits only the qualitative reads,
// the focus choice + rationalization, and a few release toggles. Everything else
// is fixed and shown in a live member preview. Releasing emails Phase 3 links.

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Phase3ReportJson, FocusCandidate } from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";
import { ZONE_NAME, ZONE_BADGE, ZONE_SHORT } from "@/components/dashboard/types";
import Phase3ReleasePreview from "@/components/phase3/Phase3ReleasePreview";

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
  const spClassification = tier2?.shared_purpose_read?.classification;
  const recommendSP = FLAGGED_CLASSIFICATIONS.includes(spClassification ?? "")
    || !!(tier2?.welfare_or_sensitive_note && tier2.welfare_or_sensitive_note !== "none");
  const focusStatement = statements.find((s) => s.statement_id === report.focus_statement_id) ?? null;
  const tier2Missing = !tier2;

  function pickCandidate(c: FocusCandidate) {
    setReport((prev) => ({ ...prev, focus_statement_id: c.statement_id, focus_narrative: prev.focus_narrative?.trim() ? prev.focus_narrative : c.why }));
    setSavedAt(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <section className="relative rounded-2xl overflow-hidden mb-8">
        <img src="/ps-ocean.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-navy)]/85 to-[var(--color-navy)]/55" />
        <div className="relative px-8 py-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-white" style={{ fontFamily: "Playfair Display, serif" }}>Report &amp; Activity Release</h1>
            <p className="text-sm text-white/75 mt-1 max-w-2xl">
              Edit the reads and the focus, set what members see, then release. Members see nothing until you release.
            </p>
            <Link href={`/teams/${teamId}/journey`} className="inline-block mt-3 text-sm text-white/90 underline underline-offset-2 hover:text-white">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ── Left: editor ─────────────────────────────────────────────── */}
        <div className="space-y-8">
          {/* PART 1 — RESULTS */}
          <div className="space-y-5">
            <PartHeading n={1} title="Results" subtitle="What members see — and are asked to react to." />

            <section className="card space-y-5" style={{ padding: "24px" }}>
              <div>
                <h3 className="text-base font-medium">Psychological safety read</h3>
                <p className="text-xs text-[var(--color-grey)] mt-0.5">Edit the wording only — members can&rsquo;t see the raw scores, and they&rsquo;ll rate how accurate each read feels.</p>
              </div>
              <Field label="Overall shape" value={report.ps_read_overall} onChange={(v) => set("ps_read_overall", v)} />
              <Field label={`Zone 1 — ${ZONE_NAME[1]}`} value={report.ps_read_zone1} onChange={(v) => set("ps_read_zone1", v)} />
              <Field label={`Zone 2 — ${ZONE_NAME[2]}`} value={report.ps_read_zone2} onChange={(v) => set("ps_read_zone2", v)} />
              <Field label={`Zone 3 — ${ZONE_NAME[3]}`} value={report.ps_read_zone3} onChange={(v) => set("ps_read_zone3", v)} />
            </section>

            <section className="card space-y-4" style={{ padding: "24px" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-medium">Shared purpose (optional)</h3>
                  <p className="text-xs text-[var(--color-grey)] mt-0.5">Include a shared-purpose results section before the safety zones.</p>
                </div>
                <Toggle on={!!report.include_shared_purpose} onChange={(v) => set("include_shared_purpose", v)} />
              </div>
              {recommendSP && !report.include_shared_purpose && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Otis flagged shared purpose as worth addressing{spClassification ? ` (${spClassification})` : ""} — consider including it.
                </p>
              )}
              {report.include_shared_purpose && (
                <Field label="Shared-purpose read" value={report.shared_purpose_read} onChange={(v) => set("shared_purpose_read", v)} />
              )}
            </section>
          </div>

          {/* PART 2 — ACTIVITY */}
          <div className="space-y-5">
            <PartHeading n={2} title="Activity" subtitle="The Team Agreement members build." />

            <section className="card space-y-4" style={{ padding: "24px" }}>
              <div>
                <h3 className="text-base font-medium">Focus item — Otis&rsquo;s ranked picks</h3>
                <p className="text-xs text-[var(--color-grey)] mt-0.5">Pick the item the activity centres on. Otis ranked these; you can also choose any item below.</p>
              </div>

              <div className="space-y-2">
                {candidates.map((c, i) => {
                  const selected = report.focus_statement_id === c.statement_id;
                  return (
                    <button key={c.statement_id} type="button" onClick={() => pickCandidate(c)}
                      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${selected ? "border-[var(--color-purple)] bg-[var(--color-purple)]/5" : "border-black/10 hover:border-black/25"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-navy)] text-white">#{i + 1}</span>
                        {c.zone ? <span className={ZONE_BADGE[c.zone] ?? ""}>{ZONE_SHORT[c.zone] ?? `Zone ${c.zone}`}</span> : null}
                        <span className="text-sm font-medium">{c.statement_text}</span>
                      </div>
                      {c.why && <p className="text-xs text-[var(--color-grey)] leading-relaxed">{c.why}</p>}
                    </button>
                  );
                })}
                {candidates.length === 0 && <p className="text-xs text-[var(--color-grey)]">No ranked picks yet — run Otis&rsquo;s read, or choose an item below.</p>}
              </div>

              <div className="space-y-1">
                <label className="form-label">Or choose any item</label>
                <select className="form-input text-sm" value={report.focus_statement_id ?? ""} onChange={(e) => set("focus_statement_id", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— select an item —</option>
                  {statements.map((s) => (
                    <option key={s.statement_id} value={s.statement_id}>{ZONE_SHORT[s.zone] ?? `Zone ${s.zone}`}: {s.statement_text}</option>
                  ))}
                </select>
              </div>

              <Field label="Rationalization — why this item" hint="Otis's case for the choice. Editable." value={report.focus_narrative} onChange={(v) => set("focus_narrative", v)} />
              <div className="flex items-center justify-between gap-4 pt-1">
                <p className="text-xs text-[var(--color-grey)]">Show this rationalization to members in their report</p>
                <Toggle on={!!report.include_rationalization_in_report} onChange={(v) => set("include_rationalization_in_report", v)} />
              </div>
            </section>

            <section className="card space-y-2" style={{ padding: "24px" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-medium">Team Stories section</h3>
                  <p className="text-xs text-[var(--color-grey)] mt-0.5">Members tell stories about the focus before building the agreement. The presentation is fixed — you choose whether to include it.</p>
                </div>
                <Toggle on={report.include_stories !== false} onChange={(v) => set("include_stories", v)} />
              </div>
            </section>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-black/10">
            <div className="space-y-1">
              {savedAt && !busy && <p className="text-xs text-[var(--color-grey)]">Draft saved at {savedAt}</p>}
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
          {!report.focus_statement_id && <p className="text-xs text-amber-700 -mt-2">Select a focus item before releasing.</p>}
        </div>

        {/* ── Right: live preview ──────────────────────────────────────── */}
        <div className="lg:sticky lg:top-28">
          <Phase3ReleasePreview report={report} focusStatement={focusStatement} spClassification={spClassification} />
        </div>
      </div>
    </div>
  );
}

function PartHeading({ n, title, subtitle }: { n: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-shrink-0 h-7 w-7 rounded-full bg-[var(--color-navy)] text-white text-sm font-semibold flex items-center justify-center">{n}</span>
      <div>
        <h2 className="text-lg font-medium leading-tight">{title}</h2>
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

function Field({ label, hint, value, onChange, rows = 3 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <label className="form-label">{label}</label>
      {hint && <p className="text-[11px] text-[var(--color-grey)] -mt-0.5">{hint}</p>}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="form-input text-sm w-full resize-y" placeholder="—" />
    </div>
  );
}
