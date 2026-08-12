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
  const [origin, setOrigin] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());
  const [justInvited, setJustInvited] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (response.ok) setMembers(await response.json());
      setLoading(false);
    })();
  }, [teamId]);

  const linkFor = (memberId: string) => `${origin}/interview/${memberId}`;

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
    <main className="px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href={`/teams/${teamId}`} className="text-[var(--color-grey)]">← Back to team</Link>
        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">Your team is <span className="accent">ready.</span></h1>
        <p className="accent text-xl mt-6">Here&apos;s how to invite your members.</p>
        <p className="mt-4 text-[var(--color-grey)]">Each member gets a private link. They must read and acknowledge the beta privacy notice before the assessment begins. Team materials use summaries by default; exact excerpts require each participant&apos;s separate opt-in.</p>

        <div className="mt-12 space-y-3">
          {members.map((member) => (
            <div key={member.member_id} className="card" style={{ padding: "16px 20px" }}>
              <div className="flex items-center justify-between gap-4 mb-2">
                <p className="font-medium">{member.display_name}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {member.email && (
                    <button type="button" onClick={() => void handleSendInvite(member.member_id)} disabled={inviteSending.has(member.member_id)} className="btn-secondary whitespace-nowrap" style={{ padding: "6px 14px", fontSize: "13px" }}>
                      {inviteSending.has(member.member_id) ? "Sending..." : justInvited.has(member.member_id) ? "Sent ✓" : member.invited_at ? "Re-send" : "Send email"}
                    </button>
                  )}
                  <button type="button" onClick={() => void copy(linkFor(member.member_id), member.member_id)} className="btn-secondary whitespace-nowrap" style={{ padding: "6px 14px", fontSize: "13px" }}>
                    {copiedMemberId === member.member_id ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--color-grey)] truncate">{linkFor(member.member_id)}</p>
              {member.invited_at && <p className="mt-2 text-xs text-[var(--color-grey)]">Last emailed {new Date(member.invited_at).toLocaleDateString("en-GB")}</p>}
            </div>
          ))}
        </div>
        {inviteError && <p className="mt-4 text-sm text-red-600">{inviteError}</p>}
        <button type="button" onClick={() => void copy(members.map((member) => `${member.display_name}: ${linkFor(member.member_id)}`).join("\n"))} className="btn-secondary mt-8">{copiedAll ? "Copied all links!" : "Copy all links"}</button>
        <div className="mt-6"><button type="button" onClick={() => router.push(`/teams/${teamId}`)} className="btn-primary">Go to team dashboard →</button></div>
      </div>
    </main>
  );
}
