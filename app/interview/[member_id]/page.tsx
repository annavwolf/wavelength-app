"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Member, Team } from "@/types/database";
import type { InterviewStep } from "@/components/interview/types";
import ProgressBar from "@/components/interview/ProgressBar";
import LandingStep from "@/components/interview/steps/LandingStep";
import ForeshadowStep from "@/components/interview/steps/ForeshadowStep";
import ConsentStep from "@/components/interview/steps/ConsentStep";
import ProfileStep from "@/components/interview/steps/ProfileStep";
import PurposeStep from "@/components/interview/steps/PurposeStep";
import RosterStep from "@/components/interview/steps/RosterStep";
import CoordinationStep from "@/components/interview/steps/CoordinationStep";
import EndOfPass1Step from "@/components/interview/steps/EndOfPass1Step";

// Public page — members reach this via their private link, not a Wavelength
// account. Must NOT be wrapped by AuthGate (see components/AuthGate.tsx).
export default function InterviewPage() {
  const { member_id: memberIdParam } = useParams<{ member_id: string }>();
  const [supabase] = useState(() => createBrowserClient());

  const [member, setMember] = useState<Member | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);

  const [step, setStep] = useState<InterviewStep>("landing");
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
      ]);

      if (teamError) {
        console.error("[interview] failed to load team:", teamError);
      }
      if (membersError) {
        console.error("[interview] failed to load team roster:", membersError);
      }

      setMember(memberData);
      setTeam(teamData ?? null);
      setAllMembers(membersData ?? []);

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
          src="/logo-octopus.png"
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

  return (
    <main
      className="flex-1 flex flex-col items-center px-6 py-16"
      data-member-id={member.member_id}
      data-team-id={team.team_id}
    >
      <div className="w-full max-w-2xl">
        <ProgressBar step={step} />

        {step === "landing" && (
          <LandingStep onAdvance={() => setStep("foreshadow")} />
        )}

        {step === "foreshadow" && (
          <ForeshadowStep onAdvance={() => setStep("consent")} />
        )}

        {step === "consent" && (
          <ConsentStep
            member={member}
            smallTeam={smallTeam}
            supabase={supabase}
            onSaved={applyMemberFields}
            onAdvance={() => setStep("profile")}
          />
        )}

        {step === "profile" && (
          <ProfileStep
            member={member}
            supabase={supabase}
            onSaved={applyMemberFields}
            onAdvance={() => setStep("purpose")}
          />
        )}

        {step === "purpose" && (
          <PurposeStep
            member={member}
            team={team}
            supabase={supabase}
            onAdvance={() => setStep("roster")}
          />
        )}

        {step === "roster" && (
          <RosterStep
            member={member}
            allMembers={allMembers}
            onAdvance={() => setStep("coordination")}
          />
        )}

        {step === "coordination" && (
          <CoordinationStep
            member={member}
            team={team}
            otherMembers={otherMembers}
            supabase={supabase}
            onAdvance={() => setStep("end_of_pass1")}
          />
        )}

        {step === "end_of_pass1" && <EndOfPass1Step />}
      </div>
    </main>
  );
}
