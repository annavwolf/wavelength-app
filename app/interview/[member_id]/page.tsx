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
import { selectProbeItems } from "@/lib/psSelection";
import type { InterviewStep } from "@/components/interview/types";
import ProgressBar from "@/components/interview/ProgressBar";
import BackButton from "@/components/interview/BackButton";
import ReadAloudToggle from "@/components/interview/ReadAloudToggle";
import LandingStep from "@/components/interview/steps/LandingStep";
import ForeshadowStep from "@/components/interview/steps/ForeshadowStep";
import FaqStep from "@/components/interview/steps/FaqStep";
import ConsentStep from "@/components/interview/steps/ConsentStep";
import ProfileStep from "@/components/interview/steps/ProfileStep";
import PersonalContextStep from "@/components/interview/steps/PersonalContextStep";
import PurposeStep from "@/components/interview/steps/PurposeStep";
import RosterStep from "@/components/interview/steps/RosterStep";
import CoordinationStep from "@/components/interview/steps/CoordinationStep";
import PsIntroOpenStep from "@/components/interview/steps/PsIntroOpenStep";
import PsDescentStep from "@/components/interview/steps/PsDescentStep";
import PsIntroCloseStep from "@/components/interview/steps/PsIntroCloseStep";
import PsFrameStep from "@/components/interview/steps/PsFrameStep";
import PsDiagnosticStep from "@/components/interview/steps/PsDiagnosticStep";
import PsInterviewStep from "@/components/interview/steps/PsInterviewStep";
import ReviewStep from "@/components/interview/steps/ReviewStep";
import CloseStep from "@/components/interview/steps/CloseStep";
import AlreadyCompleteStep from "@/components/interview/steps/AlreadyCompleteStep";

// landing → foreshadow → faq → consent → profile → personal_context →
// purpose → roster → coordination → ps_intro_open → ps_descent →
// ps_intro_close → ps_frame → ps_diagnostic → ps_interview → review → close
const STEP_ORDER: InterviewStep[] = [
  "landing",
  "foreshadow",
  "faq",
  "consent",
  "profile",
  "personal_context",
  "purpose",
  "roster",
  "coordination",
  "ps_intro_open",
  "ps_descent",
  "ps_intro_close",
  "ps_frame",
  "ps_diagnostic",
  "ps_interview",
  "review",
  "close",
  "already_complete",
];

// Steps that need full viewport width — only the ocean-background diagnostic.
const FULL_BLEED_STEPS: InterviewStep[] = ["ps_diagnostic"];

// Steps where the back button is hidden (start and terminal).
const NO_BACK_STEPS: InterviewStep[] = ["landing", "close", "already_complete"];

// All input state that must survive back/forward navigation lives here
// rather than in individual step components (which unmount on step change).
type InterviewDraft = {
  // faq
  faqQuestion: string;
  faqAcknowledged: boolean;
  // personal context
  personalLanguage: string;
  personalContext: string;
  genderIdentity: string;
  ethnicityCultural: string;
  ageText: string;
  // purpose
  purposeText: string;
  // roster
  rosterTenureStart: string;
  rosterTenureSaved: boolean;
  rosterShowMissingField: boolean;
  rosterMissingName: string;
  rosterMissingRole: string;
  rosterNoted: boolean;
  // coordination
  coordRatings: Record<string, CoordinationFrequency>;
  // ps diagnostic
  psRatings: Record<number, PsLabel>;
  // Note: the ps_interview step manages its own conversation state internally
  // and persists directly to ps_interview_responses — nothing to hold here.
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
  rosterTenureStart: "",
  rosterTenureSaved: false,
  rosterShowMissingField: false,
  rosterMissingName: "",
  rosterMissingRole: "",
  rosterNoted: false,
  coordRatings: {},
  psRatings: {},
};

