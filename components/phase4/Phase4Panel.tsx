"use client";

// Phase 4 self-serve — consultant "Team Agreement" tab.
// Combines §5 (Generate insights + dashboard: behaviour board with member links
// removed, clarity, commitment/touchpoint distributions, roadmap) with §6.0
// (review the exit interview as members will see it — every text element
// editable, Otis original preserved — then Release to team, which generates the
// filled artifacts and emails members). Release mirrors the Phase 3 pattern.

import { useState } from "react";
import { renderAgreementSentence } from "@/lib/agreementText";
import type { Phase4Agreement, Phase4SelfServeJson } from "@/types/database";

type Props = {
  teamId: string;
  initial: Phase4SelfServeJson | null;
  allComplete: boolean;
};

const BUCKET_COLOR: Record<string, string> = {
  never: "var(--color-amber)",
  always: "var(--color-navy)",
  sometimes: "var(--color-grey)",
};
const CLARITY_CLS: Record<string, string> = {
  clear: "bg-green-100 text-green-800",
  mixed: "bg-blue-100 text-blue-700",
  unclear: "bg-amber-100 text-amber-800",
};

export default function Phase4Panel({ teamId, initial, allComplete }: Props) {
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

  async function generate() {
    setGenerating(true);
    setErr(null);
    try {
      const res = await fetch("/api/phase4/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          data.error === "members_incomplete"
            ? `Not all members have finished Phase 3 (${data.incomplete} outstanding).`
            : data.error === "no_focus_item"
              ? "No focus item yet — set one on the Phase 3 tab first."
              : `Generation failed: ${[data.error, data.detail].filter(Boolean).join(" — ") || "unknown error"}`
        );
        setGenerating(false);
        return;
      }
      setJson(data.insights as Phase4SelfServeJson);
      setReleasedAt((data.insights as Phase4SelfServeJson).released_at);
    } catch {
      setErr("Something went wrong. Please try again.");
    }
    setGenerating(false);
  }

  function editAgreement(next: Phase4Agreement) {
    setJson((prev) =>
      prev ? { ...prev, agreement: next, agreement_text: renderAgreementSentence(next) } : prev
    );
    setSavedAt(null);
  }
  function setField(key: "what_to_do_next" | "closing_note", value: string) {
    setJson((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(null);
  }

  async function save(dryRun: boolean, resendAll = false) {
    if (!json) return;
    setBusy(true);
    setErr(null);
    setSentCount(null);
    setSkippedCount(null);

    const res = await fetch("/api/phase4/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, selfserve: json, dry_run: dryRun, resend_all: resendAll }),
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
      setJson((prev) => (prev ? { ...prev, released_at: data.released_at } : prev));
      if (data.using_test_sender) {
        setErr(
          "Using Resend's shared test domain — emails may land in spam or not arrive. " +
          "Add RESEND_FROM_EMAIL to Vercel env vars once you have a verified Resend sender domain."
        );
      }
    }
    setConfirmRelease(false);
    setConfirmResendAll(false);
    setBusy(false);
  }

  // ── Empty state: Generate insights CTA ──────────────────────────────────────
  if (!json) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="card border border-dashed border-black/20 text-center" style={{ padding: "36px 28px" }}>
          <h1 className="text-2xl mb-2" style={{ fontFamily: "Playfair Display, serif" }}>Team Agreement</h1>
          <p className="text-sm text-[var(--color-grey)] max-w-md mx-auto mb-6">
            Once every member has finished Phase 3, Otis groups the behaviours, drafts a Team
            Behaviour Agreement, assesses how clearly the team converged, and builds a 30-day roadmap.
          </p>
          <button type="button" onClick={() => void generate()} disabled={!allComplete || generating} className="btn-primary">
            {generating ? "Otis is thinking…" : "Generate insights"}
          </button>
          {!allComplete && (
            <p className="text-xs text-amber-700 mt-3">Enabled once all members have completed Phase 3.</p>
          )}
          {err && <p className="text-sm text-red-600 mt-4">{err}</p>}
        </div>
      </div>
    );
  }

  const a = json.agreement;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <section className="relative rounded-2xl overflow-hidden">
        <img src="/ps-ocean.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-navy)]/85 to-[var(--color-navy)]/55" />
        <div className="relative px-8 py-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-white" style={{ fontFamily: "Playfair Display, serif" }}>Team Agreement</h1>
            <p className="text-sm text-white/75 mt-1 max-w-2xl">
              Review what members will receive, edit any wording, then release. Members see nothing until you release.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {releasedAt && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-white/20 text-white whitespace-nowrap">
                Released {new Date(releasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            )}
            <button type="button" onClick={() => void generate()} disabled={generating}
              className="text-xs text-white/80 hover:text-white underline">
              {generating ? "Regenerating…" : "Re-generate insights"}
            </button>
          </div>
        </div>
      </section>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* ── Clarity ──────────────────────────────────────────────────────────── */}
      <section className="card space-y-3" style={{ padding: "24px" }}>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">Clarity assessment</h2>
          <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${CLARITY_CLS[json.clarity.state]}`}>
            {json.clarity.state}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{json.clarity.message}</p>
        {json.clarity.split_behaviours.length > 0 && (
          <p className="text-xs text-[var(--color-grey)]">
            Bucket splits: {json.clarity.split_behaviours.map((b) => `"${b}"`).join(", ")}
          </p>
        )}
      </section>

      {/* ── Behaviour board (member links removed) ───────────────────────────── */}
      <section className="card space-y-4" style={{ padding: "24px" }}>
        <div>
          <h2 className="text-lg font-medium">Behaviour board</h2>
          <p className="text-xs text-[var(--color-grey)] mt-0.5">
            All behaviours pooled and grouped, member names removed. The number is how many members converged.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["never", "sometimes", "always"] as const).map((bucket) => {
            const groups = json.behaviour_board.filter((g) => g.bucket === bucket);
            return (
              <div key={bucket} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: BUCKET_COLOR[bucket] }}>
                  {bucket}
                </p>
                {groups.length === 0 && <p className="text-xs text-[var(--color-grey)] italic">None</p>}
                {groups.map((g, i) => (
                  <div key={i} className="rounded-lg border border-black/8 px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex-1 leading-snug">{g.representative}</span>
                      <span className="text-xs text-[var(--color-grey)] flex-shrink-0">×{g.member_count}</span>
                    </div>
                    {g.bucket_split && (
                      <p className="text-[10px] text-[var(--color-amber)] mt-1">
                        split · never {g.never_members} / sometimes {g.sometimes_members} / always {g.always_members}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Distributions ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="card space-y-3" style={{ padding: "24px" }}>
          <h2 className="text-lg font-medium">Commitment</h2>
          <BarChart counts={json.commitment_distribution.counts} />
          <p className="text-xs text-[var(--color-grey)]">{json.commitment_distribution.summary}</p>
          {json.low_commitment_note && (
            <div className="rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/6 px-3 py-2">
              <p className="text-[11px] text-amber-800">
                <span className="font-medium">For you only:</span> {json.low_commitment_note}
              </p>
            </div>
          )}
        </section>
        <section className="card space-y-3" style={{ padding: "24px" }}>
          <h2 className="text-lg font-medium">Meeting synchronously</h2>
          <BarChart counts={json.touchpoint_distribution.counts} />
          <p className="text-xs text-[var(--color-grey)]">{json.touchpoint_distribution.summary}</p>
          {json.touchpoint_note && (
            <p className="text-[11px] text-[var(--color-grey)] italic">{json.touchpoint_note}</p>
          )}
        </section>
      </div>

      {/* ── Roadmap ──────────────────────────────────────────────────────────── */}
      <section className="card space-y-2" style={{ padding: "24px" }}>
        <h2 className="text-lg font-medium">Roadmap</h2>
        <p className="text-sm leading-relaxed">{json.roadmap}</p>
      </section>

      {/* ── Exit-interview editor (what members receive) ─────────────────────── */}
      <section className="card space-y-5" style={{ padding: "24px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">What members will see</h2>
            <p className="text-xs text-[var(--color-grey)] mt-0.5">Edit any wording. Otis&rsquo;s original is preserved.</p>
          </div>
          <button type="button" onClick={() => setShowOriginal((v) => !v)}
            className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
            {showOriginal ? "Hide Otis's original" : "View Otis's original"}
          </button>
        </div>

        {/* The agreement (structured — drives the game plan + check-in) */}
        <div className="space-y-3">
          <label className="form-label">The agreement</label>
          <div className="space-y-2 text-sm">
            <LabeledInput label="In order to make this team a place where"
              value={a.ps_item} onChange={(v) => editAgreement({ ...a, ps_item: v })} />
            <ListEditor label="Especially during (max 2 situations)" items={a.situations} max={2}
              onChange={(items) => editAgreement({ ...a, situations: items })} />
            <ListEditor label="ALWAYS (2–3)" items={a.always} max={3}
              onChange={(items) => editAgreement({ ...a, always: items })} />
            <ListEditor label="NEVER (2–3)" items={a.never} max={3}
              onChange={(items) => editAgreement({ ...a, never: items })} />
          </div>
          <div className="rounded-lg bg-black/4 px-3 py-2 text-sm italic text-[var(--color-grey)]">
            {json.agreement_text}
          </div>
          {showOriginal && (
            <p className="text-xs text-[var(--color-grey)] border-l-2 border-black/10 pl-3">
              Otis: {json.otis_original.agreement_text}
            </p>
          )}
        </div>

        {/* What to do next (verbatim script, editable) */}
        <EditableBlock label="What to do next" value={json.what_to_do_next}
          original={showOriginal ? json.otis_original.what_to_do_next : null}
          onChange={(v) => setField("what_to_do_next", v)} rows={7} />

        {/* Closing note */}
        <EditableBlock label="Closing note" value={json.closing_note}
          original={showOriginal ? json.otis_original.closing_note : null}
          onChange={(v) => setField("closing_note", v)} rows={2} />
      </section>

      {/* ── Actions (mirror Phase 3 release) ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-black/10">
        <div className="space-y-1">
          {savedAt && !busy && <p className="text-xs text-[var(--color-grey)]">Draft saved at {savedAt}</p>}
          {releasedAt && sentCount !== null && (
            <p className="text-xs text-green-700">
              {sentCount > 0 ? `Sent to ${sentCount} member${sentCount !== 1 ? "s" : ""}.` : "No new emails sent."}
              {skippedCount !== null && skippedCount > 0 && (
                <span className="text-[var(--color-amber)]"> {skippedCount} skipped — already sent. Use &ldquo;Re-send to all&rdquo; to override.</span>
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
            <button type="button" onClick={() => setConfirmRelease(true)} disabled={busy}
              className="btn-primary" style={{ padding: "8px 20px", fontSize: "13px" }}>
              {releasedAt ? "Re-release to team" : "Release to team"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-grey)]">Send results to members?</span>
              <button type="button" onClick={() => void save(false)} disabled={busy}
                className="btn-primary" style={{ padding: "6px 14px", fontSize: "13px", background: "var(--color-navy)" }}>
                {busy ? "Sending…" : "Confirm"}
              </button>
              <button type="button" onClick={() => setConfirmRelease(false)}
                className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">Cancel</button>
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
                <button type="button" onClick={() => setConfirmResendAll(false)}
                  className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">Cancel</button>
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

// ── Small building blocks ──────────────────────────────────────────────────────

function BarChart({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (entries.length === 0) return <p className="text-xs text-[var(--color-grey)] italic">No responses yet.</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([label, n]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-grey)] w-40 flex-shrink-0 truncate" title={label}>{label}</span>
          <div className="flex-1 h-4 rounded bg-black/5 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(n / max) * 100}%`, background: "var(--color-navy)" }} />
          </div>
          <span className="text-[11px] text-[var(--color-ink)] w-5 text-right">{n}</span>
        </div>
      ))}
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-grey)]">{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="form-input text-sm w-full" />
    </div>
  );
}

function ListEditor({ label, items, max, onChange }: {
  label: string; items: string[]; max: number; onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-grey)]">{label}</p>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="form-input text-sm flex-1" />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-xs text-[var(--color-grey)] hover:text-red-600">✕</button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, ""])}
          className="text-xs text-[var(--color-purple)] hover:underline">+ add</button>
      )}
    </div>
  );
}

function EditableBlock({ label, value, original, onChange, rows }: {
  label: string; value: string; original: string | null; onChange: (v: string) => void; rows: number;
}) {
  return (
    <div className="space-y-1">
      <label className="form-label">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="form-input text-sm w-full resize-y" />
      {original && (
        <p className="text-xs text-[var(--color-grey)] border-l-2 border-black/10 pl-3 whitespace-pre-wrap">
          Otis: {original}
        </p>
      )}
    </div>
  );
}
