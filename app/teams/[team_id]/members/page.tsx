"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import type { Member, Team } from "@/types/database";

function statusBadgeClasses(status: string) {
  switch (status) {
    case "invited":
      return "bg-amber-100 text-amber-700";
    case "in_progress":
      return "bg-blue-100 text-blue-700";
    case "complete":
      return "bg-green-100 text-green-700";
    case "pending":
      return "bg-gray-200 text-[var(--color-ink)]";
    default:
      return "bg-gray-200 text-[var(--color-ink)]";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "invited":
      return "Invited";
    case "in_progress":
      return "In progress";
    case "complete":
      return "Complete";
    case "pending":
      return "Not yet invited";
    default:
      return status;
  }
}

export default function TeamMembersPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });
    if (error) console.error("[members] failed to load members:", error);
    if (data) setMembers(data);
  }

  useEffect(() => {
    async function load() {
      const [
        { data: teamData, error: teamError },
        { data: memberData, error: memberError },
      ] = await Promise.all([
        supabase.from("teams").select("*").eq("team_id", teamId).single(),
        supabase
          .from("members")
          .select("*")
          .eq("team_id", teamId)
          .order("created_at", { ascending: true }),
      ]);

      if (teamError) {
        console.error("[members] failed to load team:", teamError);
      }
      if (memberError) {
        console.error("[members] failed to load members:", memberError);
      }

      setTeam(teamData ?? null);
      setMembers(memberData ?? []);
      setLoading(false);
    }

    load();
  }, [teamId, supabase]);

  // Poll for status updates every 30 seconds.
  useEffect(() => {
    const interval = setInterval(fetchMembers, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, supabase]);

  async function handleAddMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const { count, error: countError } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);

    if (countError) {
      console.error("[members] failed to count existing members:", countError);
    }

    const privateCode = `P${101 + (count ?? 0)}`;

    const insertPayload = {
      team_id: teamId,
      display_name: name,
      email,
      role: role || null,
      location: location || null,
      timezone: timezone || null,
      private_code: privateCode,
      status: "pending",
    };
    console.log("[members] insert payload:", insertPayload);

    const { data, error } = await supabase
      .from("members")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !data) {
      console.error("[members] insert into members failed:", error);
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setMembers((prev) => [...prev, data]);
    setName("");
    setEmail("");
    setRole("");
    setLocation("");
    setTimezone("");
    setSubmitting(false);
  }

  async function handleDeleteMember(memberId: string) {
    const { error } = await supabase
      .from("members")
      .delete()
      .eq("member_id", memberId);

    if (error) {
      console.error("[members] delete member failed:", error);
      return;
    }

    setMembers((prev) => prev.filter((m) => m.member_id !== memberId));
  }

  if (loading) {
    return (
      <main className="px-6 py-24 text-center text-[var(--color-grey)]">
        Loading...
      </main>
    );
  }

  if (!team) {
    return (
      <main className="px-6 py-24 text-center text-[var(--color-grey)]">
        We couldn&apos;t find that team.
      </main>
    );
  }

  return (
    <main className="px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-[var(--color-grey)]">
          ← Back to dashboard
        </Link>

        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">
          Your team: <span className="accent">{team.team_name}</span>
        </h1>

        <p className="accent text-xl mt-6">
          Now let&apos;s add the people. I&apos;ll reach out to each one
          privately.
        </p>

        <form onSubmit={handleAddMember} className="mt-12 space-y-6">
          <div>
            <label className="form-label">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Location</label>
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              onTimezoneSelect={setTimezone}
            />
          </div>

          <div>
            <label className="form-label">Time zone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Auto-filled from location, or enter manually"
              className="form-input"
            />
          </div>

          {errorMessage && (
            <p className="text-[var(--color-grey)]">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? "Adding..." : "Add member"}
          </button>
        </form>

        <section className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Team members</h2>
            <button
              type="button"
              onClick={fetchMembers}
              className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] underline"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.member_id}
                className="card flex items-center justify-between gap-4 py-4"
              >
                <div className="flex items-center gap-4">
                  <span className="bg-[var(--color-navy)] text-white text-xs px-3 py-1 rounded-full">
                    {member.private_code}
                  </span>
                  <div>
                    <p className="font-medium">{member.display_name}</p>
                    <p className="text-sm text-[var(--color-grey)]">
                      {[member.role, member.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-3 py-1 rounded-full ${statusBadgeClasses(
                      member.status
                    )}`}
                  >
                    {statusLabel(member.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(member.member_id)}
                    aria-label={`Remove ${member.display_name}`}
                    className="text-[var(--color-grey)] hover:text-[var(--color-ink)] text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-[var(--color-grey)]">
            {team.roster_size
              ? `${members.length} of ${team.roster_size} members added`
              : `${members.length} members added`}
          </p>
        </section>

        {members.length > 0 && (
          <button
            className="btn-primary mt-10"
            onClick={() => router.push(`/teams/${teamId}/fish`)}
          >
            Next: choose patterns →
          </button>
        )}
      </div>
    </main>
  );
}
