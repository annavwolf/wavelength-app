"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { VerbatimPreference } from "@/lib/privacy";
import { PS_LABEL_WORD } from "@/lib/psLabels";
import type { InterviewStep } from "@/components/interview/types";
import type { Member, PsLabel, PsStatement } from "@/types/database";

function ReviewCardHeading({
  children,
  editLabel,
  onEdit,
}: {
  children: React.ReactNode;
  editLabel: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <h2 className="text-xl" style={{ fontFamily: "Playfair Display, serif" }}>{children}</h2>
      <button type="button" onClick={onEdit} className="shrink-0 text-sm font-medium text-[var(--color-purple)] underline underline-offset-4">
        {editLabel}
      </button>
    </div>
  );
}

// The previous review screen included legacy demographic fields and a second,
// contradictory consent mechanism. This review is deliberately read-only: the
// participant can use the Back control to edit answers and can review the
// single beta privacy setting directly before final submission.
export default function ReviewStep({
  member,
  psStatements,
  psRatings,
  purposeText,
  ownRoleText,
  psImportanceText,
  teamName,
  coordinationCount,
  readAloud,
  verbatimPreference: initialVerbatimPreference,
  voiceInputAllowed: initialVoiceInputAllowed,
  onPrivacySaved,
  onEditStep,
  onAdvance,
}: {
  member: Member;
  psStatements: PsStatement[];
  psRatings: Record<number, PsLabel>;
  purposeText: string;
  ownRoleText: string;
  psImportanceText: string;
  teamName: string;
  coordinationCount: number;
  readAloud: boolean;
  verbatimPreference: VerbatimPreference;
  voiceInputAllowed: boolean;
  onPrivacySaved: (settings: { verbatimPreference: VerbatimPreference; voiceInputAllowed: boolean }) => void;
  onEditStep: (step: InterviewStep) => void;
  onAdvance: () => void;
}) {
  const firstName = member.display_name?.split(" ")[0] || "there";
  const completedRatings = psStatements.filter((statement) => psRatings[statement.statement_id]);
  const [verbatimPreference, setVerbatimPreference] = useState<VerbatimPreference>(initialVerbatimPreference);
  const [voiceInputAllowed, setVoiceInputAllowed] = useState(initialVoiceInputAllowed);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);

  async function savePrivacySettings() {
    setPrivacySaving(true);
    setPrivacyMessage(null);
    try {
      const response = await fetch("/api/interview/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: member.member_id,
          acknowledgement: true,
          verbatim_preference: verbatimPreference,
          voice_input_opt_in: voiceInputAllowed,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPrivacyMessage(data.error ?? "We could not save your privacy settings. Please try again.");
        return;
      }
      onPrivacySaved({ verbatimPreference, voiceInputAllowed });
      setPrivacyMessage("Privacy settings saved.");
    } catch {
      setPrivacyMessage("We could not save your privacy settings. Please check your connection and try again.");
    } finally {
      setPrivacySaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <ChatBubble readAloud={readAloud} hideAvatar centered>
        Here&apos;s a quick review of what you have shared, {firstName}. Choose Edit on anything you want to change, and Otis will bring you straight back here afterward.
      </ChatBubble>

      <section className="card space-y-3">
        <ReviewCardHeading editLabel="Edit" onEdit={() => onEditStep("profile")}>Your profile</ReviewCardHeading>
        <p><strong>Name:</strong> {member.display_name}</p>
        {member.location && <p><strong>City and country:</strong> {member.location}</p>}
        {member.timezone && <p><strong>Time zone:</strong> {member.timezone}</p>}
      </section>

      <section className="card space-y-2">
        <ReviewCardHeading editLabel="Edit" onEdit={() => onEditStep("purpose")}>Shared purpose</ReviewCardHeading>
        <p className="whitespace-pre-wrap">{purposeText || "Not added yet."}</p>
      </section>

      <section className="card space-y-2">
        <ReviewCardHeading editLabel="Edit" onEdit={() => onEditStep("team_name")}>Team name</ReviewCardHeading>
        <p>{teamName}</p>
      </section>

      <section className="card space-y-2">
        <ReviewCardHeading editLabel="Edit" onEdit={() => onEditStep("own_role")}>Your contribution to the team</ReviewCardHeading>
        {member.role && <p><strong>Role on file:</strong> {member.role}</p>}
        <p className="whitespace-pre-wrap">{ownRoleText || "Not added yet."}</p>
      </section>

      <section className="card space-y-2">
        <ReviewCardHeading editLabel="Edit" onEdit={() => onEditStep("coordination")}>How often you work with the team</ReviewCardHeading>
        <p>{coordinationCount ? `You have rated coordination with ${coordinationCount} teammate${coordinationCount === 1 ? "" : "s"}.` : "No coordination ratings saved yet."}</p>
      </section>

      <section className="card space-y-2">
        <ReviewCardHeading editLabel="Edit" onEdit={() => onEditStep("ps_importance")}>Why psychological safety matters</ReviewCardHeading>
        <p className="whitespace-pre-wrap">{psImportanceText || "Not added yet."}</p>
      </section>

      <section className="card space-y-3">
        <ReviewCardHeading editLabel="Edit" onEdit={() => onEditStep("ps_diagnostic")}>Your team ratings</ReviewCardHeading>
        {completedRatings.length ? (
          <ul className="space-y-3">
            {completedRatings.map((statement) => (
              <li key={statement.statement_id} className="flex justify-between gap-5 text-sm">
                <span>{statement.statement_text}</span>
                <strong className="whitespace-nowrap">{PS_LABEL_WORD[psRatings[statement.statement_id]]}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-grey)]">Your saved ratings will be included when you submit.</p>
        )}
      </section>

      <section className="card border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/5 space-y-4">
        <div>
          <h2 className="text-xl mb-2" style={{ fontFamily: "Playfair Display, serif" }}>Review your privacy settings</h2>
          <p className="text-base leading-relaxed text-[var(--color-grey)]">You can change these choices before submitting. Your name is never attached to an excerpt.</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="font-medium text-base mb-2">Exact words in team materials</legend>
          <label className="flex items-start gap-3 cursor-pointer text-base leading-relaxed"><input type="radio" name="verbatim" checked={verbatimPreference === "summary_only"} onChange={() => setVerbatimPreference("summary_only")} className="mt-1 h-5 w-5" /><span><strong>Use summaries and paraphrases only.</strong><br />Do not include my exact words.</span></label>
          <label className="flex items-start gap-3 cursor-pointer text-base leading-relaxed"><input type="radio" name="verbatim" checked={verbatimPreference === "verbatim"} onChange={() => setVerbatimPreference("verbatim")} className="mt-1 h-5 w-5" /><span><strong>Permit short exact excerpts without my name.</strong><br />They may be used in team materials without attribution.</span></label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-medium text-base mb-2">Optional enhanced audio</legend>
          <label className="flex items-start gap-3 cursor-pointer text-base leading-relaxed"><input type="radio" name="voice" checked={!voiceInputAllowed} onChange={() => setVoiceInputAllowed(false)} className="mt-1 h-5 w-5" /><span><strong>Use text only.</strong> Do not show microphone controls or use the optional audio provider.</span></label>
          <label className="flex items-start gap-3 cursor-pointer text-base leading-relaxed"><input type="radio" name="voice" checked={voiceInputAllowed} onChange={() => setVoiceInputAllowed(true)} className="mt-1 h-5 w-5" /><span><strong>I may use enhanced audio.</strong> ElevenLabs may process Otis&apos;s spoken text and a recording only when I choose to use a microphone control. Otis does not store raw recordings.</span></label>
        </fieldset>
        {privacyMessage && <p className="text-base text-[var(--color-grey)]" role="status">{privacyMessage}</p>}
        <button type="button" onClick={savePrivacySettings} disabled={privacySaving} className="btn-secondary">{privacySaving ? "Saving..." : "Save privacy settings"}</button>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={onAdvance} className="btn-primary">Continue to submit</button>
      </div>
    </div>
  );
}
