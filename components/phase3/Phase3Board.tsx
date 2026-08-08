"use client";

import { useEffect, useRef, useState } from "react";
import type { MemberBehavior, BehaviorBucket } from "@/types/database";
import { ITEM_EXAMPLES } from "@/lib/itemExamples";
import { speakText, cancelSpeech } from "@/lib/speech";

// Read-aloud-aware wrapper: speaks on mount when `auto` + read-aloud, and is
// always clickable to (re)read. Used so every box on the board can be heard.
function Speakable({
  readAloud, text, auto = false, className, style, children,
}: {
  readAloud: boolean; text: string; auto?: boolean;
  className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const spoken = useRef(false);
  useEffect(() => {
    if (!readAloud || !text || !auto) { spoken.current = false; return; }
    if (spoken.current) return;
    spoken.current = true;
    speakText(text);
  }, [readAloud, text, auto]);
  return (
    <div
      className={`${className ?? ""} ${readAloud ? "cursor-pointer hover:ring-1 hover:ring-[var(--color-purple)]/30 transition-all" : ""}`}
      style={style}
      onClick={readAloud ? () => { cancelSpeech(); speakText(text); } : undefined}
      title={readAloud ? "Click to replay" : undefined}
    >
      {children}
    </div>
  );
}

// Column order + semantic colours (post-rework):
//   ALWAYS = green, SOMETIMES = yellow, NEVER = red.
const BUCKET_ORDER: BehaviorBucket[] = ["always", "sometimes", "never"];

const BUCKET_LABEL: Record<BehaviorBucket, string> = {
  always: "ALWAYS",
  sometimes: "SOMETIMES",
  never: "NEVER",
};

const BUCKET_HINT: Record<BehaviorBucket, string> = {
  always: "Things that support this goal",
  sometimes: "Things that should be approached cautiously",
  never: "Things that harm this goal",
};

const BUCKET_COLOR: Record<BehaviorBucket, string> = {
  always: "#2D7A4F", // green
  sometimes: "#C4860A", // yellow/amber
  never: "#B94040", // red
};

type Props = {
  memberId: string;
  teamId: string;
  statementId: number | null;
  // "a place where people can ___" phrasing for the focus bubble.
  placePhrase?: string;
  readAloud?: boolean;
  onSubmit: () => void;
};

export default function Phase3Board({ memberId, teamId, statementId, placePhrase, readAloud = false, onSubmit }: Props) {
  const [behaviors, setBehaviors] = useState<MemberBehavior[]>([]);
  const [drafts, setDrafts] = useState<Record<BehaviorBucket, string>>({ never: "", sometimes: "", always: "" });
  const [saving, setSaving] = useState<BehaviorBucket | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Attention director for the "please add" bubble when the gate blocks Done.
  const gateRef = useRef<HTMLDivElement | null>(null);
  const [gateFlash, setGateFlash] = useState(false);

  useEffect(() => {
    async function loadBehaviors() {
      const res = await fetch(`/api/phase3/behaviors?member_id=${memberId}&team_id=${teamId}`);
      if (!res.ok) { setLoadError(true); return; }
      const data = await res.json();
      setBehaviors(data.behaviors ?? []);
    }
    void loadBehaviors();
  }, [memberId, teamId]);

  const neverCount = behaviors.filter((b) => b.bucket === "never").length;
  const alwaysCount = behaviors.filter((b) => b.bucket === "always").length;
  const canSubmit = neverCount >= 2 && alwaysCount >= 2;

  // Number the flagged entries so a chip's badge maps to a bottom warning.
  const flagged = behaviors.filter((b) => b.nudge_text);
  const warningNumber = new Map<string, number>();
  flagged.forEach((b, i) => warningNumber.set(b.id, i + 1));

  async function addBehavior(bucket: BehaviorBucket) {
    const text = drafts[bucket].trim();
    if (!text) return;
    setSaving(bucket);
    setError(null);

    const res = await fetch("/api/phase3/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, team_id: teamId, statement_id: statementId, bucket, text }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(null);

    if (!res.ok) {
      if (data?.error === "db_error") console.error("[phase3/behaviors] DB error:", data.detail);
      setError("Something went wrong. Please try again.");
      return;
    }
    // Always saved now (warning, if any, rides along on the row as nudge_text).
    setBehaviors((prev) => [...prev, data.behavior as MemberBehavior]);
    setDrafts((prev) => ({ ...prev, [bucket]: "" }));
  }

  function startEdit(b: MemberBehavior) {
    setEditingId(b.id);
    setEditingText(b.text);
  }

  async function saveEdit(b: MemberBehavior) {
    const text = editingText.trim();
    if (!text) { setEditingId(null); return; }
    if (text === b.text) { setEditingId(null); return; }
    setEditSaving(true);
    const res = await fetch("/api/phase3/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId, team_id: teamId, statement_id: statementId,
        bucket: b.bucket, text, behavior_id: b.id,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setEditSaving(false);
    setEditingId(null);
    if (res.ok && data.behavior) {
      setBehaviors((prev) => prev.map((x) => (x.id === b.id ? (data.behavior as MemberBehavior) : x)));
    }
  }

  function removeBehavior(id: string) {
    setBehaviors((prev) => prev.filter((b) => b.id !== id));
    void fetch(`/api/phase3/behaviors?id=${id}&member_id=${memberId}`, { method: "DELETE" });
  }

  function handleDone() {
    if (!canSubmit) {
      setGateFlash(true);
      gateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => setGateFlash(false), 2500);
      return;
    }
    onSubmit();
  }

  const examples = statementId ? (ITEM_EXAMPLES[statementId] ?? null) : null;

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="text-sm text-[var(--color-amber)]">
          Could not load your saved behaviors. Check your connection and refresh to try again.
        </p>
      )}

      {/* Focus bubble */}
      <Speakable
        readAloud={readAloud}
        auto
        text={`Your team's focus is to contribute ideas towards a Team Agreement, that specifies behaviours your team would ALWAYS and NEVER want to see if the goal is to make your team ${placePhrase ? `a place where ${placePhrase}` : "a safer place to work"}. Feel free to add SOMETIMES behaviours if they are worth discussing.`}
        className="rounded-2xl border border-black/10 bg-white px-6 py-5"
      >
        <p className="text-lg leading-relaxed">
          Your team&apos;s focus is to contribute ideas towards a Team Agreement, that specifies behaviours your team
          would <strong style={{ color: BUCKET_COLOR.always }}>ALWAYS</strong> and{" "}
          <strong style={{ color: BUCKET_COLOR.never }}>NEVER</strong> want to see if the goal is to make your team{" "}
          {placePhrase ? <>a place where <strong>{placePhrase}</strong></> : <>a safer place to work</>}. Feel free to
          add <strong style={{ color: BUCKET_COLOR.sometimes }}>SOMETIMES</strong> behaviours if they are worth discussing.
        </p>
      </Speakable>

      {/* Orange "please add" bubble — also the attention director for the gate */}
      <Speakable
        readAloud={readAloud}
        auto
        text="Please add at least two ALWAYS and two NEVER behaviours."
        className={`rounded-2xl border px-6 py-4 transition-all ${gateFlash ? "ring-2 ring-[#C4860A]" : ""}`}
        style={{ borderColor: "rgba(196,134,10,0.35)", background: "rgba(196,134,10,0.08)" }}
      >
        <div ref={gateRef}>
          <p className="text-xl font-medium" style={{ fontFamily: "Playfair Display, serif", color: "#8A5B06" }}>
            Please add at least two ALWAYS and two NEVER behaviours.
          </p>
          {gateFlash && (
            <p className="text-base mt-1" style={{ color: "#8A5B06" }}>
              You need {Math.max(0, 2 - alwaysCount)} more ALWAYS and {Math.max(0, 2 - neverCount)} more NEVER to continue.
            </p>
          )}
        </div>
      </Speakable>

      {/* Behavior examples — retitled, larger, clickable look */}
      {examples && (
        <details className="group rounded-xl border-2 border-black/15 bg-white overflow-hidden hover:border-black/30 transition-colors">
          <summary className="flex items-center justify-between px-5 py-3.5 text-base font-medium text-[var(--color-ink)] cursor-pointer select-none">
            See Behaviour Examples
            <span className="text-[var(--color-grey)] transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 pb-5 pt-1">
            <Speakable readAloud={readAloud} text={`Always examples. ${examples.always.join(". ")}.`}>
              <p className="text-base font-semibold uppercase tracking-widest mb-1.5" style={{ color: BUCKET_COLOR.always }}>ALWAYS</p>
              <ul className="space-y-1.5">
                {examples.always.map((ex) => <li key={ex} className="text-base leading-relaxed text-[var(--color-ink)]">· {ex}</li>)}
              </ul>
            </Speakable>
            <Speakable readAloud={readAloud} text={`Never examples. ${examples.never.join(". ")}.`}>
              <p className="text-base font-semibold uppercase tracking-widest mb-1.5" style={{ color: BUCKET_COLOR.never }}>NEVER</p>
              <ul className="space-y-1.5">
                {examples.never.map((ex) => <li key={ex} className="text-base leading-relaxed text-[var(--color-ink)]">· {ex}</li>)}
              </ul>
            </Speakable>
          </div>
        </details>
      )}

      {/* Columns: ALWAYS · SOMETIMES · NEVER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BUCKET_ORDER.map((bucket) => {
          const items = behaviors.filter((b) => b.bucket === bucket);
          const color = BUCKET_COLOR[bucket];
          return (
            <div key={bucket} className="card flex flex-col gap-3" style={{ padding: "18px 20px" }}>
              <Speakable readAloud={readAloud} text={`${BUCKET_LABEL[bucket]}. ${BUCKET_HINT[bucket]}.`}>
                <p className="text-sm font-semibold uppercase tracking-widest mb-0.5" style={{ color }}>
                  {BUCKET_LABEL[bucket]}
                </p>
                <p className="text-sm text-[var(--color-grey)]">{BUCKET_HINT[bucket]}</p>
              </Speakable>

              {items.length > 0 && (
                <ul className="space-y-1.5">
                  {items.map((b) => {
                    const num = warningNumber.get(b.id);
                    const isEditing = editingId === b.id;
                    return (
                      <li
                        key={b.id}
                        className="rounded-lg px-3 py-2 text-sm"
                        // White box; only the member's own submission is tinged.
                        style={{ background: `${color}14`, border: `1px solid ${color}40` }}
                      >
                        <div className="flex items-start gap-2">
                          {num && (
                            <span
                              className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                              style={{ background: "#B94040" }}
                              title="Otis has a suggestion for this entry — see below"
                            >
                              {num}
                            </span>
                          )}
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveEdit(b); } if (e.key === "Escape") setEditingId(null); }}
                              onBlur={() => void saveEdit(b)}
                              disabled={editSaving}
                              className="form-input flex-1 text-sm py-1"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(b)}
                              className="flex-1 text-left leading-snug hover:underline decoration-dotted"
                              title="Click to edit"
                            >
                              {b.text}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeBehavior(b.id)}
                            className="text-[var(--color-grey)] hover:text-red-600 text-xs mt-0.5 flex-shrink-0"
                            aria-label="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex gap-2 mt-auto">
                <input
                  value={drafts[bucket]}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [bucket]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void addBehavior(bucket); } }}
                  placeholder="Add a behaviour…"
                  className="form-input flex-1 text-sm"
                  disabled={saving === bucket}
                />
                <button
                  type="button"
                  onClick={() => void addBehavior(bucket)}
                  disabled={saving === bucket || !drafts[bucket].trim()}
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "13px" }}
                >
                  {saving === bucket ? "…" : "Add"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Otis warnings — numbered, orange, small Otis. Persist until resolved. */}
      {flagged.length > 0 && (
        <Speakable
          readAloud={readAloud}
          auto
          text={`Otis says. ${flagged.map((b) => `${warningNumber.get(b.id)}. ${b.nudge_text}`).join(" ")}`}
          className="rounded-2xl border px-5 py-4 flex items-start gap-3"
          style={{ borderColor: "rgba(196,134,10,0.4)", background: "rgba(196,134,10,0.1)" }}
        >
          <img src="/octopus-logo.png" alt="" className="h-10 w-10 rounded flex-shrink-0 object-cover" />
          <div className="flex-1">
            <p className="text-base uppercase tracking-widest mb-2.5 font-semibold" style={{ color: "#8A5B06" }}>Otis says</p>
            <ul className="space-y-3">
              {flagged.map((b) => (
                <li key={b.id} className="flex items-start gap-2.5 text-lg leading-relaxed" style={{ fontFamily: "Playfair Display, serif" }}>
                  <span
                    className="flex-shrink-0 mt-1 h-6 w-6 rounded-full text-white text-sm font-semibold flex items-center justify-center"
                    style={{ background: "#B94040" }}
                  >
                    {warningNumber.get(b.id)}
                  </span>
                  <span>{b.nudge_text}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-[var(--color-grey)] mt-3">
              You don&apos;t have to change these — click any entry above to edit it, and the note clears when it&apos;s resolved.
            </p>
          </div>
        </Speakable>
      )}

      <div className="flex items-center justify-end pt-4 border-t border-black/10">
        <button type="button" onClick={handleDone} className="btn-primary">
          Done
        </button>
      </div>
    </div>
  );
}
