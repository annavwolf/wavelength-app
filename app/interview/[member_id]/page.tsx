"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type {
  CoordinationFrequency,
  Member,
  PsLabel,
  PsStatement,
  Team,
} from "@/types/database";
import type { InterviewStep } from "@/components/interview/types";
import ProgressBar from "@/components/interview/ProgressBar";
import ReadAloudToggle from "@/components/interview/ReadAloudToggle";
import LandingStep from "@/components/interview/steps/LandingStep";
import ProfileStep from "@/components/interview/steps/ProfileStep";
import PersonalContextStep from "@/components/interview/steps/PersonalContextStep";
import PurposeStep from "@/components/interview/steps/PurposeStep";
import TeamNameStep from "@/components/interview/steps/TeamNameStep";
import MissingMemberStep from "@/components/interview/steps/MissingMemberStep";
import OwnRoleStep from "@/components/interview/steps/OwnRoleStep";
import CoordinationStep from "@/components/interview/steps/CoordinationStep";
import PsWhyStep from "@/components/interview/steps/PsWhyStep";
import ConsentStep from "@/components/interview/steps/ConsentStep";
import FaqStep from "@/components/interview/steps/FaqStep";
import PsDescentStep from "@/components/interview/steps/PsDescentStep";
import PsDiagnosticStep from "@/components/interview/steps/PsDiagnosticStep";
import PsImportanceStep from "@/components/interview/steps/PsImportanceStep";
import WhatHappensNextStep from "@/components/interview/steps/WhatHappensNextStep";
import ReviewStep from "@/components/interview/steps/ReviewStep";
import CloseStep from "@/components/interview/steps/CloseStep";
import AlreadyCompleteStep from "@/components/interview/steps/AlreadyCompleteStep";

const STEP_ORDER: InterviewStep[] = [
  "landing",
  "profile",
  "personal_context",
  "purpose",
  "team_name",
  "missing_member",
  "own_role",
  "coordination",
  "ps_why",
  "consent",
  "faq",
  "ps_descent",
  "ps_diagnostic",
  "ps_importance",
  "what_happens_next",
  "review",
  "close",
  "already_complete",
];

const FULL_BLEED_STEPS: InterviewStep[] = ["ps_diagnostic"];
const NO_BACK_STEPS: InterviewStep[] = ["landing", "close", "already_complete"];

