"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";

export default function ProfileStep({
  member,
  supabase,
  onSaved,
  onAdvance,
}: {
  member: Member;
  supabase: AppSupabaseClient;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(member.display_name);
  const [role, setRole] = useState(member.role ?? "");
  const [location, setLocation] = useState(member.location ?? "");
  const [timezone, setTimezone] = useState(member.timezone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const fields = {
      display_name: displayName,
      role: role || null,
      location: location || null,
      timezone: timezone || null,
    };

    const { error: updateError } = await supabase
      .from("members")
      .update(fields)
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/profile] failed to save profile:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      setError("Something went wrong saving your details. Please try again.");
      setSaving(false);
      return;
    }

    onSaved(fields);
    setSaving(false);
    onAdvance();
  }

  return (
    <div>
      <ChatBubble>Let me make sure I have you right.</ChatBubble>

      {!editing ? (
        <>
          <div className="card mt-6 mb-6">
            <p className="font-medium text-lg">{member.display_name}</p>
            <p className="text-sm text-[var(--color-grey)] mt-1">
              {[member.role, member.location, member.timezone]
                .filter(Boolean)
                .join(" · ") || "No further details on file."}
            </p>
          </div>

          <p className="mb-6">Is this correct?</p>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onAdvance} className="btn-primary">
              Yes, that&apos;s me
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary"
            >
              Let me fix something
            </button>
          </div>
        </>
      ) : (
        <div className="card space-y-4 mt-6">
          <div>
            <label className="form-label">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Time zone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="form-input"
            />
          </div>

          {error && <p className="text-[var(--color-grey)]">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !displayName.trim()}
              className="btn-primary"
            >
              {saving ? "Saving..." : "Save and continue"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
