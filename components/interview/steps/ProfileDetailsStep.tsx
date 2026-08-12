"use client";

import { useState } from "react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import ChatBubble from "@/components/interview/ChatBubble";
import type { Member } from "@/types/database";

type Stage = "intro" | "location";

/**
 * A deliberately small follow-up after the roster. Role is handled by the
 * later contribution step. A recognised city can set a time zone automatically,
 * but a broader self-described location is also accepted without friction.
 */
export default function ProfileDetailsStep({
  member,
  needsLocation,
  readAloud,
  onSaved,
  onAdvance,
}: {
  member: Member;
  needsLocation: boolean;
  readAloud: boolean;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [stage, setStage] = useState<Stage>("intro");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!needsLocation) {
    return (
      <div>
        <ChatBubble readAloud={readAloud}>Thanks. I have the details I need for now.</ChatBubble>
        <button type="button" onClick={onAdvance} className="btn-primary mt-6">Continue</button>
      </div>
    );
  }

  async function saveLocation() {
    if (!location.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: member.member_id, fields: { location } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "We could not save that. Please try again.");
        return;
      }
      onSaved(data.fields ?? { location });
      onAdvance();
    } catch {
      setError("We could not save that. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (stage === "intro") {
    return (
      <div>
        <ChatBubble readAloud={readAloud}>
          I&apos;d like to ask a little more about you, if that&apos;s okay. This is optional.
        </ChatBubble>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => setStage("location")} className="btn-primary">That&apos;s fine</button>
          <button type="button" onClick={onAdvance} className="btn-secondary">Skip for now</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        I don&apos;t yet have a general sense of where you usually work from. What should I put down? A city and country is helpful, but a broad location is completely fine.
      </ChatBubble>
      <div className="mt-6 mb-4">
        <label className="form-label">Where do you usually work from?</label>
        <LocationAutocomplete
          value={location}
          onChange={setLocation}
          onSelect={() => undefined}
        />
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-grey)]">Suggestions can help Otis set a time zone automatically. A broad location is fine too; please do not enter an address.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={saveLocation} disabled={saving || !location.trim()} className="btn-primary">
          {saving ? "Saving..." : "Save and continue"}
        </button>
        <button type="button" onClick={onAdvance} disabled={saving} className="btn-secondary">Skip for now</button>
      </div>
    </div>
  );
}
