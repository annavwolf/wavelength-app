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
import BackButton from "@/components/interview/BackButton";
import ReadAloudToggle from "@/components/interview/ReadAloudToggle";
import LandingStep from "@/components/interview/steps/LandingStep";
import ForeshadowStep from "@/components/interview/steps/ForeshadowStep";
import ConsentStep from "@/components/interview/steps/ConsentStep";
import ProfileStep from "@/components/interview/steps/ProfileStep";
import PersonalContextStep from "@/components/interview/steps/PersonalContextStep";
import PurposeStep from "@/components/interview/steps/PurposeStep";
import RosterStep from "@/components/interview/steps/RosterStep";
import CoordinationStep from "@/components/interview/steps/CoordinationStep";
import PsIntroStep from "@/components/interview/steps/PsIntroStep";
import PsFrameStep from "@/components/interview/steps/PsFrameStep";
import PsDiagnosticStep from "@/components/interview/steps/PsDiagnosticStep";
import PsReflectStep from "@/components/interview/steps/PsReflectStep";
import EndOfPass1Step from "@/components/interview/steps/EndOfPass1Step";

// Linear order this pass moves through — used both for the back button and
// the progress bar. Going back is just stepping backward through this list;
// there's no branching yet.
const STEP_ORDER: InterviewStep[] = [
  "landing",
  "foreshadow",
  "consent",
  "profile",
  "personal_context",
  "purpose",
  "roster",
  "coordination",
  "ps_intro",
  "ps_frame",
  "ps_diagnostic",
  "ps_reflect",
  "end_of_pass1",
];

// ps_diagnostic breaks out of the centred max-w-2xl column to go full-bleed
// (the ocean background needs the full viewport width to feel right).
const FULL_BLEED_STEPS: InterviewStep[] = ["ps_intro", "ps_diagnostic"];

// Draft state for steps whose input shouldn't be lost if the member goes
// back and then forward again. Step components stay mount/unmount
// (conditionally rendered) so ChatBubble's read-aloud-on-mount behaviour
// keeps working — the data that needs to survive that unmount lives here
// instead of inside the step component.
type InterviewDraft = {
  purposeText: string;
  personalLanguage: string;
  personalContext: string;
  rosterShowMissingField: boolean;
  rosterMissingName: string;
  rosterMissingRole: string;
  rosterNoted: boolean;
  coordRatings: Record<string, CoordinationFrequency>;
  coordRowIds: Record<string, string>;
  psRatings: Record<number, PsLabel>;
};

const INITIAL_DRAFT: InterviewDraft = {
  purposeText: "",
  personalLanguage: "",
  personalContext: "",
  rosterShowMissingField: false,
  rosterMissingName: "",
  rosterMissingRole: "",
  rosterNoted: false,
  coordRatings: {},
  coordRowIds: {},
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
      ]);

      if (teamError) {
        console.error("[interview] failed to load team:", teamError);
      }
      if (membersError) {
        console.error("[interview] failed to load team roster:", membersError);
      }
      if (statementsError) {
        console.error(
          "[interview] failed to load ps_statements:",
          statementsError
        );
      }

      setMember(memberData);
      setTeam(teamData ?? null);
      setAllMembers(membersData ?? []);
      setPsStatements(statementsData ?? []);

      const { error: updateError } = await supabase
        .from("members")
        .update({ status: "in_progress" })
        .eq("member_id", memberData.member_id);

      if (updateError) {
        console.error("[interview] failed to mark member in_progress:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
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

  // Centralised navigation so speech doesn't talk over itself across a
  // step change, whichever direction it happens.
  function goToStep(next: InterviewStep) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStep(next);
  }

  function goBack() {
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) {
      goToStep(STEP_ORDER[index - 1]);
    }
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
        <img
          src="/octopus-logo.png"
          alt=""
          className="h-20 w-auto mx-auto mb-8"
        />

        <h1
          className="text-4xl font-serif mb-2 text-center"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Hello, I&apos;m <span className="purple">Wavelength.</span>
        </h1>

        <p className="accent text-lg text-center mb-8">
          I&apos;m here to learn about your team.
        </p>

        <p className="text-[var(--color-grey)]">Loading your session...</p>
      </main>
    );
  }

  const otherMembers = allMembers.filter(
    (m) => m.member_id !== member.member_id
  );
  const smallTeam = allMembers.length < 5;
  const fullBleed = FULL_BLEED_STEPS.includes(step);

  return (
    <main
      className="flex-1 flex flex-col items-center"
      data-member-id={member.member_id}
      data-team-id={team.team_id}
    >
      <div className="w-full max-w-2xl px-6 pt-16">
        <div className="flex items-center justify-between mb-2">
          {step !== "landing" ? <BackButton onBack={goBack} /> : <span />}
          <ReadAloudToggle enabled={readAloud} onToggle={toggleReadAloud} />
        </div>

        <ProgressBar step={step} />
      </div>

      <div className={fullBleed ? "w-full" : "w-full max-w-2xl px-6 pb-16"}>
        {step === "landing" && (
          <LandingStep
            readAloud={readAloud}
            onAdvance={() => goToStep("foreshadow")}
          />
        )}

        {step === "foreshadow" && (
          <ForeshadowStep
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
            onLanguageChange={(value) =>
              updateDraft({ personalLanguage: value })
            }
            context={draft.personalContext}
            onContextChange={(value) => updateDraft({ personalContext: value })}
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
            onTextChange={(value) => updateDraft({ purposeText: value })}
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
            showMissingField={draft.rosterShowMissingField}
            onShowMissingFieldChange={(value) =>
              updateDraft({ rosterShowMissingField: value })
            }
            missingName={draft.rosterMissingName}
            onMissingNameChange={(value) =>
              updateDraft({ rosterMissingName: value })
            }
            missingRole={draft.rosterMissingRole}
            onMissingRoleChange={(value) =>
              updateDraft({ rosterMissingRole: value })
            }
            noted={draft.rosterNoted}
            onNotedChange={(value) => updateDraft({ rosterNoted: value })}
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
            onRatingsChange={(ratings) => updateDraft({ coordRatings: ratings })}
            rowIds={draft.coordRowIds}
            onRowIdsChange={(rowIds) => updateDraft({ coordRowIds: rowIds })}
            onAdvance={() => goToStep("ps_intro")}
          />
        )}

        {step === "ps_intro" && (
          <PsIntroStep
            readAloud={readAloud}
            onAdvance={() => goToStep("ps_frame")}
          />
        )}

        {step === "ps_frame" && (
          <PsFrameStep
            readAloud={readAloud}
            onAdvance={() => goToStep("ps_diagnostic")}
          />
        )}

        {step === "ps_diagnostic" && (
          <PsDiagnosticStep
            member={member}
            team={team}
            statements={psStatements}
            supabase={supabase}
            ratings={draft.psRatings}
            onRatingsChange={(ratings) => updateDraft({ psRatings: ratings })}
            onAdvance={() => goToStep("ps_reflect")}
          />
        )}

        {step === "ps_reflect" && (
          <PsReflectStep
            member={member}
            team={team}
            statements={psStatements}
            ratings={draft.psRatings}
            supabase={supabase}
            readAloud={readAloud}
            onAdvance={() => goToStep("end_of_pass1")}
          />
        )}

        {step === "end_of_pass1" && <EndOfPass1Step readAloud={readAloud} />}
      </div>
    </main>
  );
}
