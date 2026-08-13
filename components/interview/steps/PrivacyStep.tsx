"use client";

import { useState } from "react";
import Link from "next/link";
import ChatBubble from "@/components/interview/ChatBubble";
import type { VerbatimPreference } from "@/lib/privacy";

function ChoiceCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`card w-full text-left flex gap-3 border-2 transition-colors ${
        selected ? "border-[var(--color-purple)] bg-[var(--color-purple)]/5" : "border-transparent"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
          selected ? "border-[var(--color-purple)] bg-[var(--color-purple)] text-white" : "border-black/20"
        }`}
      >
        {selected ? "✓" : ""}
      </span>
      <span className="leading-relaxed">{children}</span>
    </button>
  );
}

export default function PrivacyStep({
  memberId,
  onAcknowledged,
}: {
  memberId: string;
  onAcknowledged: (settings: { voiceInputAllowed: boolean; verbatimPreference: VerbatimPreference }) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [verbatimPreference, setVerbatimPreference] = useState<VerbatimPreference | null>(null);
  const [voiceInputAllowed, setVoiceInputAllowed] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueToInterview() {
    if (!acknowledged || !verbatimPreference || voiceInputAllowed === null) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          acknowledgement: true,
          verbatim_preference: verbatimPreference,
          voice_input_opt_in: voiceInputAllowed,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "We could not save your acknowledgement. Please try again.");
        return;
      }
      onAcknowledged({ voiceInputAllowed, verbatimPreference });
    } catch {
      setError("We could not save your acknowledgement. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const ready = acknowledged && verbatimPreference !== null && voiceInputAllowed !== null;

  return (
    <div className="max-w-2xl mx-auto py-10">
      <img src="/octopus-logo.png" alt="" aria-hidden="true" className="otis-float h-28 w-auto mx-auto mb-8" />
      <ChatBubble hideAvatar centered>
        Before we begin, please read the beta participant privacy information below.
      </ChatBubble>

      <section className="card mt-6 space-y-4 text-sm leading-relaxed">
        <div>
          <h1 className="text-2xl mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
            Beta participant privacy information
          </h1>
          <p>
            Otis collects your assessment responses to create team-level patterns for your team and its consultant. Your name and email are kept separately from response data. Your consultant can see participation and completion status, but not a name-to-response mapping.
          </p>
        </div>
        <p>
          This updated beta notice names Deepgram as the optional enhanced-audio processor. If you previously acknowledged an earlier beta notice, please read and acknowledge this updated version before continuing.
        </p>
        <p>
          The interview asks about your work on the team. It does not ask for age, gender, ethnicity, nationality, or other demographic details. If you choose to provide a broad work location, Otis uses a recognised city and country to set a time zone automatically where it can. Please do not enter a street address.
        </p>
        <p>
          By default, reports use team-level summaries and paraphrases. No one should attach your name to your answers. You can separately decide below whether Otis may use short exact excerpts without your name. In a small team, colleagues may still recognise context or a distinctive quote.
        </p>
        <p>
          Otis uses external AI services to help analyse de-identified team material. It removes common direct identifiers such as names, email addresses, phone numbers and links before sending text where possible, but cannot guarantee that every detail in free text is non-identifying. Raw microphone audio is not stored by Otis.
        </p>
        <p>
          Optional enhanced audio is provided by Deepgram when it is available. If you choose it, Otis sends the text needed to create a spoken reply to Deepgram. When you tap a microphone control, your recording is sent to Deepgram to make an editable transcript. Otis does not save raw recordings; it keeps only the text you choose to submit. Deepgram may handle request data under its own service terms and privacy practices, including outside your country. Text-only input is always available.
        </p>
        <p>
          This acknowledgement covers your beta journey, including the Results &amp; Team Agreement Activity. Before you share stories or behaviours there, Otis will ask you to confirm or change your exact-word setting. That is not a second privacy acknowledgement unless this notice is updated.
        </p>
        <p>
          Beta participant data is reviewed for deletion 12 months after your team&apos;s beta participation ends. For privacy questions, withdrawal, or technical support, email <a href="mailto:contact@wavelength.team?subject=Otis%20beta%20participant%20support" className="underline text-[var(--color-purple)]">contact@wavelength.team</a>. Read the full <Link href="/privacy" className="underline text-[var(--color-purple)]">privacy notice</Link>.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-medium">How should exact words be handled?</h2>
        <ChoiceCard selected={verbatimPreference === "summary_only"} onSelect={() => setVerbatimPreference("summary_only")}>
          <strong>Use summaries and paraphrases only.</strong><br />
          Do not include my exact words in team materials. This is the usual choice.
        </ChoiceCard>
        <ChoiceCard selected={verbatimPreference === "verbatim"} onSelect={() => setVerbatimPreference("verbatim")}>
          <strong>I permit short exact excerpts without my name.</strong><br />
          Otis may use excerpts in team material, never attributed to me by name. I can change this later before reporting.
        </ChoiceCard>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-medium">Optional enhanced audio</h2>
        <ChoiceCard selected={voiceInputAllowed === false} onSelect={() => setVoiceInputAllowed(false)}>
          <strong>Use text only.</strong><br />
          Do not send my words or recordings to the optional audio provider. Hide microphone controls.
        </ChoiceCard>
        <ChoiceCard selected={voiceInputAllowed === true} onSelect={() => setVoiceInputAllowed(true)}>
          <strong>I may use enhanced audio.</strong><br />
          I understand Deepgram may process Otis&apos;s spoken text and any recording I choose to make. Otis does not keep the raw recording; I can edit the resulting text before I submit it.
        </ChoiceCard>
      </section>

      <label className="mt-7 flex gap-3 items-start cursor-pointer text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>I have read and understood the beta participant privacy information.</span>
      </label>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={continueToInterview} disabled={!ready || saving} className="btn-primary mt-6">
        {saving ? "Saving..." : "Acknowledge and continue"}
      </button>
      {!ready && <p className="mt-3 text-sm text-[var(--color-grey)]">Choose how exact words and optional enhanced audio should be handled, then acknowledge the notice to continue.</p>}
    </div>
  );
}