// Public page — members reach this via their private link, not a Wavelength
// account. Must NOT be wrapped by AuthGate (see components/AuthGate.tsx).
export default function InterviewPage() {
  const { member_id: memberIdParam } = useParams<{ member_id: string }>();
  const [supabase] = useState(() => createBrowserClient());

  const [member, setMember] = useState<Member | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [psStatements, setPsStatements] = useState<PsStatement[]>([]);

  const [step, setStep] = useState<InterviewStep>("landing");
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
        { data: teamData, error: teamError },
        { data: membersData, error: membersError },
        { data: statementsData, error: statementsError },
        { data: psResponsesData },
        { count: purposeCount },
        { count: interviewCount },
        { count: coordCount },
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("*")
          .eq("team_id", memberData.team_id)
          .single(),
        supabase
          .from("members")
          .select("*")
          .eq("team_id", memberData.team_id)
          .order("created_at", { ascending: true }),
        supabase
          .from("ps_statements")
          .select("*")
          .order("statement_id", { ascending: true }),
        // Actual round-1 rows (not just a count) so we can recompute item
        // selection deterministically on resume.
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
          .from("ps_interview_responses")
          .select("*", { count: "exact", head: true })
          .eq("member_id", memberData.member_id),
        supabase
          .from("coordination_ratings")
          .select("*", { count: "exact", head: true })
          .eq("member_id", memberData.member_id),
      ]);

      if (teamError) console.error("[interview] team load failed:", teamError);
      if (membersError) console.error("[interview] roster load failed:", membersError);
      if (statementsError) console.error("[interview] ps_statements load failed:", statementsError);

      const statements = statementsData ?? [];
      setMember(memberData);
      setTeam(teamData ?? null);
      setAllMembers(membersData ?? []);
      setPsStatements(statements);

      const psCount = psResponsesData?.length ?? 0;
      const allRated = statements.length > 0 && psCount === statements.length;

      // Resume at the right step based on what's already saved in the DB (§7).
      if (memberData.status === "complete") {
        setStep("already_complete");
      } else if (allRated) {
        // Diagnostic done — decide between the interview and review by
        // recomputing which items would be probed (same logic the step uses).
        const ratingsMap: Record<number, PsLabel> = {};
        for (const row of psResponsesData ?? []) {
          ratingsMap[row.statement_id] = row.label as PsLabel;
        }
        const sel = selectProbeItems(statements, ratingsMap);
        const selectedCount = sel.allPositive ? 1 : sel.items.length;
        if ((interviewCount ?? 0) >= selectedCount) {
          setStep("review");
        } else {
          setStep("ps_interview");
        }
        setResuming(true);
      } else if (psCount > 0) {
        // Mid-diagnostic — PsDiagnosticStep prefills the saved ratings.
        setStep("ps_diagnostic");
        setResuming(true);
      } else if ((purposeCount ?? 0) > 0 || (coordCount ?? 0) > 0) {
        setStep("ps_intro_open");
        setResuming(true);
      } else if ((memberData.share_verbatim_with_team as boolean | null) !== null) {
        setStep("purpose");
        setResuming(true);
      } else if (
        memberData.primary_language !== null ||
        memberData.personal_context !== null
      ) {
        setStep("roster");
        setResuming(true);
      }
      // else: default "landing" step stays

      // Mark in progress only when the interview is actively underway.
      if (memberData.status !== "complete") {
        const { error: statusError } = await supabase
          .from("members")
          .update({ status: "in_progress" })
          .eq("member_id", memberData.member_id);
        if (statusError) {
          console.error("[interview] failed to mark in_progress:", {
            message: statusError.message,
            details: statusError.details,
            hint: statusError.hint,
            code: statusError.code,
          });
        }
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

  function goToStep(next: InterviewStep) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStep(next);
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
        <h1
          className="text-4xl font-serif mb-2"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Hello, I&apos;m <span className="purple">Otis.</span>
        </h1>
        <p className="accent text-lg mb-8">I&apos;m here to learn about your team.</p>
        <p className="text-[var(--color-grey)]">Loading your session...</p>
      </main>
    );
  }

  const otherMembers = allMembers.filter((m) => m.member_id !== member.member_id);
  const smallTeam = allMembers.length < 5;
  const fullBleed = FULL_BLEED_STEPS.includes(step);
  const showBack = !NO_BACK_STEPS.includes(step);

  return (
    <main
      className="flex-1 flex flex-col items-center"
      data-member-id={member.member_id}
      data-team-id={team.team_id}
    >
      <div className="w-full max-w-2xl px-6 pt-16">
        <div className="flex items-center justify-between mb-2">
          {showBack ? <BackButton onBack={goBack} /> : <span />}
          <ReadAloudToggle enabled={readAloud} onToggle={toggleReadAloud} />
        </div>
        <ProgressBar step={step} />
      </div>

      {resuming && (
        <div className="w-full max-w-2xl px-6 pt-4">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--color-purple)]/8 border border-[var(--color-purple)]/20 px-4 py-3">
            <p className="text-sm text-[var(--color-purple)]">
              Welcome back. I&apos;ve saved your progress — picking up where we left off.
            </p>
            <button
              type="button"
              onClick={() => setResuming(false)}
              className="text-[var(--color-purple)] text-lg leading-none flex-shrink-0"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className={fullBleed ? "w-full" : "w-full max-w-2xl px-6 pb-16"}>
        {step === "landing" && (
          <LandingStep readAloud={readAloud} onAdvance={() => goToStep("foreshadow")} />
        )}

        {step === "foreshadow" && (
          <ForeshadowStep readAloud={readAloud} onAdvance={() => goToStep("faq")} />
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
            supabase={supabase}
            readAloud={readAloud}
            text={draft.purposeText}
            onTextChange={(v) => updateDraft({ purposeText: v })}
            onAdvance={() => goToStep("roster")}
          />
        )}

        {step === "roster" && (
          <RosterStep
            member={member}
            team={team}
            allMembers={allMembers}
            supabase={supabase}
            readAloud={readAloud}
            tenureStart={draft.rosterTenureStart}
            onTenureStartChange={(v) => updateDraft({ rosterTenureStart: v })}
            tenureSaved={draft.rosterTenureSaved}
            onTenureSaved={() => updateDraft({ rosterTenureSaved: true })}
            showMissingField={draft.rosterShowMissingField}
            onShowMissingFieldChange={(v) => updateDraft({ rosterShowMissingField: v })}
            missingName={draft.rosterMissingName}
            onMissingNameChange={(v) => updateDraft({ rosterMissingName: v })}
            missingRole={draft.rosterMissingRole}
            onMissingRoleChange={(v) => updateDraft({ rosterMissingRole: v })}
            noted={draft.rosterNoted}
            onNotedChange={(v) => updateDraft({ rosterNoted: v })}
            onSaved={applyMemberFields}
            onAdvance={() => goToStep("coordination")}
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
            onAdvance={() => goToStep("ps_intro_open")}
          />
        )}

        {step === "ps_intro_open" && (
          <PsIntroOpenStep readAloud={readAloud} onAdvance={() => goToStep("ps_descent")} />
        )}

        {step === "ps_descent" && (
          <PsDescentStep readAloud={readAloud} onAdvance={() => goToStep("ps_intro_close")} />
        )}

        {step === "ps_intro_close" && (
          <PsIntroCloseStep readAloud={readAloud} onAdvance={() => goToStep("ps_frame")} />
        )}

        {step === "ps_frame" && (
          <PsFrameStep readAloud={readAloud} onAdvance={() => goToStep("ps_diagnostic")} />
        )}

        {step === "ps_diagnostic" && (
          <PsDiagnosticStep
            member={member}
            team={team}
            statements={psStatements}
            supabase={supabase}
            ratings={draft.psRatings}
            onRatingsChange={(v) => updateDraft({ psRatings: v })}
            onAdvance={() => goToStep("ps_interview")}
          />
        )}

        {step === "ps_interview" && (
          <PsInterviewStep
            member={member}
            team={team}
            statements={psStatements}
            supabase={supabase}
            ratings={draft.psRatings}
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
            supabase={supabase}
            psStatements={psStatements}
          />
        )}
      </div>
    </main>
  );
}
