"use client";

// Phase 4 — Facilitator session control panel (spec §1.3).
// The named build component: the consultant's surface for running the live
// workshop. It is how Otis "knows" what phase everyone is in — phase is
// facilitator-triggered here, never inferred, and broadcast to the member room.
//
// Design principle (spec §0): Otis prepares and scribes; the facilitator
// conducts; the team decides. This panel prepares (pairing, structure, scripts,
// convergence maths) and scribes (the chosen behaviours and the capture sheet).
// It does NOT do live collaborative editing — members submit in their own room
// (a later increment); this panel displays what was submitted.

import { useEffect, useState } from "react";
import type {
  Member, WorkshopSession, PairSubmission, BehaviourItem, FocusFrame,
  CaptureSheet, WorkshopPhase, Zone,
} from "@/types/database";
import type { Tier2Result } from "@/components/dashboard/types";
import { ZONE_SHORT } from "@/components/dashboard/types";
import {
  MOVEMENTS, FACILITATOR_SCRIPTS, REINFORCEMENT_LIBRARY, CAPTURE_SUGGESTIONS,
  computeStructure, generatePairs, computeConvergence, observabilityFor,
  nextPhase, prevPhase, type MovementId,
} from "@/lib/workshopContent";

type Props = {
  teamId: string;
  teamName: string;
  members: Member[];
  focus?: Tier2Result["focus_hypothesis"];
};

const CAP = 3; // hard cap: 3 ALWAYS and 3 NEVER (spec §5.2)

