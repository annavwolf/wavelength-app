"use client";

import Link from "next/link";
import ChatBubble from "@/components/interview/ChatBubble";
import type { Member, Team } from "@/types/database";

// A completion state should not re-query the database from the browser or
// re-open legacy identity/verbatim choices. The participant can sign in later
// to review their own data and change their current privacy setting.
export default function AlreadyCompleteStep({ member, team }: { member: Member; team: Team }) {
  const firstName = member.display_name?.split(" ")[0] || "there";
  return (
    <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
      <img src="/octopus-logo.png" alt="" aria-hidden className="otis-float h-24 w-auto mx-auto" />
      <ChatBubble hideAvatar centered>
        Thank you, {firstName}. Your assessment for {team.team_name} has been submitted.
      </ChatBubble>
      <p className="text-sm text-[var(--color-grey)] leading-relaxed">
        You can return to your member area at any time to view your own contribution, update your privacy choices, or request withdrawal.
      </p>
      <Link href="/me" className="btn-primary inline-block">Go to my member area</Link>
    </div>
  );
}
