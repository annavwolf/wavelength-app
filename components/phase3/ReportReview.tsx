"use client";

// §3.6 — Consultant report-review + release screen.
// Runs BEFORE §5 (PreworkReview). The consultant edits the Otis-generated
// reads, optionally overrides the focus item, writes a workshop intro, then
// releases — which sends Phase 3 links to all members via email.

import { useState, useEffect } from "react";
import type { Phase3ReportJson } from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";
import { ZONE_NAME, ZONE_BADGE, ZONE_SHORT } from "@/components/dashboard/types";

type Props = {
  teamId: string;
  tier1: Tier1Result;
  tier2: Tier2Result | null;
  existingReport: Phase3ReportJson | null;
};

function seedReport(tier2: Tier2Result | null, existing: Phase3ReportJson | null): Phase3ReportJson {
  if (existing) return existing;
  return {
    ps_read_overall: tier2?.ps_read?.overall_shape ?? "",
    ps_read_zone1: tier2?.ps_read?.zone1 ?? "",
    ps_read_zone2: tier2?.ps_read?.zone2 ?? "",
    ps_read_zone3: tier2?.ps_read?.zone3 ?? "",
    shared_purpose_read: tier2?.shared_purpose_read?.read ?? "",
    focus_statement_id: tier2?.focus_hypothesis?.statement_id ?? null,
    focus_narrative: tier2?.focus_hypothesis?.hypothesis ?? "",
    workshop_intro: "",
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

  function set(key: keyof Phase3ReportJson, value: string | number | null) {
    setReport((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  async function save(dryRun: boolean, resendAll = false) {
    setBusy(true);
    setErr(null);
    setSentCount(null);
    setSkippedCount(null);

    const res = await fetch("/api/phase3/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, report, dry_run: dryRun, resend_all: resendAll }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErr(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }

    if (dryRun) {
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    } else {
      setReleasedAt(data.released_at ?? new Date().toISOString());
      setSentCount(data.sent_count ?? 0);
      setSkippedCount(data.skipped_already_sent ?? 0);
      setReport((prev) => ({
        ...prev,
        released_at: data.released_at,
        sent_member_ids: [...(prev.sent_member_ids ?? [])],
      }));
      if (data.using_test_sender) {
        setErr(
          `Using Resend's shared test domain — emails may land in spam or not arrive. ` +
          `Add RESEND_FROM_EMAIL to Vercel env vars once you have a verified Resend sender domain.`
        );
      }
    }

    setConfirmRelease(false);
    setConfirmResendAll(false);
    setBusy(false);
  }

  const statements = tier1.ps_statements ?? [];
  const focusStatement = statements.find((s) => s.statement_id === report.focus_statement_id) ?? null;

  const tier2Missing = !tier2;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: "Playfair Display, serif" }}>
            Report &amp; Release
          </h1>
          <p className="text-sm text-[var(--color-grey)] mt-1 max-w-2xl">
            Edit Otis&rsquo;s reads below, then release — this sends Phase 3 links to all members. Members
            see nothing until you release.
          </p>
        </div>
        {releasedAt && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap flex-shrink-0">
            Released {new Date(releasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {tier2Missing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-800">
            Run Otis&rsquo;s read on the Analytics tab first — the fields below will be pre-filled from it.
          </p>
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* ── Section 1: PS zone reads ─────────────────────────────────────── */}
      <section className="card space-y-5" style={{ padding: "24px" }}>
        <div>
          <h2 className="text-lg font-medium">Psychological safety read</h2>
          <p className="text-xs text-[var(--color-grey)] mt-0.5">
            Otis&rsquo;s read of the team&rsquo;s safety landscape. Edit to sharpen or correct.
          </p>
        </div>

        <Field
          label="Overall shape"
          hint="A 1–2 sentence summary of the team's overall pattern."
          value={report.ps_read_overall}
          onChange={(v) => set("ps_read_overall", v)}
        />
        <Field
          label={`Zone 1 — ${ZONE_NAME[1]}`}
          value={report.ps_read_zone1}
          onChange={(v) => set("ps_read_zone1", v)}
        />
        <Field
          label={`Zone 2 — ${ZONE_NAME[2]}`}
          value={report.ps_read_zone2}
          onChange={(v) => set("ps_read_zone2", v)}
        />
        <Field
          label={`Zone 3 — ${ZONE_NAME[3]}`}
          value={report.ps_read_zone3}
          onChange={(v) => set("ps_read_zone3", v)}
        />
      </section>

      {/* ── Section 2: Shared-purpose read ──────────────────────────────── */}
      <section className="card space-y-4" style={{ padding: "24px" }}>
        <div>
          <h2 className="text-lg font-medium">Shared-purpose read</h2>
          <p className="text-xs text-[var(--color-grey)] mt-0.5">
            How aligned the team is around their shared purpose.
          </p>
        </div>
        <Field
          label="Purpose read"
          value={report.shared_purpose_read}
          onChange={(v) => set("shared_purpose_read", v)}
        />
      </section>

      {/* ── Section 3: Focus item ─────────────────────────────────────────── */}
      <section className="card space-y-4" style={{ padding: "24px" }}>
        <div>
          <h2 className="text-lg font-medium">Workshop focus item</h2>
          <p className="text-xs text-[var(--color-grey)] mt-0.5">
            The PS item the workshop will centre on. Otis selected this — you can override it.
          </p>
        </div>

        <div className="space-y-2">
          <label className="form-label">Focus item</label>
          <select
            className="form-input text-sm"
            value={report.focus_statement_id ?? ""}
            onChange={(e) => set("focus_statement_id", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— select an item —</option>
            {statements.map((s) => (
              <option key={s.statement_id} value={s.statement_id}>
                {ZONE_SHORT[s.zone] ?? `Zone ${s.zone}`}: {s.statement_text}
              </option>
            ))}
          </select>
          {focusStatement && (
            <div className="flex items-center gap-2 mt-1">
              <span className={ZONE_BADGE[focusStatement.zone] ?? ""}>
                {ZONE_SHORT[focusStatement.zone] ?? `Zone ${focusStatement.zone}`}
              </span>
              <span className="text-xs text-[var(--color-grey)]">{focusStatement.statement_text}</span>
            </div>
          )}
        </div>

        <Field
          label="Focus narrative"
          hint="Why this item? What does it mean for this team right now? (Shown to you only — informs the workshop intro.)"
          value={report.focus_narrative}
          onChange={(v) => set("focus_narrative", v)}
        />
      </section>

      {/* ── Section 4: Workshop intro ────────────────────────────────────── */}
      <section className="card space-y-4" style={{ padding: "24px" }}>
        <div>
          <h2 className="text-lg font-medium">Workshop intro script</h2>
          <p className="text-xs text-[var(--color-grey)] mt-0.5">
            Your opening script for the live session. Not sent to members — for your facilitation notes.
          </p>
        </div>
        <Field
          label="Your intro (optional)"
          hint="How you'll frame the session, the focus item, and what you'll be working on together."
          value={report.workshop_intro}
          onChange={(v) => set("workshop_intro", v)}
          rows={6}
        />
      </section>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-black/10">
        <div className="space-y-1">
          {savedAt && !busy && (
            <p className="text-xs text-[var(--color-grey)]">Draft saved at {savedAt}</p>
          )}
          {releasedAt && sentCount !== null && (
            <p className="text-xs text-green-700">
              {sentCount > 0
                ? `Sent to ${sentCount} member${sentCount !== 1 ? "s" : ""}.`
                : "No new emails sent."}
              {skippedCount !== null && skippedCount > 0 && (
                <span className="text-[var(--color-amber)]">
                  {" "}{skippedCount} skipped — already sent previously. Use &ldquo;Re-send to all&rdquo; to override.
                </span>
              )}
            </p>
          )}
          {releasedAt && sentCount === null && (
            <p className="text-xs text-[var(--color-grey)]">
              Already released. New members added since will receive a link automatically.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={busy}
            className="btn-secondary"
            style={{ padding: "8px 18px", fontSize: "13px" }}
          >
            {busy ? "Saving…" : "Save draft"}
          </button>

          {!confirmRelease ? (
            <button
              type="button"
              onClick={() => setConfirmRelease(true)}
              disabled={busy || !report.focus_statement_id}
              className="btn-primary"
              style={{ padding: "8px 20px", fontSize: "13px" }}
            >
              {releasedAt ? "Re-release to team" : "Release to team"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-grey)]">Send Phase 3 links?</span>
              <button
                type="button"
                onClick={() => void save(false)}
                disabled={busy}
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "13px", background: "var(--color-navy)" }}
              >
                {busy ? "Sending…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRelease(false)}
                className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Re-send to all — bypasses sent_member_ids, for when emails didn't arrive */}
          {releasedAt && !confirmRelease && (
            confirmResendAll ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-grey)]">Re-send to everyone?</span>
                <button
                  type="button"
                  onClick={() => void save(false, true)}
                  disabled={busy}
                  className="btn-secondary"
                  style={{ padding: "6px 14px", fontSize: "13px" }}
                >
                  {busy ? "Sending…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResendAll(false)}
                  className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResendAll(true)}
                disabled={busy}
                className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline"
              >
                Re-send to all
              </button>
            )
          )}
        </div>
      </div>

      {!report.focus_statement_id && (
        <p className="text-xs text-amber-700 -mt-2">Select a focus item before releasing.</p>
      )}
    </div>
  );
}

function Field({
  label, hint, value, onChange, rows = 3,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="form-label">{label}</label>
      {hint && <p className="text-[10px] text-[var(--color-grey)] -mt-0.5">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="form-input text-sm w-full resize-y"
        placeholder="—"
      />
    </div>
  );
}