export default function WorkshopPanel({ teamId, teamName, members, focus }: Props) {
  const [session, setSession] = useState<WorkshopSession | null>(null);
  const [pairSubs, setPairSubs] = useState<PairSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [agreementDraft, setAgreementDraft] = useState("");
  const [locked, setLocked] = useState<{ version: number } | null>(null);

  const participants = members.filter((m) => m.status === "complete");
  const nameById = new Map(members.map((m) => [m.member_id, m.display_name]));

  useEffect(() => { void load(); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/teams/${teamId}/workshop`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setErr(data.error ?? "Unable to load workshop.");
    else {
      setSession((data.session as WorkshopSession | null | undefined) ?? null);
      setPairSubs((data.pair_submissions as PairSubmission[] | undefined) ?? []);
    }
    setLoading(false);
  }

  async function patch(update: Partial<WorkshopSession>) {
    if (!session) return;
    setBusy(true); setErr(null);
    const response = await fetch(`/api/teams/${teamId}/workshop`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id, update }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setErr(data.error ?? "Unable to save workshop changes.");
    else setSession(data.session as WorkshopSession);
    setBusy(false);
  }

  async function startWorkshop() {
    setBusy(true); setErr(null);
    const frame: FocusFrame = {
      item: focus?.statement_text ?? "",
      objective: "",
      context: "",
      why: focus?.hypothesis ?? "",
      zone: (focus?.zone as Zone | undefined) ?? null,
    };
    const response = await fetch(`/api/teams/${teamId}/workshop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus_frame: frame }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setErr(data.error ?? "Unable to start workshop.");
    else setSession(data.session as WorkshopSession);
    setBusy(false);
  }

  function assembleAgreement(s: WorkshopSession): string {
    const f = s.focus_frame;
    const always = s.selected_always ?? [];
    const never = s.selected_never ?? [];
    const cap = s.capture_sheet ?? {};
    const obs = [...always, ...never]
      .map((b) => b.observability?.trim())
      .filter(Boolean);
    const lines: string[] = [];
    lines.push(`In this team, when we want to ${f?.objective || "[objective]"} during ${f?.context || "[context]"}:`);
    lines.push("");
    lines.push(`We will: ${always.map((b) => b.behaviour).filter(Boolean).join("; ") || "—"}`);
    lines.push(`We will avoid: ${never.map((b) => b.behaviour).filter(Boolean).join("; ") || "—"}`);
    if (obs.length) lines.push(`We'll know we're doing this because: ${obs.join("; ")}`);
    if (cap.when_someone_slips) lines.push(`When someone slips: ${cap.when_someone_slips}`);
    if (cap.when_done_well) lines.push(`When someone does it well: ${cap.when_done_well}`);
    if (cap.check_trigger) lines.push(`We'll check in: ${cap.check_trigger}`);
    if (s.revisit_date) lines.push(`We'll revisit this properly on: ${s.revisit_date}`);
    return lines.join("\n");
  }

  async function lockAgreement() {
    if (!session) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/workshop/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          agreements: agreementDraft,
          revisit_date: session.revisit_date,
          focus_zone: session.focus_frame?.zone ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Lock failed"); setBusy(false); return; }
      setLocked({ version: data.code_of_conduct?.version ?? 1 });
      setSession((prev) => prev ? { ...prev, phase: "closed" } : prev);
    } catch {
      setErr("Something went wrong locking the agreement.");
    }
    setBusy(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="max-w-6xl mx-auto px-6 py-16 text-[var(--color-grey)]">Loading workshop…</div>;
  }

  const structure = computeStructure(participants.length);

  // Not started yet → the pre-flight card.
  if (!session) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="card" style={{ padding: "40px 32px" }}>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "Playfair Display, serif" }}>Run the workshop</h2>
          <p className="text-sm text-[var(--color-grey)] mb-6">
            The facilitated session that turns individual sorts into a committed Team Behaviour Agreement.
            Otis prepares and scribes; you conduct; the team decides.
          </p>
          <div className={`rounded-xl px-5 py-4 mb-6 ${structure.supported ? "bg-black/5" : "bg-[var(--color-amber)]/10"}`}>
            <p className="text-sm font-medium">{structure.headline}</p>
            <p className="text-sm text-[var(--color-grey)] mt-1">{structure.detail}</p>
            <p className="text-xs text-[var(--color-grey)] mt-2">
              {participants.length} of {members.length} members complete and ready to take part.
            </p>
          </div>
          {focus?.statement_text && (
            <p className="text-sm text-[var(--color-grey)] mb-6">
              This round&apos;s focus (the seed): <span className="text-[var(--color-ink)]">{focus.statement_text}</span>
            </p>
          )}
          <button type="button" onClick={startWorkshop} disabled={busy || !structure.supported}
            className="btn-primary">
            {busy ? "Opening…" : "Start workshop"}
          </button>
          {err && <p className="text-sm text-red-600 mt-4">{err}</p>}
        </div>
      </div>
    );
  }

  const phase = session.phase;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <PhaseRail phase={phase} />
      {err && <p className="text-sm text-red-600 mb-4">{err}</p>}

      {phase === "closed" || locked ? (
        <ClosedCard version={locked?.version} teamName={teamName} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {phase === "orient" && <OrientMovement session={session} patch={patch} />}
            {phase === "pairs" && (
              <PairsMovement
                session={session} participants={participants} nameById={nameById}
                pairSubs={pairSubs} patch={patch} />
            )}
            {phase === "whole_team" && (
              <WholeTeamMovement session={session} pairSubs={pairSubs} patch={patch} />
            )}
            {phase === "reinforcement" && <ReinforcementMovement session={session} patch={patch} />}
            {phase === "agreement" && (
              <AgreementMovement
                session={session} patch={patch}
                draft={agreementDraft} setDraft={setAgreementDraft}
                assemble={() => setAgreementDraft(assembleAgreement(session))}
                onLock={lockAgreement} busy={busy} />
            )}
          </div>
          <aside className="space-y-6">
            <ScriptCard phase={phase} />
            <div className="card" style={{ padding: "18px 20px" }}>
              <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-1">Structure</p>
              <p className="text-sm font-medium">{structure.headline}</p>
              <p className="text-xs text-[var(--color-grey)] mt-1">{structure.detail}</p>
            </div>
          </aside>
        </div>
      )}

      {/* Phase advance controls — the broadcast (spec §1.3). */}
      {phase !== "closed" && !locked && (
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-black/10">
          <button type="button" onClick={() => patch({ phase: prevPhase(phase) as WorkshopPhase })}
            disabled={busy || phase === "orient"}
            className="btn-secondary disabled:opacity-40" style={{ padding: "8px 18px", fontSize: "13px" }}>
            ← Back
          </button>
          <span className="text-xs text-[var(--color-grey)]">{busy ? "Saving…" : "Facilitator-controlled — members' screens follow you"}</span>
          {phase === "agreement" ? (
            <span className="text-xs text-[var(--color-grey)]">Lock the agreement to finish →</span>
          ) : (
            <button type="button" onClick={() => patch({ phase: nextPhase(phase) as WorkshopPhase })} disabled={busy}
              className="btn-primary" style={{ padding: "8px 20px", fontSize: "13px" }}>
              Advance to {MOVEMENTS[MOVEMENTS.findIndex((m) => m.id === phase) + 1]?.label ?? "next"} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Phase rail ──────────────────────────────────────────────────────────────
function PhaseRail({ phase }: { phase: WorkshopPhase }) {
  const activeIdx = MOVEMENTS.findIndex((m) => m.id === phase);
  const closed = phase === "closed";
  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      {MOVEMENTS.map((m, i) => {
        const state = closed || i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
        return (
          <div key={m.id}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              state === "active" ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white"
                : state === "done" ? "border-[var(--color-navy)]/30 text-[var(--color-navy)]"
                  : "border-black/10 text-[var(--color-grey)]"}`}>
            {m.label} · {m.minutes}m
          </div>
        );
      })}
      {closed && (
        <div className="text-xs px-3 py-1.5 rounded-full border border-green-600 bg-green-600 text-white">Locked ✓</div>
      )}
    </div>
  );
}

function ScriptCard({ phase }: { phase: WorkshopPhase }) {
  if (phase === "closed") return null;
  const script = FACILITATOR_SCRIPTS[phase as MovementId] ?? [];
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Your script — private</p>
      <ul className="space-y-2.5">
        {script.map((line, i) => (
          <li key={i} className="text-sm leading-relaxed text-[var(--color-ink)]">{line}</li>
        ))}
      </ul>
    </div>
  );
}

// ── M1 Orient ─────────────────────────────────────────────────────────────
function OrientMovement({ session, patch }: {
  session: WorkshopSession; patch: (u: Partial<WorkshopSession>) => void;
}) {
  const f = session.focus_frame ?? { item: "", objective: "", context: "", why: "", zone: null };
  const [objective, setObjective] = useState(f.objective);
  const [context, setContext] = useState(f.context);
  function save(next: Partial<FocusFrame>) {
    patch({ focus_frame: { ...f, objective, context, ...next } });
  }
  return (
    <div className="card" style={{ padding: "24px 26px" }}>
      <MovementHeader id="orient" />
      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mt-4 mb-2">The focus frame — what the room sees</p>
      <div className="rounded-xl bg-[var(--color-navy)]/5 px-5 py-4">
        <p className="text-base leading-relaxed">{f.item || "—"}</p>
        {f.why && <p className="text-sm text-[var(--color-grey)] mt-2">Why this: {f.why}</p>}
        {f.zone ? <span className="inline-block mt-2 text-xs text-[var(--color-navy)]">Zone: {ZONE_SHORT[f.zone] ?? f.zone}</span> : null}
      </div>
      <p className="text-sm text-[var(--color-grey)] mt-5 mb-2">
        Confirm the situation in the team&apos;s words — this fills the agreement sentence later
        (&ldquo;when we want to <em>objective</em> during <em>context</em>&rdquo;).
      </p>
      <label className="block text-xs text-[var(--color-grey)] mb-1">Objective — &ldquo;when we want to…&rdquo;</label>
      <input value={objective} onChange={(e) => setObjective(e.target.value)} onBlur={() => save({})}
        placeholder="e.g. surface problems early" className="form-input w-full mb-3" />
      <label className="block text-xs text-[var(--color-grey)] mb-1">Context — &ldquo;during…&rdquo;</label>
      <input value={context} onChange={(e) => setContext(e.target.value)} onBlur={() => save({})}
        placeholder="e.g. a live incident" className="form-input w-full" />
    </div>
  );
}

// ── M2 Pairs ──────────────────────────────────────────────────────────────
function PairsMovement({ session, participants, nameById, pairSubs, patch }: {
  session: WorkshopSession;
  participants: Member[];
  nameById: Map<string, string>;
  pairSubs: PairSubmission[];
  patch: (u: Partial<WorkshopSession>) => void;
}) {
  const pairs = session.pairs ?? [];
  function makePairs() {
    patch({ pairs: generatePairs(participants.map((m) => m.member_id)) });
  }
  const submittedByIndex = new Map(pairSubs.filter((s) => s.submitted_at).map((s) => [s.pair_index, s]));
  return (
    <div className="card" style={{ padding: "24px 26px" }}>
      <MovementHeader id="pairs" />
      <div className="flex items-center justify-between mt-4 mb-3">
        <p className="text-xs uppercase tracking-widest text-[var(--color-grey)]">Otis&apos;s pairing</p>
        <button type="button" onClick={makePairs} className="btn-secondary" style={{ padding: "4px 12px", fontSize: "12px" }}>
          {pairs.length ? "Re-pair" : "Generate pairs"}
        </button>
      </div>
      {pairs.length === 0 ? (
        <p className="text-sm text-[var(--color-grey)]">
          Generate the pairing, then set people up with their partner in the way that works for your session.
        </p>
      ) : (
        <ol className="space-y-2">
          {pairs.map((pair, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-black/5 px-4 py-2.5">
              <span className="text-sm">
                <span className="text-[var(--color-grey)] mr-2">{pair.length === 3 ? "Trio" : "Pair"} {i + 1}:</span>
                {pair.map((id) => nameById.get(id) ?? "?").join(" · ")}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full ${submittedByIndex.has(i) ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {submittedByIndex.has(i) ? "Submitted ✓" : "Working…"}
              </span>
            </li>
          ))}
        </ol>
      )}
      {pairs.length > 0 && (
        <p className="text-sm text-[var(--color-grey)] mt-4">
          Tracker: <span className="text-[var(--color-ink)] font-medium">{submittedByIndex.size} of {pairs.length}</span> pairs submitted.
          The pair sheets (members&apos; own screens) are a later increment — until then, capture picks directly in M3.
        </p>
      )}
    </div>
  );
}

// ── M3 Whole team: share & select ────────────────────────────────────────
function WholeTeamMovement({ session, pairSubs, patch }: {
  session: WorkshopSession; pairSubs: PairSubmission[]; patch: (u: Partial<WorkshopSession>) => void;
}) {
  const alwaysConv = computeConvergence(pairSubs, "always");
  const neverConv = computeConvergence(pairSubs, "never");
  return (
    <div className="card" style={{ padding: "24px 26px" }}>
      <MovementHeader id="whole_team" />
      <p className="text-sm text-[var(--color-grey)] mt-3">
        Round-robin first — every pair says which two and why, before anyone debates. Then use Otis&apos;s read to converge.
      </p>
      <ConvergenceBlock title="ALWAYS — most want to see" kind="always" conv={alwaysConv}
        selected={session.selected_always ?? []} pairSubs={pairSubs}
        onChange={(items) => patch({ selected_always: items })} />
      <ConvergenceBlock title="NEVER — least want to see" kind="never" conv={neverConv}
        selected={session.selected_never ?? []} pairSubs={pairSubs}
        onChange={(items) => patch({ selected_never: items })} />
    </div>
  );
}

function ConvergenceBlock({ title, kind, conv, selected, pairSubs, onChange }: {
  title: string;
  kind: "always" | "never";
  conv: ReturnType<typeof computeConvergence>;
  selected: BehaviourItem[];
  pairSubs: PairSubmission[];
  onChange: (items: BehaviourItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add(behaviour: string) {
    const b = behaviour.trim();
    if (!b || selected.length >= CAP) return;
    if (selected.some((s) => s.behaviour.trim().toLowerCase() === b.toLowerCase())) return;
    onChange([...selected, { behaviour: b, observability: observabilityFor(pairSubs, kind, b) }]);
    setDraft("");
  }
  function removeAt(i: number) { onChange(selected.filter((_, j) => j !== i)); }
  function editObs(i: number, obs: string) {
    onChange(selected.map((s, j) => j === i ? { ...s, observability: obs } : s));
  }
  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">{title}</p>
      <div className={`rounded-lg px-4 py-3 mb-3 text-sm ${
        conv.status === "clear" ? "bg-green-50 text-green-900" : conv.status === "insufficient" ? "bg-black/5 text-[var(--color-grey)]" : "bg-amber-50 text-amber-900"}`}>
        {conv.recommendation}
        {conv.tallies.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {conv.tallies.map((t) => (
              <button key={t.behaviour} type="button" onClick={() => add(t.behaviour)}
                className="text-xs px-2 py-1 rounded-full bg-white/70 border border-black/10 hover:border-[var(--color-navy)]">
                {t.behaviour} · {t.pairs}/{conv.nPairs}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 mb-3">
        {selected.map((s, i) => (
          <div key={i} className="rounded-lg border border-black/10 px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{s.behaviour}</span>
              <button type="button" onClick={() => removeAt(i)} className="text-xs text-[var(--color-grey)] hover:text-red-600">Remove</button>
            </div>
            <input value={s.observability} onChange={(e) => editObs(i, e.target.value)}
              placeholder="We'd know because someone would see or hear…"
              className="form-input w-full mt-2 text-sm" />
          </div>
        ))}
      </div>

      {selected.length < CAP ? (
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(draft); }}
            placeholder="Add or confirm a behaviour…" className="form-input flex-1 text-sm" />
          <button type="button" onClick={() => add(draft)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: "13px" }}>Add</button>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-grey)]">Cap reached (max {CAP}). Remove one to swap.</p>
      )}
    </div>
  );
}

// ── M4 Reinforcement & accountability ────────────────────────────────────
function ReinforcementMovement({ session, patch }: {
  session: WorkshopSession; patch: (u: Partial<WorkshopSession>) => void;
}) {
  const cap = session.capture_sheet ?? {};
  const [local, setLocal] = useState<CaptureSheet>(cap);
  function save(next: CaptureSheet) { setLocal(next); patch({ capture_sheet: next }); }
  function suggest(field: keyof typeof CAPTURE_SUGGESTIONS) {
    const opts = CAPTURE_SUGGESTIONS[field];
    const cur = local[field] ?? "";
    const idx = opts.findIndex((o) => o === cur);
    save({ ...local, [field]: opts[(idx + 1) % opts.length] });
  }
  return (
    <div className="card" style={{ padding: "24px 26px" }}>
      <MovementHeader id="reinforcement" />
      <p className="text-sm text-[var(--color-grey)] mt-3 mb-4">
        Facilitator-led, not an open brainstorm. Walk the three mechanisms; the team owns the choice and the adaptation.
      </p>
      <div className="space-y-3 mb-6">
        {REINFORCEMENT_LIBRARY.map((mech) => (
          <details key={mech.key} className="rounded-lg border border-black/10 px-4 py-3">
            <summary className="text-sm font-medium cursor-pointer">{mech.title}</summary>
            <p className="text-sm text-[var(--color-grey)] mt-2">{mech.blurb}</p>
            <ul className="mt-2 space-y-1">
              {mech.options.map((o, i) => <li key={i} className="text-sm text-[var(--color-ink)]">· {o}</li>)}
            </ul>
          </details>
        ))}
      </div>
      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">Capture sheet — type as the team talks</p>
      <CaptureField label="When someone slips, we will…" field="when_someone_slips"
        value={local.when_someone_slips ?? ""} onSave={(v) => save({ ...local, when_someone_slips: v })}
        onSuggest={() => suggest("when_someone_slips")} />
      <CaptureField label="We'll check how we're doing…" field="check_trigger"
        value={local.check_trigger ?? ""} onSave={(v) => save({ ...local, check_trigger: v })}
        onSuggest={() => suggest("check_trigger")} />
      <CaptureField label="When someone does it well, we'll…" field="when_done_well"
        value={local.when_done_well ?? ""} onSave={(v) => save({ ...local, when_done_well: v })}
        onSuggest={() => suggest("when_done_well")} />
      <CaptureField label="Anything else we're agreeing to?" field="anything_else"
        value={local.anything_else ?? ""} onSave={(v) => save({ ...local, anything_else: v })} />
    </div>
  );
}

function CaptureField({ label, value, onSave, onSuggest }: {
  label: string; field: string; value: string; onSave: (v: string) => void; onSuggest?: () => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-[var(--color-grey)]">{label}</label>
        {onSuggest && (
          <button type="button" onClick={onSuggest} className="text-xs text-[var(--color-purple)] hover:underline">Suggest options</button>
        )}
      </div>
      <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} className="form-input w-full text-sm" />
    </div>
  );
}

// ── M5 The agreement & commitment ────────────────────────────────────────
function AgreementMovement({ session, patch, draft, setDraft, assemble, onLock, busy }: {
  session: WorkshopSession;
  patch: (u: Partial<WorkshopSession>) => void;
  draft: string;
  setDraft: (s: string) => void;
  assemble: () => void;
  onLock: () => void;
  busy: boolean;
}) {
  useEffect(() => { if (!draft) assemble(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card" style={{ padding: "24px 26px" }}>
      <MovementHeader id="agreement" />
      <div className="flex items-center justify-between mt-3 mb-2">
        <p className="text-sm text-[var(--color-grey)]">Read it aloud. The team edits; you hold the pen. Never a blank page.</p>
        <button type="button" onClick={assemble} className="text-xs text-[var(--color-purple)] hover:underline">Re-assemble from movements</button>
      </div>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12}
        className="form-input w-full text-sm font-mono leading-relaxed" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <div>
          <label className="block text-xs text-[var(--color-grey)] mb-1">Revisit date (Otis comes back on)</label>
          <input type="date" value={session.revisit_date ?? ""}
            onChange={(e) => patch({ revisit_date: e.target.value || null })}
            className="form-input w-full text-sm" />
        </div>
      </div>

      <div className="rounded-xl bg-[var(--color-navy)]/5 px-5 py-4 mt-5">
        <p className="text-sm font-medium">Fist-of-five — the commitment gate</p>
        <p className="text-sm text-[var(--color-grey)] mt-1">
          Run it before locking: &ldquo;On three, one to five fingers. Anything below three — I want to hear from you.&rdquo;
          Adjust the text above until everyone is at three or above, then lock.
        </p>
      </div>

      <button type="button" onClick={onLock} disabled={busy || !draft.trim()} className="btn-primary mt-5">
        {busy ? "Locking…" : "Lock the agreement"}
      </button>
    </div>
  );
}

function ClosedCard({ version, teamName }: { version?: number; teamName: string }) {
  return (
    <div className="card text-center" style={{ padding: "48px 32px" }}>
      <h2 className="text-2xl mb-3" style={{ fontFamily: "Playfair Display, serif" }}>Agreement locked ✓</h2>
      <p className="text-sm text-[var(--color-grey)] max-w-md mx-auto">
        {teamName}&apos;s Team Behaviour Agreement{version ? ` (v${version})` : ""} is saved and now appears in every member&apos;s
        profile. The revisit date is scheduled — Otis will come back to check how it&apos;s going.
      </p>
    </div>
  );
}

function MovementHeader({ id }: { id: MovementId }) {
  const m = MOVEMENTS.find((x) => x.id === id)!;
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-xl" style={{ fontFamily: "Playfair Display, serif" }}>{m.label}</h3>
      <span className="text-xs text-[var(--color-grey)]">~{m.minutes} min · {m.member_title}</span>
    </div>
  );
}
