"use client";

import { useEffect, useState } from "react";
import type { MemberBehavior, BehaviorBucket } from "@/types/database";
import { ITEM_EXAMPLES } from "@/lib/itemExamples";

const BUCKET_LABEL: Record<BehaviorBucket, string> = {
  never: "NEVER",
  sometimes: "SOMETIMES",
  always: "ALWAYS",
};

const BUCKET_HINT: Record<BehaviorBucket, string> = {
  never: "Things that shut down safety — should never happen",
  sometimes: "Things that are helpful in some situations, harmful in others",
  always: "Things that build safety — should always happen",
};

const BUCKET_COLOR: Record<BehaviorBucket, string> = {
  never: "var(--color-amber)",
  sometimes: "var(--color-grey)",
  always: "var(--color-navy)",
};

type Props = {
  memberId: string;
  teamId: string;
  statementId: number | null;
  statementText?: string;
  actionPhrase?: string;
  onNudge: (nudge: string) => void;
  onSubmit: () => void;
};

export default function Phase3Board({ memberId, teamId, statementId, statementText, actionPhrase, onNudge, onSubmit }: Props) {
  const [behaviors, setBehaviors] = useState<MemberBehavior[]>([]);
  const [drafts, setDrafts] = useState<Record<BehaviorBucket, string>>({ never: "", sometimes: "", always: "" });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function loadBehaviors() {
      const res = await fetch(`/api/phase3/behaviors?member_id=${memberId}&team_id=${teamId}`);
      if (!res.ok) { setLoadError(true); return; }
      const data = await res.json();
      setBehaviors(data.behaviors ?? []);
    }
    void loadBehaviors();
  }, [memberId, teamId]);

  const [saving, setSaving] = useState<BehaviorBucket | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track which entries have had a nudge shown (so we know the next submit is force_save).
  const [pendingForceSave, setPendingForceSave] = useState<Record<BehaviorBucket, boolean>>({
    never: false, sometimes: false, always: false,
  });

  const neverCount = behaviors.filter((b) => b.bucket === "never").length;
  const alwaysCount = behaviors.filter((b) => b.bucket === "always").length;
  const canSubmit = neverCount >= 2 && alwaysCount >= 2;

  async function addBehavior(bucket: BehaviorBucket) {
    const text = drafts[bucket].trim();
    if (!text) return;
    setSaving(bucket);
    setError(null);

    const nudgeDismissed = pendingForceSave[bucket];

    const res = await fetch("/api/phase3/behaviors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        team_id: teamId,
        statement_id: statementId,
        bucket,
        text,
        nudge_dismissed: nudgeDismissed,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(null);

    if (!res.ok) {
      if (data?.error === "db_error") {
        console.error("[phase3/behaviors] DB error:", data.detail);
      }
      setError("Something went wrong. Please try again.");
      return;
    }

    if (!data.saved && data.coaching_nudge) {
      // Nudge — Otis speaks; next submit will be force_save.
      onNudge(data.coaching_nudge);
      setPendingForceSave((prev) => ({ ...prev, [bucket]: true }));
      return;
    }

    // Saved — clear the draft and the pending force-save flag.
    setBehaviors((prev) => [...prev, data.behavior as MemberBehavior]);
    setDrafts((prev) => ({ ...prev, [bucket]: "" }));
    setPendingForceSave((prev) => ({ ...prev, [bucket]: false }));
  }

  function removeBehavior(id: string) {
    setBehaviors((prev) => prev.filter((b) => b.id !== id));
    // Fire-and-forget delete (member-side, no UX blocker).
    void fetch(`/api/phase3/behaviors?id=${id}&member_id=${memberId}`, { method: "DELETE" });
  }

  const examples = statementId ? (ITEM_EXAMPLES[statementId] ?? null) : null;

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="text-sm text-[var(--color-amber)]">
          Could not load your saved behaviors. Check your connection and refresh to try again.
        </p>
      )}

      {/* Standing reminders */}
      <div className="space-y-1">
        {statementText && (
          <p className="text-xs text-[var(--color-grey)]">
            <span className="font-medium text-[var(--color-ink)]">Focus:</span> {statementText}
          </p>
        )}
        <p className="text-xs text-[var(--color-grey)]">
          A behaviour is something you can see or hear on your team.
        </p>
      </div>

      {/* Collapsed examples expander */}
      {examples && (
        <details className="rounded-xl border border-black/10 overflow-hidden">
          <summary className="px-4 py-2.5 text-xs font-medium text-[var(--color-grey)] cursor-pointer hover:bg-black/3 select-none">
            See examples {actionPhrase ? `for "${actionPhrase}"` : ""}
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-4 pt-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-navy)] mb-1.5">ALWAYS</p>
              <ul className="space-y-1">
                {examples.always.map((ex) => <li key={ex} className="text-xs leading-snug text-[var(--color-ink)]">· {ex}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-amber)] mb-1.5">NEVER</p>
              <ul className="space-y-1">
                {examples.never.map((ex) => <li key={ex} className="text-xs leading-snug text-[var(--color-ink)]">· {ex}</li>)}
              </ul>
            </div>
          </div>
        </details>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["never", "sometimes", "always"] as BehaviorBucket[]).map((bucket) => {
          const items = behaviors.filter((b) => b.bucket === bucket);
          return (
            <div key={bucket} className="card flex flex-col gap-3" style={{ padding: "18px 20px" }}>
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                  style={{ color: BUCKET_COLOR[bucket] }}
                >
                  {BUCKET_LABEL[bucket]}
                </p>
                <p className="text-xs text-[var(--color-grey)]">{BUCKET_HINT[bucket]}</p>
              </div>

              {items.length > 0 && (
                <ul className="space-y-1.5">
                  {items.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
                      style={{ background: "rgba(0,0,0,0.04)" }}
                    >
                      <span className="flex-1 leading-snug">{b.text}</span>
                      {b.flagged && (
                        <span
                          title="You chose to keep this entry after Otis's suggestion"
                          className="text-[10px] text-[var(--color-amber)] mt-0.5 flex-shrink-0"
                        >
                          ●
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeBehavior(b.id)}
                        className="text-[var(--color-grey)] hover:text-red-600 text-xs mt-0.5 flex-shrink-0"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 mt-auto">
                <input
                  value={drafts[bucket]}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [bucket]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void addBehavior(bucket);
                    }
                  }}
                  placeholder="Add a behavior…"
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

      <div className="flex items-center justify-between pt-4 border-t border-black/10">
        <p className="text-sm text-[var(--color-grey)]">
          {canSubmit
            ? "You're ready. Click Done when you've finished."
            : `Add at least 2 NEVER and 2 ALWAYS entries to continue. (${neverCount} / 2 NEVER, ${alwaysCount} / 2 ALWAYS)`}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="btn-primary"
        >
          Done
        </button>
      </div>
    </div>
  );
}
