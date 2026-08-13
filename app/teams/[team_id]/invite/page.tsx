"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { MemberWithIdentity } from "@/types/database";

export default function InviteMembersPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<MemberWithIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  // Raw bearer links are deliberately never stored in Supabase or returned in
  // a roster payload. Keep a just-created link only in this consultant tab so
  // it can be copied, then discard it on refresh.
  const [secureLinks, setSecureLinks] = useState<Record<string, string>>({});
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());
  const [linkCreating, setLinkCreating] = useState<Set<string>>(new Set());
  const [justInvited, setJustInvited] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (response.ok) setMembers(await response.json());
      setLoading(false);
    })();
  }, [teamId]);

  async function copy(text: string, memberId?: string) {
    try {
      await navigator.clipboard.writeText(text);
      if (memberId) {
        setCopiedMemberId(memberId);
        window.setTimeout(() => setCopiedMemberId(null), 2000);
      } else {
        setCopiedAll(true);
        window.setTimeout(() => setCopiedAll(false), 2000);
      }
    } catch {
      setInviteError("Your browser could not copy the link. Please select and copy it manually.");
    }
  }

  async function createSecureLink(memberId: string): Promise<string | null> {
    const existing = secureLinks[memberId];
    if (existing) return existing;

    setLinkCreating((current) => new Set(current).add(memberId));
    setInviteError(null);
    try {
      const response = await fetch("/api/invite/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, team_id: teamId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.interview_url !== "string") {
        setInviteError(data.error ?? "Unable to create a secure link. Please try again.");
        return null;
      }
      setSecureLinks((current) => ({ ...current, [memberId]: data.interview_url }));
      return data.interview_url;
    } catch {
      setInviteError("Unable to create a secure link. Please try again.");
      return null;
    } finally {
      setLinkCreating((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  async function handleCopyMemberLink(memberId: string) {
    const link = await createSecureLink(memberId);
    if (link) await copy(link, memberId);
  }

  async function handleResetMemberLink(memberId: string) {
    const confirmed = window.confirm(
      "Reset this personal link? Every previous link for this participant will stop working immediately."
    );
    if (!confirmed) return;

    setLinkCreating((current) => new Set(current).add(memberId));
    setInviteError(null);
    try {
      const response = await fetch("/api/invite/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, team_id: teamId, invalidate_existing: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.interview_url !== "string") {
        setInviteError(data.error ?? "Unable to reset the secure link. Please try again.");
        return;
      }
      setSecureLinks((current) => ({ ...current, [memberId]: data.interview_url }));
      await copy(data.interview_url, memberId);
    } catch {
      setInviteError("Unable to reset the secure link. Please try again.");
    } finally {
      setLinkCreating((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  async function handleCopyAllLinks() {
    setInviteError(null);
    const lines: string[] = [];
    for (const member of members) {
      const link = secureLinks[member.member_id] ?? await createSecureLink(member.member_id);
      if (!link) return;
      lines.push(`${member.display_name}: ${link}`);
    }
    await copy(lines.join("\n"));
  }

  async function handleSendInvite(memberId: string) {
    setInviteSending((current) => new Set(current).add(memberId));
    setInviteError(null);
    try {
      const response = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, team_id: teamId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setInviteError(data.error ?? "Failed to send invite. Please try again.");
        return;
      }
      setMembers((current) => current.map((member) => member.member_id === memberId
        ? { ...member, invited_at: data.invited_at, status: "invited" }
        : member));
      setJustInvited((current) => new Set(current).add(memberId));
    } catch {
      setInviteError("Failed to send invite. Please try again.");
    } finally {
      setInviteSending((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  if (loading) return <main className="px-6 py-24 text-center text-[var(--color-grey)]">Loading...</main>;

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <Link href={`/teams/${teamId}`} className="inline-flex min-h-11 items-center text-[var(--color-grey)]">← Back to team</Link>
        <h1 className="mt-8 text-3xl leading-tight sm:mt-10 sm:text-5xl">Your team is <span className="accent">ready.</span></h1>
        <p className="accent text-xl mt-6">Here&apos;s how to invite your members.</p>
        <p className="mt-4 text-[var(--color-grey)]">Each member gets a private, revocable link. They must read and acknowledge the beta privacy notice before the assessment begins. Team materials use summaries by default; exact excerpts require each participant&apos;s separate opt-in.</p>
        <p className="mt-2 text-sm text-[var(--color-grey)]">A secure link is generated only when you email or copy it. It remains valid for 90 days unless the participant withdraws; it is not stored in this page after you refresh it.</p>

        <div className="mt-12 space-y-3">
          {members.map((member) => (
            <div key={member.member_id} className="card p-4 sm:px-5">
              <div className="mb-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="break-words font-medium">{member.display_name}</p>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {member.email && (
                    <button type="button" onClick={() => void handleSendInvite(member.member_id)} disabled={inviteSending.has(member.member_id)} className="btn-secondary min-h-11 whitespace-nowrap" style={{ padding: "6px 14px", fontSize: "13px" }}>
                      {inviteSending.has(member.member_id) ? "Sending..." : justInvited.has(member.member_id) ? "Sent ✓" : member.invited_at ? "Re-send" : "Send email"}
                    </button>
                  )}
                  <button type="button" onClick={() => void handleCopyMemberLink(member.member_id)} disabled={linkCreating.has(member.member_id)} className="btn-secondary min-h-11 whitespace-nowrap" style={{ padding: "6px 14px", fontSize: "13px" }}>
                    {linkCreating.has(member.member_id) ? "Creating..." : copiedMemberId === member.member_id ? "Copied!" : "Copy link"}
                  </button>
                  <button type="button" onClick={() => void handleResetMemberLink(member.member_id)} disabled={linkCreating.has(member.member_id)} className="min-h-11 whitespace-nowrap text-sm text-[var(--color-grey)] underline underline-offset-4 disabled:opacity-60">
                    Reset link
                  </button>
                </div>
              </div>
              {secureLinks[member.member_id] ? (
                <p className="break-all text-sm text-[var(--color-grey)]">{secureLinks[member.member_id]}</p>
              ) : (
                <p className="text-sm text-[var(--color-grey)]">Choose “Copy link” to create a secure personal link.</p>
              )}
              {member.invited_at && <p className="mt-2 text-xs text-[var(--color-grey)]">Last emailed {new Date(member.invited_at).toLocaleDateString("en-GB")}</p>}
              <p className="mt-2 text-xs text-[var(--color-grey)]">Use Reset link only if a link was sent to the wrong person or may have been shared. It invalidates every earlier link for this participant.</p>
            </div>
          ))}
        </div>
        {inviteError && <p className="mt-4 text-sm text-red-600">{inviteError}</p>}
        <button type="button" onClick={() => void handleCopyAllLinks()} className="btn-secondary mt-8 w-full sm:w-auto">{copiedAll ? "Copied all links!" : "Copy all links"}</button>
        <div className="mt-6"><button type="button" onClick={() => router.push(`/teams/${teamId}`)} className="btn-primary w-full sm:w-auto">Go to team dashboard →</button></div>
      </div>
    </main>
  );
}
