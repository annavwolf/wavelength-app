"use client";

// Persistent member navigation. Two controls:
//   • the team hub (labelled with the team's name) → /me
//   • "My Teams" (the team picker) → /member-login/select-team
// Shown on the member hub and its sub-pages so a member can always get back to
// their team's results/pre-workshop and to their full list of teams.

import Link from "next/link";

export default function MemberNav({
  teamName,
  showTeamLink = true,
}: {
  teamName?: string | null;
  showTeamLink?: boolean;
}) {
  return (
    <nav className="w-full flex items-center justify-between gap-4 mb-6">
      {showTeamLink ? (
        <Link
          href="/me"
          className="text-sm font-medium text-[var(--color-grey)] hover:text-[var(--color-ink)] transition-colors"
        >
          ← {teamName || "My profile"}
        </Link>
      ) : (
        <span />
      )}
      <Link
        href="/me"
        className="text-sm font-medium px-4 py-1.5 rounded-full border border-black/15 text-[var(--color-grey)] hover:border-[var(--color-purple)] hover:text-[var(--color-purple)] transition-colors whitespace-nowrap"
      >
        My team
      </Link>
    </nav>
  );
}
