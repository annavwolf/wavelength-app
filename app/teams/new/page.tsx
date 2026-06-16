"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type { VirtualityLevel } from "@/types/database";

export default function NewTeamPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());
  const [teamName, setTeamName] = useState("");
  const [industry, setIndustry] = useState("");
  const [virtualityLevel, setVirtualityLevel] = useState<VirtualityLevel | "">(
    ""
  );
  const [timezones, setTimezones] = useState("");
  const [rosterSize, setRosterSize] = useState("");
  const [knownSensitivities, setKnownSensitivities] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    console.log("[teams/new] session before insert:", sessionData.session);
    if (sessionError) {
      console.error("[teams/new] getSession error:", sessionError);
    }

    const consultantId = sessionData.session?.user.id;
    if (!consultantId) {
      console.error(
        "[teams/new] no logged-in user — aborting insert before it can fail on a null consultant_id"
      );
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    // teams.consultant_id has a foreign key into consultants, but nothing
    // creates that row on signup. Without this upsert, every first-time
    // team save fails with a 23503 foreign key violation ("not present in
    // table consultants") rather than anything RLS-related. Upsert here so
    // the row exists by the time the teams insert below runs.
    const { error: consultantError } = await supabase
      .from("consultants")
      .upsert(
        {
          consultant_id: consultantId,
          email: sessionData.session?.user.email ?? null,
        },
        { onConflict: "consultant_id" }
      );

    if (consultantError) {
      console.error(
        "[teams/new] failed to upsert consultants row:",
        consultantError
      );
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    const insertPayload = {
      team_name: teamName,
      industry: industry || null,
      virtuality_level: virtualityLevel || null,
      timezones: timezones || null,
      roster_size: rosterSize ? parseInt(rosterSize, 10) : null,
      known_sensitivities: knownSensitivities || null,
      consultant_id: consultantId,
    };
    console.log("[teams/new] insert payload:", insertPayload);

    const { data, error } = await supabase
      .from("teams")
      .insert(insertPayload)
      .select("team_id")
      .single();

    if (error || !data) {
      console.error("[teams/new] insert into teams failed:", error);
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push(`/teams/${data.team_id}/members`);
  }

  return (
    <div className="px-6 py-12">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-[var(--color-grey)]">
          ← Back
        </Link>

        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">
          Let&apos;s set up your <span className="accent">team.</span>
        </h1>

        <p className="accent text-xl mt-6">
          Tell me a little about who you&apos;re bringing in.
        </p>

        <p className="mt-4 text-[var(--color-grey)]">
          You can change any of this later.
        </p>

        <form onSubmit={handleSubmit} className="mt-12 space-y-6">
          <div>
            <label className="form-label">Team name</label>
            <input
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Industry</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. fintech, healthcare, education"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">How does this team work?</label>
            <select
              required
              value={virtualityLevel}
              onChange={(e) =>
                setVirtualityLevel(e.target.value as VirtualityLevel)
              }
              className="form-input"
            >
              <option value="" disabled>
                Select one
              </option>
              <option value="fully_remote">Fully remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="mostly_in_person">Mostly in-person</option>
            </select>
          </div>

          <div>
            <label className="form-label">Time zones</label>
            <input
              type="text"
              value={timezones}
              onChange={(e) => setTimezones(e.target.value)}
              placeholder="e.g. spread across 3 or 4 time zones"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Roster size</label>
            <input
              type="number"
              value={rosterSize}
              onChange={(e) => setRosterSize(e.target.value)}
              placeholder="How many members?"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">
              Anything I should know going in?
            </label>
            <textarea
              rows={3}
              value={knownSensitivities}
              onChange={(e) => setKnownSensitivities(e.target.value)}
              placeholder="Known sensitivities, recent changes, context that might help me."
              className="form-input"
            />
          </div>

          {errorMessage && (
            <p className="text-[var(--color-grey)]">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-4"
          >
            {submitting ? "Saving..." : "Save team"}
          </button>
        </form>
      </div>
    </div>
  );
}
