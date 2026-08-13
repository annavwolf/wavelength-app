"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  CoordinationFrequency,
  Member,
  PsLabel,
  PsStatement,
  Team,
} from "@/types/database";
import type { InterviewRosterMember, InterviewStep } from "@/components/interview/types";
import ProgressBar from "@/components/interview/ProgressBar";
import ReadAloudToggle from "@/components/interview/ReadAloudToggle";
import LandingStep from "@/components/interview/steps/LandingStep";
import ProfileStep from "@/components/interview/steps/ProfileStep";
import type { MissingProfileFields } from "@/components/interview/steps/ProfileStep";
import ProfileDetailsStep from "@/components/interview/steps/ProfileDetailsStep";
import RosterStep from "@/components/interview/steps/RosterStep";
import PurposeStep from "@/components/interview/steps/PurposeStep";
import TeamNameStep from "@/components/interview/steps/TeamNameStep";
import OwnRoleStep from "@/components/interview/steps/OwnRoleStep";
import CoordinationStep from "@/components/interview/steps/CoordinationStep";
import PsWhyStep from "@/components/interview/steps/PsWhyStep";
import FaqStep from "@/components/interview/steps/FaqStep";
import PsDescentStep from "@/components/interview/steps/PsDescentStep";
import PsDiagnosticStep from "@/components/interview/steps/PsDiagnosticStep";
import PsImportanceStep from "@/components/interview/steps/PsImportanceStep";
import WhatHappensNextStep from "@/components/interview/steps/WhatHappensNextStep";
import ReviewStep from "@/components/interview/steps/ReviewStep";
import CloseStep from "@/components/interview/steps/CloseStep";
import AlreadyCompleteStep from "@/components/interview/steps/AlreadyCompleteStep";
import PrivacyStep from "@/components/interview/steps/PrivacyStep";
import { VoiceInputProvider } from "@/components/interview/VoiceInputContext";
import type { VerbatimPreference } from "@/lib/privacy";
import { isPhase1ResumeStep, type Phase1ResumeStep } from "@/lib/interviewProgress";
import { cancelSpeech, primeSpeech } from "@/lib/speech";

const STEP_ORDER: InterviewStep[] = [
  "privacy",
  "landing",
  "profile",
  "roster",
  "profile_details",
  "purpose",
  "team_name",
  "own_role",
  "coordination",
  "faq",
  "ps_why",
  "ps_descent",
  "ps_diagnostic",
  "ps_importance",
  "what_happens_next",
  "review",
  "close",
  "already_complete",
];

const FULL_BLEED_STEPS: InterviewStep[] = ["ps_diagnostic"];
const NO_BACK_STEPS: InterviewStep[] = ["privacy", "landing", "close", "already_complete"];

// Section background tints — subtle washes that shift as the member moves
// through sections. Applied as a semi-transparent overlay on <main>.
function getSectionOverlay(step: InterviewStep): string {
  if (
    ["profile", "roster", "profile_details", "purpose", "team_name", "own_role", "coordination"].includes(step)
  ) {
    return "rgba(160, 90, 70, 0.055)"; // warm terracotta
  }
  if (
    ["ps_why", "faq", "ps_descent", "ps_diagnostic", "ps_importance"].includes(step)
  ) {
    return "rgba(26, 90, 110, 0.055)"; // cool ocean teal
  }
  if (["what_happens_next", "review", "close", "already_complete"].includes(step)) {
    return "rgba(154, 91, 6, 0.055)"; // warm gold
  }
  return "transparent"; // Introduction
}

type InterviewDraft = {
  faqQuestion: string;
  faqAcknowledged: boolean;
  purposeText: string;
  teamNameText: string;
  ownRoleText: string;
  coordRatings: Record<string, CoordinationFrequency>;
  psImportanceText: string;
  psRatings: Record<number, PsLabel>;
};

type ResumeCheckpoint = {
  step: Phase1ResumeStep;
  returnToReview: boolean;
};

const INITIAL_DRAFT: InterviewDraft = {
  faqQuestion: "",
  faqAcknowledged: false,
  purposeText: "",
  teamNameText: "",
  ownRoleText: "",
  coordRatings: {},
  psImportanceText: "",
  psRatings: {},
};

