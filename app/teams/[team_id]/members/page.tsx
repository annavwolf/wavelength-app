"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { MemberWithIdentity, Team } from "@/types/database";
import LocationAutocomplete from "@/components/LocationAutocomplete";

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

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<MemberWithIdentity[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchMembers() {
    const res = await fetch(`/api/teams/${teamId}/members`);
    if (res.ok) setMembers(await res.json());
  }

  useEffect(() => {
    async function load() {
      const [teamRes, membersRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`),
        fetch(`/api/teams/${teamId}/members`),
      ]);

      if (teamRes.ok) setTeam(await teamRes.json());
      else console.error("[members] failed to load team");
      if (membersRes.ok) setMembers(await membersRes.json());
      setLoading(false);
    }

    load();
  }, [teamId]);

  // Poll for status updates every 30 seconds.
  useEffect(() => {
    const interval = setInterval(fetchMembers, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function handleAddMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: name,
        email: email || null,
        role: role || null,
        location: location || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[members] create member failed:", err);
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    const newMember: MemberWithIdentity = await res.json();
    setMembers((prev) => [...prev, newMember]);
    setName("");
    setEmail("");
    setRole("");
    setLocation("");
    setSubmitting(false);
  }

  async function handleDeleteMember(memberId: string) {
    const res = await fetch(`/api/teams/${teamId}/members?member_id=${memberId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      console.error("[members] delete member failed");
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
        <Link href={`/teams/${teamId}`} className="text-[var(--color-grey)]">
          ← Back to team
        </Link>

        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">
          Your team: <span className="accent">{team.team_name}</span>
        </h1>

        <p className="accent text-xl mt-6">
          Add each person&apos;s email. If you do not know a name or other detail,
          leave it blank—Otis will ask that person privately.
        </p>

        <form onSubmit={handleAddMember} className="mt-12 space-y-6">
          <div>
            <label className="form-label">Name or preferred name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave blank if you only have their email"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Email address</label>
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
            <label className="form-label">City and country (optional)</label>
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              onSelect={() => undefined}
            />
            <p className="mt-1 text-xs text-[var(--color-grey)]">Suggestions can set the person&apos;s time zone automatically. A broad location is fine too; do not enter an address.</p>
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
                  <div>
                    <p className="font-medium">{member.display_name}</p>
                    <p className="text-sm text-[var(--color-grey)]">
                      {[member.email, member.role, member.location, member.timezone ? `Time zone: ${member.timezone}` : null]
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
                  <span
                    className={`text-xs px-3 py-1 rounded-full ${
                      member.privacy_acknowledged_currently
                        ? "bg-purple-100 text-purple-800"
                        : member.privacy_acknowledged_at
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-600"
                    }`}
                    title={member.privacy_acknowledged_at
                      ? `Acknowledged ${new Date(member.privacy_acknowledged_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                      : undefined}
                  >
                    {member.privacy_acknowledged_currently
                      ? "Privacy acknowledged"
                      : member.privacy_acknowledged_at
                        ? "Updated notice pending"
                        : "Privacy pending"}
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

        <p className="mt-4 text-sm text-[var(--color-grey)]">
          You can see whether each participant has acknowledged the current privacy notice. Their exact-word and voice-input choices remain private.
        </p>

        {members.length > 0 && (
          <button
            className="btn-primary mt-10"
            onClick={() => router.push(`/teams/${teamId}/invite`)}
          >
            Next: invite members →
          </button>
        )}
      </div>
    </main>
  );
}
