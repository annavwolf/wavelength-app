"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [industry, setIndustry] = useState("");
  const [rosterSize, setRosterSize] = useState("");
  const [knownSensitivities, setKnownSensitivities] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: teamName,
          industry: industry || null,
          roster_size: rosterSize ? Number.parseInt(rosterSize, 10) : null,
          known_sensitivities: knownSensitivities || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.team_id) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(`/teams/${data.team_id}/members`);
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="px-6 py-12">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-[var(--color-grey)]">← Back</Link>
        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">Let&apos;s set up your <span className="accent">team.</span></h1>
        <p className="accent text-xl mt-6">Tell me a little about who you&apos;re bringing in.</p>
        <p className="mt-4 text-[var(--color-grey)]">You can change this later.</p>

        <form onSubmit={handleSubmit} className="mt-12 space-y-6">
          <div><label className="form-label">Team name</label><input type="text" required value={teamName} onChange={(event) => setTeamName(event.target.value)} className="form-input" /></div>
          <div><label className="form-label">Industry</label><input type="text" value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="For example, fintech, healthcare, or education" className="form-input" /></div>
          <div><label className="form-label">Roster size</label><input type="number" min="1" max="500" value={rosterSize} onChange={(event) => setRosterSize(event.target.value)} placeholder="How many members?" className="form-input" /></div>
          <div>
            <label className="form-label">Anything I should know going in?</label>
            <textarea rows={3} value={knownSensitivities} onChange={(event) => setKnownSensitivities(event.target.value)} placeholder="Known sensitivities, recent changes, or context that might help Otis." className="form-input" />
          </div>
          {errorMessage && <p className="text-red-600">{errorMessage}</p>}
          <button type="submit" disabled={submitting} className="btn-primary mt-4">{submitting ? "Saving..." : "Save team"}</button>
        </form>
      </div>
    </main>
  );
}