function ProfileExit({ onExit }: { onExit?: () => void }) {
  return (
    <Link
      href="/me"
      onClick={onExit}
      className="absolute left-4 top-4 z-20 rounded-full border border-black/10 bg-white/90 px-4 py-2 text-sm font-medium text-[var(--color-grey)] shadow-sm backdrop-blur-sm transition-colors hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-purple)]"
      aria-label="Exit this activity and return to your profile"
    >
      Exit to my profile
    </Link>
  );
}

export default function InterviewPage() {
  const { member_id: memberIdParam } = useParams<{ member_id: string }>();

  const [member, setMember] = useState<Member | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [allMembers, setAllMembers] = useState<InterviewRosterMember[]>([]);
  const [psStatements, setPsStatements] = useState<PsStatement[]>([]);
  const [savedCoordinationCount, setSavedCoordinationCount] = useState(0);

  const [step, setStep] = useState<InterviewStep>("privacy");
  // Track the furthest step reached so progress-bar forward navigation works.
  const [highestStep, setHighestStep] = useState<InterviewStep>("privacy");
  const [draft, setDraft] = useState<InterviewDraft>(INITIAL_DRAFT);
  const [readAloud, setReadAloud] = useState(false);
  const [voiceInputAllowed, setVoiceInputAllowed] = useState(false);
  const [verbatimPreference, setVerbatimPreference] = useState<VerbatimPreference>("summary_only");
  const [postPrivacyStep, setPostPrivacyStep] = useState<InterviewStep>("landing");
  const [profileNeeds, setProfileNeeds] = useState<MissingProfileFields>({ name: false, location: false });
  // Set only when someone deliberately jumps from the final review to edit a
  // section. It keeps the ordinary interview linear while offering a fast,
  // obvious route straight back to the finish.
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resuming, setResuming] = useState(false);
  // Checkpoint requests are serialized so a slow request for an earlier screen
  // cannot overwrite a later screen when someone clicks quickly.
  const memberIdRef = useRef<string | null>(null);
  const visibleStepRef = useRef<InterviewStep>("privacy");
  const reviewEditRef = useRef(false);
  const queuedCheckpointRef = useRef<ResumeCheckpoint | null>(null);
  const savedCheckpointRef = useRef<ResumeCheckpoint | null>(null);
  const checkpointSavingRef = useRef(false);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/interview/session?member_id=${encodeURIComponent(memberIdParam)}`);
      if (!response.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await response.json();
      const memberData = data.member as Member;
      const teamData = data.team as Team | null;
      const membersData = data.all_members as InterviewRosterMember[];
      const statements = (data.ps_statements ?? []) as PsStatement[];
      const psResponsesData = (data.ps_responses ?? []) as { statement_id: number; label: PsLabel }[];
      const purposeCount = Number(data.purpose_count ?? 0);
      const coordCount = Number(data.coordination_count ?? 0);
      setMember(memberData);
      setTeam(teamData);
      setAllMembers(membersData);
      setPsStatements(statements);
      setSavedCoordinationCount(coordCount);
      setProfileNeeds(data.profile_needs ?? { name: false, location: false });
      setVoiceInputAllowed(Boolean(data.privacy?.voice_input_opt_in));

      // Pre-populate draft from DB values so returning users see their data.
      setDraft((prev) => ({
        ...prev,
        purposeText: data.purpose_text ?? "",
        ownRoleText: memberData.own_role ?? "",
        psImportanceText: memberData.ps_importance ?? "",
        teamNameText: memberData.team_name_suggestion ?? "",
        psRatings: Object.fromEntries(psResponsesData.map((response) => [response.statement_id, response.label])),
      }));
      if (data.privacy?.verbatim_preference === "verbatim" || data.privacy?.verbatim_preference === "summary_only") {
        setVerbatimPreference(data.privacy.verbatim_preference);
      }

      const psCount = psResponsesData.length;
      const allRated = statements.length > 0 && psCount === statements.length;
      let resumeAt: InterviewStep = "landing";
      const storedResumeStep = isPhase1ResumeStep(data.resume_step) ? data.resume_step : null;

      if (memberData.status === "complete") {
        resumeAt = "already_complete";
      } else if (storedResumeStep) {
        resumeAt = storedResumeStep;
      } else if (allRated) {
        resumeAt = "what_happens_next";
      } else if (psCount > 0) {
        resumeAt = "ps_diagnostic";
      } else if (coordCount > 0) {
        resumeAt = "ps_why";
      } else if (purposeCount > 0) {
        resumeAt = "own_role";
      }

      const shouldReturnToReview = Boolean(data.resume_return_to_review) && Boolean(storedResumeStep) && resumeAt !== "review";
      memberIdRef.current = memberData.member_id;
      savedCheckpointRef.current = storedResumeStep
        ? { step: storedResumeStep, returnToReview: shouldReturnToReview }
        : null;
      setEditingFromReview(shouldReturnToReview);
      reviewEditRef.current = shouldReturnToReview;
      setPostPrivacyStep(resumeAt);
      if (data.privacy) {
        setStep(resumeAt);
        visibleStepRef.current = resumeAt;
        setHighestStep(resumeAt);
        setResuming(resumeAt !== "landing" && resumeAt !== "already_complete");
      }

      setLoading(false);
    }

    void load();
  }, [memberIdParam]);

  useEffect(() => {
    memberIdRef.current = member?.member_id ?? null;
  }, [member]);

  useEffect(() => {
    visibleStepRef.current = step;
    reviewEditRef.current = editingFromReview;
  }, [step, editingFromReview]);

  // Next.js client-side link navigation does not necessarily emit pagehide.
  // Use this for both a browser/tab exit and our explicit exit control, so a
  // participant can safely pause at any point in the activity.
  const saveVisibleCheckpointOnExit = useCallback(() => {
    const memberId = memberIdRef.current;
    const currentStep = visibleStepRef.current;
    if (!memberId || !isPhase1ResumeStep(currentStep) || typeof navigator === "undefined") return;

    const payload = JSON.stringify({
      member_id: memberId,
      fields: {
        phase1_resume_step: currentStep,
        phase1_return_to_review: reviewEditRef.current,
      },
    });
    navigator.sendBeacon("/api/interview/session", new Blob([payload], { type: "application/json" }));
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", saveVisibleCheckpointOnExit);
    return () => window.removeEventListener("pagehide", saveVisibleCheckpointOnExit);
  }, [saveVisibleCheckpointOnExit]);

  function applyMemberFields(fields: Partial<Member>) {
    setMember((prev) => (prev ? { ...prev, ...fields } : prev));
    if (typeof fields.display_name === "string") {
      setAllMembers((previous) => previous.map((entry) =>
        entry.is_self ? { ...entry, display_name: fields.display_name ?? entry.display_name } : entry
      ));
    }
  }

  function updateDraft(fields: Partial<InterviewDraft>) {
    setDraft((prev) => ({ ...prev, ...fields }));
  }

  // Persist a members-table field before reflecting it locally. Used by the
  // free-text steps (own_role, ps_importance, team-name suggestion) that save
  // from this page rather than owning their own request.
  async function persistMemberField(fields: Partial<Member>): Promise<boolean> {
    if (!member) return false;
    setSaveError(null);
    try {
      const response = await fetch("/api/interview/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: member.member_id, fields }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[interview] failed to persist member field", { fields: Object.keys(fields) });
        setSaveError(data.error ?? "We could not save that. Please try again.");
        return false;
      }
      applyMemberFields(data.fields ?? fields);
      return true;
    } catch {
      setSaveError("We could not save that. Please check your connection and try again.");
      return false;
    }
  }

  async function flushQueuedCheckpoint() {
    if (checkpointSavingRef.current) return;
    const memberId = memberIdRef.current;
    if (!memberId) return;

    checkpointSavingRef.current = true;
    let inFlight: ResumeCheckpoint | null = null;
    try {
      while (queuedCheckpointRef.current) {
        const checkpoint = queuedCheckpointRef.current;
        queuedCheckpointRef.current = null;
        inFlight = checkpoint;
        const response = await fetch("/api/interview/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // This small request can complete while a participant closes or
          // reloads the tab. pagehide above provides a second last-chance save.
          keepalive: true,
          body: JSON.stringify({
            member_id: memberId,
            fields: {
              phase1_resume_step: checkpoint.step,
              phase1_return_to_review: checkpoint.returnToReview,
            },
          }),
        });
        if (!response.ok) {
          // Keep the newest requested screen queued for a later navigation or
          // retry. Do not interrupt the participant for an invisible save.
          if (!queuedCheckpointRef.current) queuedCheckpointRef.current = checkpoint;
          console.error("[interview] unable to save resume checkpoint");
          return;
        }
        savedCheckpointRef.current = checkpoint;
        inFlight = null;
      }
    } catch {
      if (inFlight && !queuedCheckpointRef.current) queuedCheckpointRef.current = inFlight;
      console.error("[interview] unable to save resume checkpoint");
    } finally {
      checkpointSavingRef.current = false;
    }
  }

  function queueResumeCheckpoint(next: InterviewStep, returnToReview: boolean) {
    if (!isPhase1ResumeStep(next)) return;
    const checkpoint = { step: next, returnToReview } satisfies ResumeCheckpoint;
    const saved = savedCheckpointRef.current;
    const queued = queuedCheckpointRef.current;
    if (
      saved?.step === checkpoint.step && saved.returnToReview === checkpoint.returnToReview &&
      !queued
    ) {
      return;
    }
    queuedCheckpointRef.current = checkpoint;
    void flushQueuedCheckpoint();
  }

  function goToStep(next: InterviewStep, options?: { returnToReview?: boolean }) {
    // Stop any queued/playing read-aloud (browser voice and hosted audio) so a
    // previous step's lines never bleed into the next one.
    cancelSpeech();
    const returnToReview = options?.returnToReview ?? reviewEditRef.current;
    setStep(next);
    visibleStepRef.current = next;
    queueResumeCheckpoint(next, returnToReview);
    // Update highest reached so forward navigation stays available.
    setHighestStep((prev) => {
      const prevIdx = STEP_ORDER.indexOf(prev);
      const nextIdx = STEP_ORDER.indexOf(next);
      return nextIdx > prevIdx ? next : prev;
    });
  }

  function goBack() {
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) goToStep(STEP_ORDER[index - 1]);
  }

  function editFromReview(target: InterviewStep) {
    setEditingFromReview(true);
    reviewEditRef.current = true;
    goToStep(target, { returnToReview: true });
  }

  function advanceOrReturnToReview(next: InterviewStep) {
    if (editingFromReview) {
      setEditingFromReview(false);
      reviewEditRef.current = false;
      goToStep("review", { returnToReview: false });
      return;
    }
    goToStep(next);
  }

  function toggleReadAloud() {
    const next = !readAloud;
    // Start the speech API inside the participant's click/tap. Chromium-based
    // browsers can otherwise drop the first line spoken by a later effect.
    if (next) primeSpeech();
    else cancelSpeech();
    setReadAloud(next);
  }

  if (notFound) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <ProfileExit />
        <p className="text-[var(--color-grey)]">
          This interview link is missing, expired, or no longer active. Please
          open the secure link your consultant sent you, or{" "}
          <Link href="/member-login" className="text-[var(--color-purple)] underline">
            sign in to your member profile
          </Link>{" "}
          to continue.
        </p>
      </main>
    );
  }

  if (loading || !member || !team) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <ProfileExit />
        <img src="/octopus-logo.png" alt="" className="h-20 w-auto mx-auto mb-8" />
        <h1 className="text-4xl font-serif mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
          Hello, I&apos;m <span className="purple">Otis.</span>
        </h1>
        <p className="accent text-lg mb-8">I&apos;m here to learn about your team.</p>
        <p className="text-[var(--color-grey)]">Loading your session...</p>
      </main>
    );
  }

  // Dedicated welcome-back screen for returning members.
  if (resuming) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <ProfileExit onExit={saveVisibleCheckpointOnExit} />
        <img
          src="/octopus-logo.png"
          alt=""
          aria-hidden="true"
          className="otis-float h-32 w-auto mb-10"
        />
        <h1
          className="text-4xl mb-4"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Welcome back,{" "}
          <span className="purple">{member.display_name.split(" ")[0]}.</span>
        </h1>
        <p className="text-[var(--color-grey)] text-lg mb-10">
          Your progress was saved.
        </p>
        <button
          type="button"
          onClick={() => setResuming(false)}
          className="btn-primary"
        >
          Continue
        </button>
      </main>
    );
  }

  const otherMembers = allMembers.filter((m) => !m.is_self);
  const fullBleed = FULL_BLEED_STEPS.includes(step);
  // Review edits are deliberately a short, save-first detour. Hiding the
  // ordinary back arrow prevents an unsaved draft being mistaken for a saved
  // answer; each edit returns straight to the review once it is saved.
  const showBack = !NO_BACK_STEPS.includes(step) && !editingFromReview;

  return (
    <VoiceInputProvider allowed={voiceInputAllowed} memberId={member.member_id}>
    <main
      className="flex-1 flex flex-col items-center relative"
    >
      <ProfileExit onExit={saveVisibleCheckpointOnExit} />
      {/* Section tint overlay — fades between sections */}
      <div
        className="fixed inset-0 pointer-events-none transition-colors duration-700"
        style={{ background: getSectionOverlay(step) }}
      />

      {step !== "privacy" && (
        <div className="w-full max-w-5xl px-6 pt-12 relative z-10">
          <div className="flex items-center justify-end mb-2">
            <ReadAloudToggle enabled={readAloud} onToggle={toggleReadAloud} />
          </div>
          <ProgressBar
            step={step}
            reachedStep={highestStep}
            onSectionClick={(firstStep) => goToStep(firstStep)}
          />
        </div>
      )}

      <div
        className={`relative z-10 ${fullBleed ? "w-full" : "w-full max-w-5xl px-6 pb-20"}`}
      >
        {editingFromReview && <p className="mb-5 text-sm font-medium text-[var(--color-purple)]">Save this change to return to your review.</p>}
        {saveError && <p className="mb-5 text-sm text-red-600" role="alert">{saveError}</p>}
        {step === "privacy" && (
          <PrivacyStep
            memberId={member.member_id}
            onAcknowledged={({ voiceInputAllowed: allowVoice, verbatimPreference: preference }) => {
              setVoiceInputAllowed(allowVoice);
              setVerbatimPreference(preference);
              if (postPrivacyStep !== "landing" && postPrivacyStep !== "already_complete") {
                setResuming(true);
              }
              goToStep(postPrivacyStep);
            }}
          />
        )}

        {step === "landing" && (
          <LandingStep
            readAloud={readAloud}
            onReadAloudToggle={toggleReadAloud}
            onAdvance={() => goToStep("profile")}
          />
        )}

        {step === "profile" && (
          <ProfileStep
            member={member}
            missing={profileNeeds}
            readAloud={readAloud}
            editMode={editingFromReview}
            onSaved={applyMemberFields}
            onAdvance={() => advanceOrReturnToReview("roster")}
          />
        )}

        {step === "roster" && (
          <RosterStep
            team={team}
            allMembers={allMembers}
            readAloud={readAloud}
            onAdvance={() => advanceOrReturnToReview(profileNeeds.location ? "profile_details" : "purpose")}
          />
        )}

        {step === "profile_details" && (
          <ProfileDetailsStep
            member={member}
            needsLocation={profileNeeds.location}
            readAloud={readAloud}
            onSaved={(fields) => {
              applyMemberFields(fields);
              if ("location" in fields) setProfileNeeds((current) => ({ ...current, location: false }));
            }}
            onAdvance={() => advanceOrReturnToReview("purpose")}
          />
        )}

        {step === "purpose" && (
          <PurposeStep
            member={member}
            allMembers={allMembers}
            readAloud={readAloud}
            text={draft.purposeText}
            editing={editingFromReview}
            onTextChange={(v) => updateDraft({ purposeText: v })}
            onAdvance={() => advanceOrReturnToReview("team_name")}
          />
        )}

        {step === "team_name" && (
          <TeamNameStep
            allMembers={allMembers}
            teamName={team.team_name}
            readAloud={readAloud}
            teamNameText={draft.teamNameText.trim() || team.team_name}
            onTeamNameTextChange={(v) => updateDraft({ teamNameText: v })}
            onAdvance={async () => {
              const saved = await persistMemberField({ team_name_suggestion: draft.teamNameText.trim() || null });
              if (saved) advanceOrReturnToReview("own_role");
            }}
          />
        )}

        {step === "own_role" && (
          <OwnRoleStep
            member={member}
            readAloud={readAloud}
            text={draft.ownRoleText}
            onTextChange={(v) => updateDraft({ ownRoleText: v })}
            onRoleSaved={(role) => persistMemberField({ role })}
            onAdvance={async () => {
              const saved = await persistMemberField({ own_role: draft.ownRoleText.trim() || null });
              if (saved) advanceOrReturnToReview("coordination");
            }}
          />
        )}

        {step === "coordination" && (
          <CoordinationStep
            member={member}
            otherMembers={otherMembers}
            readAloud={readAloud}
            ratings={draft.coordRatings}
            onRatingsChange={(v) => {
              updateDraft({ coordRatings: v });
              setSavedCoordinationCount(Object.keys(v).length);
            }}
            onAdvance={() => advanceOrReturnToReview("ps_why")}
          />
        )}

        {step === "ps_why" && (
          <PsWhyStep
            member={member}
            readAloud={readAloud}
            onAdvance={() => goToStep("faq")}
          />
        )}

        {step === "faq" && (
          <FaqStep
            member={member}
            readAloud={readAloud}
            question={draft.faqQuestion}
            onQuestionChange={(v) => updateDraft({ faqQuestion: v })}
            acknowledged={draft.faqAcknowledged}
            onAcknowledged={() => updateDraft({ faqAcknowledged: true })}
            onAdvance={() => goToStep("ps_descent")}
          />
        )}

        {step === "ps_descent" && (
          <PsDescentStep readAloud={readAloud} onAdvance={() => goToStep("ps_diagnostic")} />
        )}

        {step === "ps_diagnostic" && (
          <PsDiagnosticStep
            member={member}
            statements={psStatements}
            readAloud={readAloud}
            ratings={draft.psRatings}
            onRatingsChange={(v) => updateDraft({ psRatings: v })}
            onAdvance={() => advanceOrReturnToReview("ps_importance")}
          />
        )}

        {step === "ps_importance" && (
          <PsImportanceStep
            readAloud={readAloud}
            text={draft.psImportanceText}
            onTextChange={(v) => updateDraft({ psImportanceText: v })}
            onAdvance={async () => {
              const saved = await persistMemberField({ ps_importance: draft.psImportanceText.trim() || null });
              if (saved) advanceOrReturnToReview("what_happens_next");
            }}
          />
        )}

        {step === "what_happens_next" && (
          <WhatHappensNextStep
            member={member}
            readAloud={readAloud}
            onAdvance={() => goToStep("review")}
          />
        )}

        {step === "review" && (
          <ReviewStep
            member={member}
            psStatements={psStatements}
            psRatings={draft.psRatings}
            purposeText={draft.purposeText}
            ownRoleText={draft.ownRoleText}
            psImportanceText={draft.psImportanceText}
            readAloud={readAloud}
            verbatimPreference={verbatimPreference}
            voiceInputAllowed={voiceInputAllowed}
            teamName={draft.teamNameText.trim() || team.team_name}
            coordinationCount={Math.max(savedCoordinationCount, Object.keys(draft.coordRatings).length)}
            onPrivacySaved={({ verbatimPreference: preference, voiceInputAllowed: allowVoice }) => {
              setVerbatimPreference(preference);
              setVoiceInputAllowed(allowVoice);
            }}
            onEditStep={editFromReview}
            onAdvance={() => goToStep("close")}
          />
        )}

        {step === "close" && (
          <CloseStep
            member={member}
            onSaved={applyMemberFields}
            onFinish={() => goToStep("already_complete")}
          />
        )}

        {step === "already_complete" && (
          <AlreadyCompleteStep
            member={member}
            team={team}
          />
        )}
      </div>

      {/* Fixed bottom-left back arrow — consistent position across all screens */}
      {showBack && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="fixed bottom-6 left-6 z-20 p-3 rounded-full border border-black/15 bg-white/60 backdrop-blur-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] transition-colors text-xl leading-none shadow-sm"
        >
          ←
        </button>
      )}
    </main>
    </VoiceInputProvider>
  );
}
