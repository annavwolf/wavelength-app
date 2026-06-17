"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Member } from "@/types/database";

export default function InviteMembersPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());
  const [justInvited, setJustInvited] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });
      if (error) console.error("[invite] failed to load members:", error);
      setMembers(data ?? []);
      setLoading(false);
    }
    load();
  }, [teamId, supabase]);

  function linkFor(memberId: string) {
    return `${origin}/interview/${memberId}`;
  }

  async function handleCopyAll() {
    const text = members.map((m) => `${m.display_name}: ${linkFor(m.member_id)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error("[invite] copy all failed:", err);
    }
  }

  async function handleCopyOne(memberId: string) {
    try {
      await navigator.clipboard.writeText(linkFor(memberId));
      setCopiedMemberId(memberId);
      setTimeout(() => setCopiedMemberId(null), 2000);
    } catch (err) {
      console.error("[invite] copy failed:", err);
    }
  }

  async function handleSendInvite(memberId: string) {
    setInviteSending((prev) => new Set(prev).add(memberId));
    setInviteError(null);
    try {
      const res = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, team_id: teamId }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setMembers((prev) =>
          prev.map((m) => m.member_id === memberId ? { ...m, invited_at: now, status: "invited" } : m)
        );
        setJustInvited((prev) => new Set(prev).add(memberId));
      } else {
        const data = await res.json().catch(() => ({}));
        setInviteError(data.error ?? "Failed to send invite. Please try again.");
      }
    } catch {
      setInviteError("Failed to send invite. Please try again.");
    }
    setInviteSending((prev) => { const next = new Set(prev); next.delete(memberId); return next; });
  }

  // Only marks pending members as invited — never overwrites in_progress or complete.
  async function handleDone() {
    const pendingIds = members
      .filter((m) => m.status === "pending")
      .map((m) => m.member_id);

    if (pendingIds.length > 0) {
      const { error } = await supabase
        .from("members")
        .update({ status: "invited" })
        .in("member_id", pendingIds);
      if (error) {
        console.error("[invite] failed to mark pending members invited:", error);
      }
    }

    router.push(`/teams/${teamId}`);
  }

  if (loading) {
    return <main className="px-6 py-24 text-center text-[var(--color-grey)]">Loading...</main>;
  }

  return (
    <main className="px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href={`/teams/${teamId}`} className="text-[var(--color-grey)]">
          ← Back to team
        </Link>

        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">
          Your team is <span className="accent">ready.</span>
        </h1>

        <p className="accent text-xl mt-6">Here&apos;s how to invite your members.</p>

        <p className="mt-4 text-[var(--color-grey)]">
          Each member gets a private link. Their responses are confidential — no one sees what anyone said, word for word.
        </p>

        <div className="mt-12 space-y-3">
          {members.map((member) => (
            <div key={member.member_id} className="card" style={{ padding: "16px 20px" }}>
              <div className="flex items-center justify-between gap-4 mb-2">
                <p className="font-medium">{member.display_name}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {member.email && !member.invited_at && (
                    <button type="button"
                      onClick={() => handleSendInvite(member.member_id)}
                      disabled={inviteSending.has(member.member_id)}
                      className="btn-secondary whitespace-nowrap"
                      style={{ padding: "6px 14px", fontSize: "13px" }}>
                      {inviteSending.has(member.member_id) ? "Sending..." : justInvited.has(member.member_id) ? "Sent ✓" : "Send email"}
                    </button>
                  )}
                  {member.invited_at && !justInvited.has(member.member_id) && (
                    <span className="text-xs text-[var(--color-grey)]">
                      Invited {new Date(member.invited_at).toLocaleDateString("en-GB")}
                    </span>
                  )}
                  {justInvited.has(member.member_id) && (
                    <span className="text-xs text-green-700 font-medium">Sent ✓</span>
                  )}
                  <button type="button"
                    onClick={() => handleCopyOne(member.member_id)}
                    className="btn-secondary whitespace-nowrap"
                    style={{ padding: "6px 14px", fontSize: "13px" }}>
                    {copiedMemberId === member.member_id ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--color-grey)] truncate">{linkFor(member.member_id)}</p>
            </div>
          ))}
        </div>

        {inviteError && <p className="mt-4 text-sm text-red-600">{inviteError}</p>}

        <button type="button" onClick={handleCopyAll} className="btn-secondary mt-8">
          {copiedAll ? "Copied all links!" : "Copy all links"}
        </button>

        <div className="mt-6">
          <button type="button" onClick={handleDone} className="btn-primary">
            Go to team dashboard →
          </button>
        </div>
      </div>
    </main>
  );
}
