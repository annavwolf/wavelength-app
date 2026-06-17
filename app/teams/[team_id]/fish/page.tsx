"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Fish, Zone } from "@/types/database";

function zoneBadge(zone: Zone) {
  switch (zone) {
    case 1:
      return { label: "Belonging", className: "badge-zone1" };
    case 2:
      return { label: "Speaking up", className: "badge-zone2" };
    case 3:
      return { label: "Learning", className: "badge-zone3" };
  }
}

export default function FishSelectionPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());

  const [fishList, setFishList] = useState<Fish[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [patternName, setPatternName] = useState("");
  const [patternDescription, setPatternDescription] = useState("");
  const [patternZone, setPatternZone] = useState<Zone>(1);
  const [addingPattern, setAddingPattern] = useState(false);
  const [addPatternError, setAddPatternError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("fish")
        .select("*")
        .eq("is_default", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("[fish] failed to load default fish:", error);
      } else if (data) {
        setFishList(data);
        setSelectedIds(new Set(data.map((fish) => fish.fish_id)));
      }
      setLoading(false);
    }

    load();
  }, [supabase]);

  function toggleSelected(fishId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fishId)) {
        next.delete(fishId);
      } else {
        next.add(fishId);
      }
      return next;
    });
  }

  async function handleAddPattern(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingPattern(true);
    setAddPatternError(null);

    const insertPayload = {
      team_id: teamId,
      name: patternName,
      description: patternDescription || null,
      maps_to_zone: patternZone,
      is_default: false,
    };
    console.log("[fish] insert payload:", insertPayload);

    const { data, error } = await supabase
      .from("fish")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !data) {
      console.error("[fish] insert custom pattern failed:", error);
      setAddPatternError("Something went wrong. Please try again.");
    } else {
      setFishList((prev) => [...prev, data]);
      setSelectedIds((prev) => new Set(prev).add(data.fish_id));
      setPatternName("");
      setPatternDescription("");
      setPatternZone(1);
      setShowAddForm(false);
    }

    setAddingPattern(false);
  }

  async function handleConfirm() {
    setSaving(true);
    setSavingError(null);

    const { error } = await supabase
      .from("teams")
      .update({ selected_fish_ids: Array.from(selectedIds) })
      .eq("team_id", teamId);

    if (error) {
      console.error("[fish] failed to save selected_fish_ids:", error);
      setSavingError("Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    router.push(`/teams/${teamId}/invite`);
  }

  if (loading) {
    return (
      <main className="px-6 py-24 text-center text-[var(--color-grey)]">
        Loading...
      </main>
    );
  }

  return (
    <main className="px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/teams/${teamId}`}
          className="text-[var(--color-grey)]"
        >
          ← Back to team
        </Link>

        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Heads up:</strong> Changing fish patterns after members have started their assessments will affect consistency. Only change these settings if no members have begun yet.
        </div>

        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">
          Which <span className="accent">patterns</span> should I look for?
        </h1>

        <p className="accent text-xl mt-6">
          These are the team dynamics I&apos;ll explore with each member.
        </p>

        <p className="mt-4 text-[var(--color-grey)]">
          The five I&apos;ve chosen reflect the most common challenges in
          remote and hybrid teams. Remove any that don&apos;t feel relevant,
          or add your own.
        </p>

        <div className="mt-12 space-y-4">
          {fishList.map((fish) => {
            const badge = zoneBadge(fish.maps_to_zone);
            return (
              <div
                key={fish.fish_id}
                className="card flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(fish.fish_id)}
                    onChange={() => toggleSelected(fish.fish_id)}
                    className="mt-1.5 h-4 w-4"
                  />
                  <div>
                    <h3 className="text-lg font-semibold">{fish.name}</h3>
                    {fish.description && (
                      <p className="text-sm text-[var(--color-grey)] mt-1">
                        {fish.description}
                      </p>
                    )}
                  </div>
                </div>
                {badge && (
                  <span className={`whitespace-nowrap ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="text-sm text-[var(--color-purple)] font-medium"
            >
              + Add pattern
            </button>
          ) : (
            <form
              onSubmit={handleAddPattern}
              className="card space-y-4 text-left"
            >
              <div>
                <label className="form-label">Pattern name</label>
                <input
                  type="text"
                  required
                  value={patternName}
                  onChange={(e) => setPatternName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <input
                  type="text"
                  value={patternDescription}
                  onChange={(e) => setPatternDescription(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Which area?</label>
                <select
                  value={patternZone}
                  onChange={(e) =>
                    setPatternZone(Number(e.target.value) as Zone)
                  }
                  className="form-input"
                >
                  <option value={1}>Belonging</option>
                  <option value={2}>Speaking up freely</option>
                  <option value={3}>Learning and innovation</option>
                </select>
              </div>

              {addPatternError && (
                <p className="text-[var(--color-grey)]">{addPatternError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingPattern}
                  className="btn-primary"
                >
                  {addingPattern ? "Adding..." : "+ Add pattern"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-8 text-[var(--color-grey)]">
          {selectedIds.size} patterns selected
        </p>

        {savingError && (
          <p className="mt-4 text-[var(--color-grey)]">{savingError}</p>
        )}

        <button
          onClick={handleConfirm}
          disabled={saving}
          className="btn-primary mt-6"
        >
          {saving ? "Saving..." : "Confirm patterns →"}
        </button>
      </div>
    </main>
  );
}
