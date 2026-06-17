"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Team } from "@/types/database";

function formatVirtuality(level: Team["virtuality_level"]) {
  switch (level) {
    case "fully_remote":
      return "Fully remote";
    case "hybrid":
      return "Hybrid";
    case "mostly_in_person":
      return "Mostly in-person";
    default:
      return null;
  }
}

function statusPillClasses(status: string) {
  switch (status) {
    case "setup":
      return "status-setup";
    case "collecting":
      return "status-collecting";
    case "complete":
      return "status-complete";
    default:
      return "bg-gray-300 text-[var(--color-ink)] rounded-full px-3 py-1 text-xs";
  }
}

export default function Home() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error("[dashboard] getSession error:", sessionError);
      }

      const consultantId = sessionData.session?.user.id;
      if (!consultantId) {
        // AuthGate should have already redirected to /login in this case,
        // but bail out defensively rather than fetching every team.
        console.error("[dashboard] no logged-in user — skipping team fetch");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("consultant_id", consultantId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[dashboard] failed to load teams:", error);
      } else if (data) {
        setTeams(data);
      }
      setLoading(false);
    }

    loadTeams();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-24 text-center">
      <div className="w-full max-w-2xl flex justify-end -mt-12 mb-12">
        <button
          onClick={handleSignOut}
          className="text-sm text-[var(--color-grey)]"
        >
          Sign out
        </button>
      </div>

      <h1 className="text-4xl sm:text-5xl leading-tight max-w-2xl">
        Welcome back. Let&apos;s tune into your{" "}
        <span className="accent">team.</span>
      </h1>

      <p className="accent text-xl mt-6">
        My aim is to help your team build psychological safety.
      </p>

      <p className="mt-6 max-w-[480px] text-[var(--color-grey)]">
        I&apos;m Wavelength. When you&apos;re ready, set up a new team and
        I&apos;ll guide you through a calm, private assessment.
      </p>

      <button
        className="btn-primary mt-10"
        onClick={() => router.push("/teams/new")}
      >
        Create a new team
      </button>

      {loading && (
        <p className="mt-16 text-[var(--color-grey)]">
          Looking up your teams...
        </p>
      )}

      {!loading && teams.length > 0 && (
        <section className="mt-20 w-full max-w-2xl text-left">
          <h2 className="text-2xl mb-4">Your teams</h2>
          <div className="space-y-4">
            {teams.map((team) => (
              <div
                key={team.team_id}
                className="card flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="text-lg font-semibold">{team.team_name}</h3>
                  <p className="text-sm text-[var(--color-grey)] mt-1">
                    {[team.industry, formatVirtuality(team.virtuality_level)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={statusPillClasses(team.status)}>
                    {team.status}
                  </span>
                  <button
                    onClick={() => router.push(`/teams/${team.team_id}`)}
                    className="btn-secondary"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
