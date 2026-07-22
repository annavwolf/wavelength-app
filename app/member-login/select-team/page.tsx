"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = {
  team_id: string;
  team_name: string;
  display_name: string;
};

// Shown only when one email is on members in several teams. Rather than silently
// picking one, we ask which team the person is signing in as.
export default function SelectTeamPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/member/auth/select")
      .then(async (res) => {
        if (!res.ok) {
          setError("Your sign-in has expired. Please request a new link.");
          setCandidates([]);
          return;
        }
        const data = await res.json();
        setCandidates(data.candidates ?? []);
      })
      .catch(() => {
        setError("Something went wrong. Please request a new link.");
        setCandidates([]);
      });
  }, []);

  async function choose(teamId: string) {
    setChoosing(teamId);
    setError(null);
    try {
      const res = await fetch("/api/member/auth/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      if (!res.ok) {
        setError("Couldn't sign you in to that team. Please try again.");
        setChoosing(null);
        return;
      }
      router.push("/me");
    } catch {
      setError("Something went wrong. Please try again.");
      setChoosing(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <h1
        className="text-3xl font-serif mb-3 text-center"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        Which team?
      </h1>
      <p className="accent text-lg text-center mb-8">
        Your email is on more than one team. Pick the one you&apos;re signing in for.
      </p>

      <div className="card w-full max-w-sm space-y-3">
        {candidates === null && (
          <p className="text-sm text-[var(--color-grey)]">Loading your teams…</p>
        )}

        {error && (
          <p className="text-sm text-[var(--color-safety-red)]">{error}</p>
        )}

        {candidates?.map((c) => (
          <button
            key={c.team_id}
            type="button"
            disabled={choosing !== null}
            onClick={() => choose(c.team_id)}
            className="btn-secondary w-full text-left"
            style={{ textAlign: "left" }}
          >
            <span style={{ fontWeight: 600 }}>{c.team_name}</span>
            <br />
            <span className="text-sm text-[var(--color-grey)]">
              as {c.display_name}
            </span>
          </button>
        ))}

        {candidates?.length === 0 && !error && (
          <p className="text-sm text-[var(--color-grey)]">
            No teams to choose from.{" "}
            <a href="/member-login" className="underline">
              Request a new link
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
