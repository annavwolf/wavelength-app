"use client";

// Persistent member navigation. It is shown at the top of member-facing pages
// so someone can leave an activity without submitting, withdrawing, or losing
// anything that has already been saved.

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
          aria-label={`Leave this activity and return to ${teamName ? `${teamName} profile` : "your profile"}`}
        >
          ← Back to your profile
        </Link>
      ) : (
        <span />
      )}
      <a
        href="mailto:contact@wavelength.team?subject=Otis%20member%20support"
        className="text-sm font-medium text-[var(--color-grey)] hover:text-[var(--color-purple)] transition-colors"
      >
        Support
      </a>
    </nav>
  );
}