// Section background tints — subtle washes that shift as the member moves
// through sections. Applied as a semi-transparent overlay on <main>.
function getSectionOverlay(step: InterviewStep): string {
  if (
    ["profile", "personal_context", "purpose", "missing_member", "own_role", "coordination"].includes(step)
  ) {
    return "rgba(160, 90, 70, 0.055)"; // warm terracotta
  }
  if (
    ["ps_why", "consent", "faq", "ps_descent", "ps_diagnostic", "ps_importance"].includes(step)
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
  personalLanguage: string;
  personalContext: string;
  genderIdentity: string;
  ethnicityCultural: string;
  ageText: string;
  purposeText: string;
  teamNameText: string;
  ownRoleText: string;
  rosterShowMissingField: boolean;
  rosterMissingName: string;
  rosterMissingRole: string;
  rosterNoted: boolean;
  coordRatings: Record<string, CoordinationFrequency>;
  psImportanceText: string;
  psRatings: Record<number, PsLabel>;
};

const INITIAL_DRAFT: InterviewDraft = {
  faqQuestion: "",
  faqAcknowledged: false,
  personalLanguage: "",
  personalContext: "",
  genderIdentity: "",
  ethnicityCultural: "",
  ageText: "",
  purposeText: "",
  teamNameText: "",
  ownRoleText: "",
  rosterShowMissingField: false,
  rosterMissingName: "",
  rosterMissingRole: "",
  rosterNoted: false,
  coordRatings: {},
  psImportanceText: "",
  psRatings: {},
};

export default function InterviewPage() {
  const { member_id: memberIdParam } = useParams<{ member_id: string }>();
  const [supabase] = useState(() => createBrowserClient());

  const [member, setMember] = useState<Member | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [psStatements, setPsStatements] = useState<PsStatement[]>([]);

  const [step, setStep] = useState<InterviewStep>("landing");
  // Track the furthest step reached so progress-bar forward navigation works.
  const [highestStep, setHighestStep] = useState<InterviewStep>("landing");
  const [draft, setDraft] = useState<InterviewDraft>(INITIAL_DRAFT);
  const [readAloud, setReadAloud] = useState(false);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("member_id", memberIdParam)
        .single();

      if (memberError || !memberData) {
        console.error("[interview] failed to load member:", memberError);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const [
        { data: teamData },
        { data: membersData },
        { data: statementsData },
        { data: psResponsesData },
        { count: purposeCount },
        { count: coordCount },
      ] = await Promise.all([
        supabase.from("teams").select("*").eq("team_id", memberData.team_id).single(),
        supabase
          .from("members")
          .select("*")
          .eq("team_id", memberData.team_id)
          .order("created_at", { ascending: true }),
        supabase.from("ps_statements").select("*").order("statement_id", { ascending: true }),
        supabase
          .from("ps_responses")
          .select("statement_id, label")
          .eq("member_id", memberData.member_id)
          .eq("round", 1),
        supabase
          .from("purpose_responses")
          .select("*", { count: "exact", head: true })
          .eq("member_id", memberData.member_id),
        supabase
          .from("coordination_ratings")
          .select("*", { count: "exact", head: true })
          .eq("member_id", memberData.member_id),
      ]);

      const statements = statementsData ?? [];
      setMember(memberData);
      setTeam(teamData ?? null);
      setAllMembers(membersData ?? []);
      setPsStatements(statements);

      // Pre-populate draft from DB values so returning users see their data.
      setDraft((prev) => ({
        ...prev,
        personalLanguage: memberData.primary_language ?? "",
        personalContext: memberData.personal_context ?? "",
        genderIdentity: memberData.gender_identity ?? "",
        ethnicityCultural: memberData.ethnicity_cultural ?? "",
        ageText: memberData.age ?? "",
        ownRoleText: memberData.own_role ?? "",
        psImportanceText: memberData.ps_importance ?? "",
        teamNameText: memberData.team_name_suggestion ?? "",
      }));

      const psCount = psResponsesData?.length ?? 0;
      const allRated = statements.length > 0 && psCount === statements.length;

      if (memberData.status === "complete") {
        setStep("already_complete");
      } else if (allRated) {
        setStep("what_happens_next");
        setHighestStep("what_happens_next");
        setResuming(true);
      } else if (psCount > 0) {
        setStep("ps_diagnostic");
        setHighestStep("ps_diagnostic");
        setResuming(true);
      } else if ((coordCount ?? 0) > 0) {
        setStep("ps_why");
        setHighestStep("ps_why");
        setResuming(true);
      } else if ((purposeCount ?? 0) > 0) {
        setStep("missing_member");
        setHighestStep("missing_member");
        setResuming(true);
      } else if (
        memberData.primary_language !== null ||
        memberData.personal_context !== null
      ) {
        setStep("purpose");
        setHighestStep("purpose");
        setResuming(true);
      }

      if (memberData.status !== "complete") {
        await supabase
          .from("members")
          .update({ status: "in_progress" })
          .eq("member_id", memberData.member_id);
      }

      setLoading(false);
    }

    load();
  }, [memberIdParam, supabase]);

  function applyMemberFields(fields: Partial<Member>) {
    setMember((prev) => (prev ? { ...prev, ...fields } : prev));
  }

  function updateDraft(fields: Partial<InterviewDraft>) {
    setDraft((prev) => ({ ...prev, ...fields }));
  }

  // Persist a members-table field and optimistically reflect it locally. Used by
  // the free-text steps (own_role, ps_importance, team_name suggestion) that
  // persist on advance rather than owning their own supabase writes.
  async function persistMemberField(fields: Partial<Member>) {
    if (!member) return;
    applyMemberFields(fields);
    const { error } = await supabase
      .from("members")
      .update(fields)
      .eq("member_id", member.member_id);
    if (error) {
      console.error("[interview] failed to persist member field:", {
        fields: Object.keys(fields),
        message: error.message,
        code: error.code,
      });
    }
  }

  function goToStep(next: InterviewStep) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStep(next);
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

  function toggleReadAloud() {
    setReadAloud((prev) => {
      const next = !prev;
      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }

  if (notFound) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-[var(--color-grey)]">
          We couldn&apos;t find your interview link. Please check the link
          your consultant sent you.
        </p>
      </main>
    );
  }

  if (loading || !member || !team) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
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
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
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

  const otherMembers = allMembers.filter((m) => m.member_id !== member.member_id);
  const smallTeam = allMembers.length < 5;
  const fullBleed = FULL_BLEED_STEPS.includes(step);
  const showBack = !NO_BACK_STEPS.includes(step);

  return (
    <main
      className="flex-1 flex flex-col items-center relative"
      data-member-id={member.member_id}
      data-team-id={team.team_id}
    >
      {/* Section tint overlay — fades between sections */}
      <div
        className="fixed inset-0 pointer-events-none transition-colors duration-700"
        style={{ background: getSectionOverlay(step) }}
      />

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

      <div
        className={`relative z-10 ${fullBleed ? "w-full" : "w-full max-w-5xl px-6 pb-20"}`}
      >
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
            supabase={supabase}
            readAloud={readAloud}
            onSaved={applyMemberFields}
            onAdvance={() => goToStep("personal_context")}
          />
        )}

        {step === "personal_context" && (
          <PersonalContextStep
            member={member}
            supabase={supabase}
            readAloud={readAloud}
            language={draft.personalLanguage}
            onLanguageChange={(v) => updateDraft({ personalLanguage: v })}
            context={draft.personalContext}
            onContextChange={(v) => updateDraft({ personalContext: v })}
            genderIdentity={draft.genderIdentity}
            onGenderIdentityChange={(v) => updateDraft({ genderIdentity: v })}
            ethnicityCultural={draft.ethnicityCultural}
            onEthnicityCulturalChange={(v) => updateDraft({ ethnicityCultural: v })}
            ageText={draft.ageText}
            onAgeTextChange={(v) => updateDraft({ ageText: v })}
            onSaved={applyMemberFields}
            onAdvance={() => goToStep("purpose")}
          />
        )}

        {step === "purpose" && (
          <PurposeStep
            member={member}
            team={team}
            allMembers={allMembers}
            supabase={supabase}
            readAloud={readAloud}
            text={draft.purposeText}
            onTextChange={(v) => updateDraft({ purposeText: v })}
            onAdvance={() => goToStep("team_name")}
          />
        )}

        {step === "team_name" && (
          <TeamNameStep
            member={member}
            allMembers={allMembers}
            readAloud={readAloud}
            teamNameText={draft.teamNameText}
            onTeamNameTextChange={(v) => updateDraft({ teamNameText: v })}
            onAdvance={() => {
              persistMemberField({ team_name_suggestion: draft.teamNameText.trim() || null });
              goToStep("missing_member");
            }}
          />
        )}

        {step === "missing_member" && (
          <MissingMemberStep
            member={member}
            team={team}
            allMembers={allMembers}
            supabase={supabase}
            readAloud={readAloud}
            teamNameText={draft.teamNameText}
            showMissingField={draft.rosterShowMissingField}
            onShowMissingFieldChange={(v) => updateDraft({ rosterShowMissingField: v })}
            missingName={draft.rosterMissingName}
            onMissingNameChange={(v) => updateDraft({ rosterMissingName: v })}
            missingRole={draft.rosterMissingRole}
            onMissingRoleChange={(v) => updateDraft({ rosterMissingRole: v })}
            noted={draft.rosterNoted}
            onNotedChange={(v) => updateDraft({ rosterNoted: v })}
            onAdvance={() => goToStep("own_role")}
          />
        )}

        {step === "own_role" && (
          <OwnRoleStep
            readAloud={readAloud}
            text={draft.ownRoleText}
            onTextChange={(v) => updateDraft({ ownRoleText: v })}
            onAdvance={() => {
              persistMemberField({ own_role: draft.ownRoleText.trim() || null });
              goToStep("coordination");
            }}
          />
        )}

        {step === "coordination" && (
          <CoordinationStep
            member={member}
            team={team}
            otherMembers={otherMembers}
            supabase={supabase}
            readAloud={readAloud}
            ratings={draft.coordRatings}
            onRatingsChange={(v) => updateDraft({ coordRatings: v })}
            onAdvance={() => goToStep("ps_why")}
          />
        )}

        {step === "ps_why" && (
          <PsWhyStep
            member={member}
            readAloud={readAloud}
            onAdvance={() => goToStep("consent")}
          />
        )}

        {step === "consent" && (
          <ConsentStep
            member={member}
            smallTeam={smallTeam}
            supabase={supabase}
            readAloud={readAloud}
            onSaved={applyMemberFields}
            onAdvance={() => goToStep("faq")}
          />
        )}

        {step === "faq" && (
          <FaqStep
            member={member}
            team={team}
            supabase={supabase}
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
            team={team}
            statements={psStatements}
            supabase={supabase}
            readAloud={readAloud}
            ratings={draft.psRatings}
            onRatingsChange={(v) => updateDraft({ psRatings: v })}
            onAdvance={() => goToStep("ps_importance")}
          />
        )}

        {step === "ps_importance" && (
          <PsImportanceStep
            readAloud={readAloud}
            text={draft.psImportanceText}
            onTextChange={(v) => updateDraft({ psImportanceText: v })}
            onAdvance={() => {
              persistMemberField({ ps_importance: draft.psImportanceText.trim() || null });
              goToStep("what_happens_next");
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
            rosterMissingName={draft.rosterMissingName}
            rosterMissingRole={draft.rosterMissingRole}
            rosterNoted={draft.rosterNoted}
            ownRoleText={draft.ownRoleText}
            psImportanceText={draft.psImportanceText}
            readAloud={readAloud}
            supabase={supabase}
            onSaved={applyMemberFields}
            onAdvance={() => goToStep("close")}
          />
        )}

        {step === "close" && (
          <CloseStep
            member={member}
            supabase={supabase}
            onSaved={applyMemberFields}
            onFinish={() => goToStep("already_complete")}
          />
        )}

        {step === "already_complete" && (
          <AlreadyCompleteStep
            member={member}
            team={team}
            supabase={supabase}
            psStatements={psStatements}
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
  );
}
