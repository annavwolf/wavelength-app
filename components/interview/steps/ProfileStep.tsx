"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import VoiceTextInput from "@/components/interview/VoiceTextInput";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";
import { propagateDisplayNameChange } from "@/lib/memberRename";

type Stage = "confirm" | "greeting" | "correction_form" | "correction_done";

export default function ProfileStep({
  member,
  supabase,
  readAloud,
  onSaved,
  onAdvance,
}: {
  member: Member;
  supabase: AppSupabaseClient;
  readAloud: boolean;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [stage, setStage] = useState<Stage>("confirm");
  const [displayName, setDisplayName] = useState(member.display_name);
  const [role, setRole] = useState(member.role ?? "");
  const [location, setLocation] = useState(member.location ?? "");
  const [timezone, setTimezone] = useState(member.timezone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveCorrection() {
    setSaving(true);
    setError(null);

    const previousName = member.display_name;
    const fields = {
      display_name: displayName || member.display_name,
      role: role || null,
      location: location || null,
      timezone: timezone || null,
    };

    const { error: updateError } = await supabase
      .from("members")
      .update(fields)
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/profile] failed to save correction:", {
        message: updateError.message,
        code: updateError.code,
      });
      setError("Something went wrong saving your details. Please try again.");
      setSaving(false);
      return;
    }

    // Repoint any ratings other members already gave this member under the old name.
    await propagateDisplayNameChange(
      supabase,
      member.team_id,
      previousName,
      fields.display_name
    );

    console.info(
      `[interview/profile] profile corrected: "${member.display_name}" → "${fields.display_name}"`
    );
    onSaved(fields);
    setSaving(false);
    setStage("correction_done");
  }

  const currentFirstName = (displayName || member.display_name).split(" ")[0];

  return (
    <div>
      {stage === "confirm" && (
        <>
          <ChatBubble readAloud={readAloud}>
            Now that you know a bit about me, I&apos;d like to know more about
            you. Here&apos;s what I think I know already.
          </ChatBubble>

          {/* Profile card — values rendered with real <strong>, no markdown syntax */}
          <div className="card mt-2 mb-6 space-y-1">
            <p className="font-medium text-lg">{member.display_name}</p>
            <p className="text-sm text-[var(--color-grey)]">
              {[member.role, member.location, member.timezone]
                .filter(Boolean)
                .join(" · ") || "No further details on file."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStage("greeting")}
              className="btn-primary"
            >
              Yes, that&apos;s me
            </button>
            <button
              type="button"
              onClick={() => setStage("correction_form")}
              className="btn-secondary"
            >
              That&apos;s not quite right.
            </button>
          </div>
        </>
      )}

      {stage === "greeting" && (
        <>
          <ChatBubble readAloud={readAloud}>
            {`It's nice to meet you, ${member.display_name.split(" ")[0]}.`}
          </ChatBubble>
          <button type="button" onClick={onAdvance} className="btn-primary mt-8">
            Continue
          </button>
        </>
      )}

      {stage === "correction_form" && (
        <>
          <ChatBubble readAloud={readAloud}>
            Sorry about that. What did I get wrong?
          </ChatBubble>
          <div className="card space-y-4 mt-6">
            <div>
              <label className="form-label">Name</label>
              <VoiceTextInput value={displayName} onChange={setDisplayName} />
            </div>
            <div>
              <label className="form-label">Role</label>
              <VoiceTextInput value={role} onChange={setRole} />
            </div>
            <div>
              <label className="form-label">Location</label>
              <VoiceTextInput value={location} onChange={setLocation} />
            </div>
            <div>
              <label className="form-label">Time zone</label>
              <VoiceTextInput value={timezone} onChange={setTimezone} />
            </div>

            {error && <p className="text-[var(--color-grey)]">{error}</p>}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveCorrection}
                disabled={saving || !displayName.trim()}
                className="btn-primary"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setStage("confirm")}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {stage === "correction_done" && (
        <>
          <ChatBubble readAloud={readAloud}>
            {`It's nice to meet you, ${currentFirstName}.`}
          </ChatBubble>
          <button type="button" onClick={onAdvance} className="btn-primary mt-8">
            Continue
          </button>
        </>
      )}
    </div>
  );
}
