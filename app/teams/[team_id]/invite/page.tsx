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
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[invite] failed to load members:", error);
      }

      setMembers(data ?? []);
      setLoading(false);
    }

    load();
  }, [teamId, supabase]);

  function linkFor(memberId: string) {
    return `${origin}/interview/${memberId}`;
  }

  async function handleCopyAll() {
    const text = members
      .map((m) => `${m.display_name}: ${linkFor(m.member_id)}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error("[invite] copy all links failed:", err);
    }
  }

  async function handleCopyOne(memberId: string) {
    try {
      await navigator.clipboard.writeText(linkFor(memberId));
      setCopiedMemberId(memberId);
      setTimeout(() => setCopiedMemberId(null), 2000);
    } catch (err) {
      console.error("[invite] copy link failed:", err);
    }
  }

  async function handleConfirmSent() {
    setConfirming(true);
    setConfirmError(null);

    const { error } = await supabase
      .from("members")
      .update({ status: "invited" })
      .eq("team_id", teamId);

    if (error) {
      // Log every field PostgREST gives us — message alone often hides the
      // real cause (e.g. PGRST204 "column not found in schema cache").
      console.error("[invite] failed to mark members invited:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      setConfirmError("Something went wrong. Please try again.");
      setConfirming(false);
      return;
    }

    router.push("/");
  }

  if (loading) {
    return (
      <main className="px-6 py-24 text-center text-[var(--color-grey)]">
        Loading...
      </main>
    );
  }

  return (
    <main className="px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/teams/${teamId}/fish`}
          className="text-[var(--color-grey)]"
        >
          ← Back to patterns
        </Link>

        <h1 className="text-4xl sm:text-5xl leading-tight mt-10">
          Your team is <span className="accent">ready.</span>
        </h1>

        <p className="accent text-xl mt-6">
          Here&apos;s how to invite your members.
        </p>

        <p className="mt-4 text-[var(--color-grey)]">
          Each member gets a private link. Their responses are
          confidential — no one sees what anyone said, word for word.
        </p>

        <div className="mt-12 space-y-3">
          {members.map((member) => (
            <div
              key={member.member_id}
              className="card flex items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{member.display_name}</p>
                <p className="text-sm text-[var(--color-grey)] mt-1 truncate">
                  {linkFor(member.member_id)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyOne(member.member_id)}
                className="btn-secondary whitespace-nowrap"
              >
                {copiedMemberId === member.member_id ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          className="btn-secondary mt-8"
        >
          {copiedAll ? "Copied all links!" : "Copy all links"}
        </button>

        {confirmError && (
          <p className="mt-6 text-[var(--color-grey)]">{confirmError}</p>
        )}

        <button
          type="button"
          onClick={handleConfirmSent}
          disabled={confirming}
          className="btn-primary mt-6"
        >
          {confirming ? "Saving..." : "I've sent the invites →"}
        </button>
      </div>
    </main>
  );
}
