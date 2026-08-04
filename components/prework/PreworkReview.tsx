"use client";

// Phase 3 §3.5 — Consultant pre-release review (pivot rebuild).
// Reads member_behaviors + member_stories for the team. Consultant can edit
// or delete entries, add their own, and release to workshop_seed for Phase 4.
// "Sometimes" bucket entries are visible for context but excluded from the
// workshop seed by default (Never + Always only go to the pool).

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type {
  MemberBehavior,
  MemberStory,
  SeedBehaviour,
  WorkshopSeed,
} from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";
import { ZONE_BADGE, ZONE_SHORT } from "@/components/dashboard/types";

type Props = {
  teamId: string;
  tier1: Tier1Result;
  tier2: Tier2Result | null;
};

type MemberGroup = {
  member_id: string;
  behaviors: MemberBehavior[];
  story: MemberStory | null;
};

export default function PreworkReview({ teamId, tier1, tier2 }: Props) {
  const [supabase] = useState(() => createBrowserClient());
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [seed, setSeed] = useState<WorkshopSeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);

  const focus = tier2?.focus_hypothesis;
  const statementId = focus?.statement_id ?? null;
  const statementTextById = new Map<number, string>(
    (tier1.ps_statements ?? []).map((s) => [s.statement_id, s.statement_text])
  );
  const zoneById = new Map<number, number>(
    (tier1.ps_statements ?? []).map((s) => [s.statement_id, s.zone])
  );
  const zone = statementId ? zoneById.get(statementId) ?? null : null;
  const itemText = statementId ? statementTextById.get(statementId) ?? focus?.statement_text ?? `Item ${statementId}` : "—";

  useEffect(() => { void load(); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const [behaviorsRes, storiesRes, seedRes] = await Promise.all([
      supabase.from("member_behaviors").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
      supabase.from("member_stories").select("*").eq("team_id", teamId),
      supabase.from("workshop_seed").select("*").eq("team_id", teamId).maybeSingle(),
    ]);

    const behaviors: MemberBehavior[] = (behaviorsRes.data ?? []) as MemberBehavior[];
    const stories: MemberStory[] = (storiesRes.data ?? []) as MemberStory[];
    setSeed((seedRes.data as WorkshopSeed) ?? null);

    // Group by member_id.
    const memberIds = Array.from(new Set(behaviors.map((b) => b.member_id)));
    setGroups(
      memberIds.map((mid) => ({
        member_id: mid,
        behaviors: behaviors.filter((b) => b.member_id === mid),
        story: stories.find((s) => s.member_id === mid) ?? null,
      }))
    );
    setLoading(false);
  }

  async function updateBehavior(id: string, update: Partial<MemberBehavior>) {
    const { error } = await supabase
      .from("member_behaviors")
      .update({ ...update, source: "consultant", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { setErr(error.message); return; }
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        behaviors: g.behaviors.map((b) => b.id === id ? { ...b, ...update, source: "consultant" } as MemberBehavior : b),
      }))
    );
  }

  async function deleteBehavior(id: string) {
    const { error } = await supabase.from("member_behaviors").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    setGroups((prev) =>
      prev.map((g) => ({ ...g, behaviors: g.behaviors.filter((b) => b.id !== id) }))
    );
  }

  async function addBehaviorManually(memberId: string, bucket: "never" | "always", text: string) {
    const { data, error } = await supabase
      .from("member_behaviors")
      .insert({
        member_id: memberId,
        team_id: teamId,
        statement_id: statementId,
        bucket,
        text,
        source: "consultant",
        flagged: false,
      })
      .select()
      .single();
    if (error) { setErr(error.message); return; }
    setGroups((prev) =>
      prev.map((g) =>
        g.member_id === memberId
          ? { ...g, behaviors: [...g.behaviors, data as MemberBehavior] }
          : g
      )
    );
  }

  async function runTagger() {
    setTagging(true);
    await fetch("/api/phase3/tagger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId }),
    });
    await load();
    setTagging(false);
  }

  async function release() {
    if (!statementId) { setErr("No focus item — run Otis's read first."); return; }
    setBusy(true); setErr(null);

    // Collect all member behaviors that are Never or Always (not Sometimes).
    const allBehaviors = groups.flatMap((g) => g.behaviors);
    const seedBehaviors: SeedBehaviour[] = allBehaviors
      .filter((b) => b.bucket === "never" || b.bucket === "always")
      .map((b) => ({
        id: b.id,
        text: b.text,
        kind: b.bucket as "never" | "always",
        provenance: b.source === "consultant" ? "consultant" : "member",
        source_statement_id: b.statement_id,
        original_text: null,
      }));

    if (!seedBehaviors.some((b) => b.kind === "never") || !seedBehaviors.some((b) => b.kind === "always")) {
      setErr("Add at least one NEVER and one ALWAYS behavior before releasing.");
      setBusy(false);
      return;
    }

    const now = new Date().toISOString();
    const seedPayload = {
      team_id: teamId,
      statement_id: statementId,
      zone: zone,
      focus_hypothesis: focus?.hypothesis ?? null,
      behaviours: seedBehaviors,
      released_at: now,
      is_current: true,
      updated_at: now,
    };

    if (seed) {
      const { data, error } = await supabase
        .from("workshop_seed")
        .update(seedPayload)
        .eq("id", seed.id)
        .select()
        .single();
      if (error) { setErr(error.message); setBusy(false); return; }
      setSeed(data as WorkshopSeed);
    } else {
      const { data, error } = await supabase
        .from("workshop_seed")
        .insert(seedPayload)
        .select()
        .single();
      if (error) { setErr(error.message); setBusy(false); return; }
      setSeed(data as WorkshopSeed);
    }

    setBusy(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="max-w-6xl mx-auto px-6 py-16 text-[var(--color-grey)]">Loading…</div>;
  }

  const released = !!seed?.released_at;
  const hasSubmissions = groups.some((g) => g.behaviors.length > 0 || g.story);
  const allStories = groups.filter((g) => g.story);
  const tagSummary = allStories.length > 0 ? summariseTags(allStories.map((g) => g.story!)) : null;
  const flaggedCount = groups.flatMap((g) => g.behaviors).filter((b) => b.flagged).length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: "Playfair Display, serif" }}>Pre-work review</h1>
          <p className="text-sm text-[var(--color-grey)] mt-1 max-w-2xl">
            Review what members submitted before publishing to the workshop pool. You can edit or delete any entry.
          </p>
        </div>
        {released && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
            Published {new Date(seed!.released_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Placeholder — shown until members have submitted */}
      {!hasSubmissions && (
        <div className="card text-center" style={{ padding: "40px 32px" }}>
          <p className="text-sm text-[var(--color-grey)] max-w-md mx-auto">
            Pre-work review will appear here once members complete the Phase 3 activity.
          </p>
        </div>
      )}

      {hasSubmissions && (
        <>
          {/* Focus item */}
          {focus?.statement_id && (
            <div className="card" style={{ padding: "18px 24px" }}>
              <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-1">Focus item</p>
              <div className="flex items-center gap-2">
                {zone ? <span className={ZONE_BADGE[zone] ?? ""}>{ZONE_SHORT[zone] ?? `Zone ${zone}`}</span> : null}
                <p className="text-base font-medium">{itemText}</p>
              </div>
              {focus.hypothesis && (
                <p className="text-sm text-[var(--color-grey)] mt-2">{focus.hypothesis}</p>
              )}
            </div>
          )}

          {/* Situation-tag summary */}
          {tagSummary && (
            <div className="card" style={{ padding: "14px 20px" }}>
              <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">
                Stories — situation context ({allStories.length} members)
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(tagSummary).map(([tag, count]) => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-black/6 text-[var(--color-ink)]">
                    {TAG_LABEL[tag] ?? tag} · {count}
                  </span>
                ))}
              </div>
              {allStories.some((g) => !g.story?.situation_tag) && (
                <button
                  type="button"
                  onClick={() => void runTagger()}
                  disabled={tagging}
                  className="mt-3 text-xs text-[var(--color-purple)] hover:underline"
                >
                  {tagging ? "Tagging…" : "Tag untagged stories"}
                </button>
              )}
            </div>
          )}

          {/* Flagged entries banner */}
          {flaggedCount > 0 && (
            <div className="rounded-xl border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/6 px-5 py-3">
              <p className="text-sm text-amber-800">
                {flaggedCount} entr{flaggedCount === 1 ? "y was" : "ies were"} flagged — Otis suggested a revision but the member chose to keep their original wording. Review and edit before publishing if needed.
              </p>
            </div>
          )}

          {/* Per-member cards */}
          {groups.map((group, i) => (
            <MemberCard
              key={group.member_id}
              group={group}
              memberLabel={`Member ${String.fromCharCode(65 + i)}`}
              onUpdate={updateBehavior}
              onDelete={deleteBehavior}
              onAdd={addBehaviorManually}
              busy={busy}
            />
          ))}

          {/* Publish action */}
          <div className="flex items-center justify-between pt-4 border-t border-black/10">
            <p className="text-xs text-[var(--color-grey)]">
              {busy ? "Saving…"
                : released
                  ? "Published. Re-publishing updates what the workshop pool shows."
                  : "Draft — workshop facilitator sees nothing until you publish."}
            </p>
            <button
              type="button"
              onClick={() => void release()}
              disabled={busy}
              className="btn-primary"
            >
              {released ? "Re-publish to workshop" : "Publish to workshop"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Member card ────────────────────────────────────────────────────────────────
function MemberCard({
  group,
  memberLabel,
  onUpdate,
  onDelete,
  onAdd,
  busy,
}: {
  group: MemberGroup;
  memberLabel: string;
  onUpdate: (id: string, update: Partial<MemberBehavior>) => void;
  onDelete: (id: string) => void;
  onAdd: (memberId: string, bucket: "never" | "always", text: string) => void;
  busy: boolean;
}) {
  const [addDraft, setAddDraft] = useState<{ bucket: "never" | "always"; text: string } | null>(null);
  const never = group.behaviors.filter((b) => b.bucket === "never");
  const sometimes = group.behaviors.filter((b) => b.bucket === "sometimes");
  const always = group.behaviors.filter((b) => b.bucket === "always");

  return (
    <div className="card space-y-4" style={{ padding: "20px 24px" }}>
      <div className="flex items-center gap-3">
        <span className="bg-[var(--color-navy)] text-white text-xs px-3 py-1 rounded-full">
          {memberLabel}
        </span>
        {group.story && (
          <span className="text-xs text-[var(--color-grey)]">
            Story{group.story.situation_tag ? ` · ${TAG_LABEL[group.story.situation_tag] ?? group.story.situation_tag}` : ""}
          </span>
        )}
      </div>

      {group.story && (
        <details className="text-sm">
          <summary className="text-xs text-[var(--color-grey)] cursor-pointer select-none">
            View story ▸
          </summary>
          <p className="mt-2 text-[var(--color-grey)] leading-relaxed pl-4 border-l border-black/10">
            {group.story.story_text}
          </p>
        </details>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BucketSection title="NEVER" behaviors={never} onUpdate={onUpdate} onDelete={onDelete} busy={busy} />
        <BucketSection title="SOMETIMES" behaviors={sometimes} onUpdate={onUpdate} onDelete={onDelete} busy={busy}
          note="Not included in the workshop pool by default." />
        <BucketSection title="ALWAYS" behaviors={always} onUpdate={onUpdate} onDelete={onDelete} busy={busy} />
      </div>

      {/* Add manually */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-[var(--color-grey)]">Add for this member:</span>
        {(["never", "always"] as const).map((bucket) => (
          <button key={bucket} type="button"
            onClick={() => setAddDraft({ bucket, text: "" })}
            className="text-xs text-[var(--color-purple)] hover:underline uppercase">
            + {bucket}
          </button>
        ))}
      </div>

      {addDraft && (
        <div className="flex gap-2">
          <input
            value={addDraft.text}
            onChange={(e) => setAddDraft((d) => d ? { ...d, text: e.target.value } : null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && addDraft.text.trim()) {
                onAdd(group.member_id, addDraft.bucket, addDraft.text.trim());
                setAddDraft(null);
              }
            }}
            autoFocus
            placeholder={`Add a ${addDraft.bucket.toUpperCase()} behavior…`}
            className="form-input flex-1 text-sm"
          />
          <button type="button"
            onClick={() => { if (addDraft.text.trim()) { onAdd(group.member_id, addDraft.bucket, addDraft.text.trim()); setAddDraft(null); } }}
            className="btn-secondary" style={{ padding: "6px 14px", fontSize: "13px" }}>
            Add
          </button>
          <button type="button" onClick={() => setAddDraft(null)}
            className="text-xs text-[var(--color-grey)] hover:text-red-600">Cancel</button>
        </div>
      )}
    </div>
  );
}

function BucketSection({
  title, behaviors, onUpdate, onDelete, busy, note,
}: {
  title: string;
  behaviors: MemberBehavior[];
  onUpdate: (id: string, update: Partial<MemberBehavior>) => void;
  onDelete: (id: string) => void;
  busy: boolean;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-grey)]">{title}</p>
      {note && <p className="text-[10px] text-[var(--color-grey)] italic">{note}</p>}
      {behaviors.length === 0 && <p className="text-xs text-[var(--color-grey)] italic">None</p>}
      {behaviors.map((b) => (
        <BehaviorRow key={b.id} behavior={b} onUpdate={onUpdate} onDelete={onDelete} busy={busy} />
      ))}
    </div>
  );
}

function BehaviorRow({
  behavior: b, onUpdate, onDelete, busy,
}: {
  behavior: MemberBehavior;
  onUpdate: (id: string, update: Partial<MemberBehavior>) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(b.text);
  // Delete protection (spec §5): deleting a member behaviour is too easy to do
  // by accident, so require an explicit confirm step before it fires.
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="rounded-lg border border-black/8 px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        {b.flagged && (
          <span title="Member kept this after Otis's suggestion" className="text-[var(--color-amber)] mt-0.5 flex-shrink-0 text-xs">●</span>
        )}
        <input
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onBlur={() => { if (editing.trim() && editing !== b.text) onUpdate(b.id, { text: editing.trim() }); }}
          disabled={busy}
          className="form-input flex-1 text-sm"
        />
        {confirmDelete ? (
          <div className="flex items-center gap-1.5 mt-1 flex-shrink-0">
            <button type="button" onClick={() => { onDelete(b.id); setConfirmDelete(false); }}
              className="text-[11px] text-red-600 hover:underline">Delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-[var(--color-grey)] hover:text-[var(--color-ink)]">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
            title="Remove this behaviour"
            className="text-xs text-[var(--color-grey)] hover:text-red-600 mt-1 flex-shrink-0">✕</button>
        )}
      </div>
      <p className="text-[10px] text-[var(--color-grey)] mt-1">
        {b.source === "consultant" ? "you edited" : "member"}
        {b.flagged ? " · kept after nudge" : ""}
        {confirmDelete ? " · confirm delete?" : ""}
      </p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const TAG_LABEL: Record<string, string> = {
  meeting: "Meeting",
  async_chat: "Async chat",
  email: "Email",
  document: "Document",
  project_task: "Project task",
  other: "Other",
};

function summariseTags(stories: MemberStory[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of stories) {
    if (s.situation_tag) counts[s.situation_tag] = (counts[s.situation_tag] ?? 0) + 1;
  }
  return counts;
}
