"use client";

import { useEffect, useState } from "react";
import type { VerbatimPreference } from "@/lib/privacy";

type Acknowledgement = {
  acknowledged_at: string;
  verbatim_preference: VerbatimPreference;
  voice_input_opt_in: boolean;
};

export default function PrivacySettings({
  acknowledgement,
  onSaved,
}: {
  acknowledgement: Acknowledgement | null;
  onSaved: (next: Pick<Acknowledgement, "verbatim_preference" | "voice_input_opt_in">) => void;
}) {
  const [verbatimPreference, setVerbatimPreference] = useState<VerbatimPreference>(
    acknowledgement?.verbatim_preference ?? "summary_only"
  );
  const [voiceInputAllowed, setVoiceInputAllowed] = useState(
    acknowledgement?.voice_input_opt_in ?? false
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!acknowledgement) return;
    setVerbatimPreference(acknowledgement.verbatim_preference);
    setVoiceInputAllowed(acknowledgement.voice_input_opt_in);
  }, [acknowledgement]);

  if (!acknowledgement?.acknowledged_at) return null;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/member/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verbatim_preference: verbatimPreference,
          voice_input_opt_in: voiceInputAllowed,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "We could not save your privacy choices. Please try again.");
        return;
      }
      onSaved({ verbatim_preference: verbatimPreference, voice_input_opt_in: voiceInputAllowed });
      setMessage("Your privacy choices have been saved.");
    } catch {
      setMessage("We could not save your privacy choices. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 space-y-5 border-t border-[var(--color-purple)]/20 pt-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">Exact words in team materials</legend>
        <label className="flex items-start gap-3 cursor-pointer text-sm leading-relaxed">
          <input type="radio" name="member-verbatim" checked={verbatimPreference === "summary_only"} onChange={() => setVerbatimPreference("summary_only")} className="mt-0.5 h-5 w-5" />
          <span><strong>Use summaries and paraphrases only.</strong><br />Do not include my exact words.</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer text-sm leading-relaxed">
          <input type="radio" name="member-verbatim" checked={verbatimPreference === "verbatim"} onChange={() => setVerbatimPreference("verbatim")} className="mt-0.5 h-5 w-5" />
          <span><strong>Permit short exact excerpts without my name.</strong><br />They may be used in team materials without attribution.</span>
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">Optional enhanced audio</legend>
        <label className="flex items-start gap-3 cursor-pointer text-sm leading-relaxed">
          <input type="radio" name="member-audio" checked={!voiceInputAllowed} onChange={() => setVoiceInputAllowed(false)} className="mt-0.5 h-5 w-5" />
          <span><strong>Use text only.</strong><br />Hide microphone controls and do not use the optional audio provider.</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer text-sm leading-relaxed">
          <input type="radio" name="member-audio" checked={voiceInputAllowed} onChange={() => setVoiceInputAllowed(true)} className="mt-0.5 h-5 w-5" />
          <span><strong>I may use enhanced audio.</strong><br />Deepgram may process Otis&apos;s spoken text and a recording only when I choose to use a microphone control. Otis does not store raw recordings.</span>
        </label>
      </fieldset>

      {message && <p className="text-sm text-[var(--color-grey)]" role="status">{message}</p>}
      <button type="button" onClick={() => void save()} disabled={saving} className="btn-secondary" style={{ padding: "10px 18px", fontSize: "14px" }}>
        {saving ? "Saving..." : "Save privacy choices"}
      </button>
    </div>
  );
}
