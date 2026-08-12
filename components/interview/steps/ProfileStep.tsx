"use client";

import { useState } from "react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { Member } from "@/types/database";

export type MissingProfileFields = {
  name: boolean;
  location: boolean;
};

type Stage = "summary" | "name" | "greeting" | "edit";

export default function ProfileStep({
  member,
  missing,
  readAloud,
  editMode = false,
  onSaved,
  onAdvance,
}: {
  member: Member;
  missing: MissingProfileFields;
  readAloud: boolean;
  editMode?: boolean;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [stage, setStage] = useState<Stage>(() => editMode ? "edit" : missing.name ? "name" : "summary");
  const [displayName, setDisplayName] = useState(missing.name ? "" : member.display_name);
  const [location, setLocation] = useState(member.location ?? "");
  const [locationChanged, setLocationChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = displayName.trim().split(" ")[0] || "there";

  async function save(fields: Record<string, string | null>) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: member.member_id, fields }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "We could not save that. Please try again.");
        return false;
      }
      onSaved(data.fields ?? fields);
      return true;
    } catch {
      setError("We could not save that. Please check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveName() {
    if (!displayName.trim()) return;
    const saved = await save({ display_name: displayName.trim() });
    if (saved) setStage("greeting");
  }

  async function saveEdits() {
    const fields: Record<string, string | null> = {};
    if (displayName.trim() && displayName.trim() !== member.display_name) {
      fields.display_name = displayName.trim();
    }
    if (locationChanged) {
      fields.location = location.trim() || null;
    }
    if (!Object.keys(fields).length) {
      onAdvance();
      return;
    }
    const saved = await save(fields);
    if (saved) onAdvance();
  }

  if (stage === "name") {
    return (
      <div>
        <ChatBubble readAloud={readAloud}>
          I&apos;ll tell you what I know about your team, but I don&apos;t have your name. Who am I speaking with?
        </ChatBubble>
        <div className="mt-6 mb-4">
          <label className="form-label">First name or preferred name</label>
          <VoiceTextInput value={displayName} onChange={setDisplayName} placeholder="For example, Sam" />
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-grey)]">A first name or preferred name is enough—please do not enter a surname.</p>
        </div>
        {error && <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>}
        <button type="button" onClick={saveName} disabled={saving || !displayName.trim()} className="btn-primary">
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    );
  }

  if (stage === "greeting") {
    return (
      <div>
        <ChatBubble readAloud={readAloud}>Nice to meet you, {firstName}.</ChatBubble>
        <button type="button" onClick={onAdvance} className="btn-primary mt-6">Continue</button>
      </div>
    );
  }

  if (stage === "edit") {
    return (
      <div>
        <ChatBubble readAloud={readAloud}>
          What would you like to update? You can change your preferred name or where you usually work from here.
        </ChatBubble>
        <div className="card mt-6 space-y-5">
          <div>
            <label className="form-label">First name or preferred name</label>
            <VoiceTextInput value={displayName} onChange={setDisplayName} placeholder="For example, Sam" />
          </div>
          <div>
            <label className="form-label">City and country (optional)</label>
            <LocationAutocomplete
              value={location}
              onChange={(value) => {
                setLocation(value);
                setLocationChanged(true);
              }}
              onSelect={() => {
                setLocationChanged(true);
              }}
            />
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-grey)]">A city and country lets Otis set your time zone automatically when it recognises them. A broad location is fine too—please do not enter an address.</p>
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={saveEdits} disabled={saving || !displayName.trim()} className="btn-primary">
            {saving ? "Saving..." : "Save changes"}
          </button>
          {!editMode && <button type="button" onClick={() => setStage("summary")} disabled={saving} className="btn-secondary">Cancel</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Here&apos;s what I have on file about you.
      </ChatBubble>
      <section className="card mt-6 mb-6 space-y-2" aria-label="What Otis knows about you">
        <p><strong>Name:</strong> {member.display_name}</p>
        {member.role && <p><strong>Team role on file:</strong> {member.role}</p>}
        {member.location && <p><strong>Usually working from:</strong> {member.location}</p>}
      </section>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setStage("greeting")} className="btn-primary">That&apos;s right</button>
        <button type="button" onClick={() => setStage("edit")} className="btn-secondary">Update my name or location</button>
      </div>
    </div>
  );
}
