"use client";

// Protected by middleware (/me/:path*) — member must have a valid session cookie.
// Member identity comes entirely from the session; no member_id in the URL.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { PsStatement } from "@/types/database";
import Phase3Chat from "@/components/phase3/Phase3Chat";
import Phase3Board from "@/components/phase3/Phase3Board";

type SessionMember = { member_id: string; display_name: string };
type PageState = "loading" | "not_ready" | "chat" | "board" | "done";

export default function MemberPhase3Page() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());

  const [member, setMember] = useState<SessionMember | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [focusStatement, setFocusStatement] = useState<PsStatement | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [nudge, setNudge] = useState<string | null>(null);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    // Session verified by middleware. Call /api/member/me to resolve identity.
    const res = await fetch("/api/member/me");
    if (res.status === 401) {
      router.push("/member-login");
      return;
    }
    if (!res.ok) {
      setPageState("not_ready");
      return;
    }
    const data = await res.json();
    const me: SessionMember = { member_id: data.member.member_id, display_name: data.member.display_name };
    const tid: string = data.team?.team_id ?? "";
    setMember(me);
    setTeamId(tid);

    if (!tid) {
      setPageState("not_ready");
      return;
    }

    // Resolve the focus item from the team's interpret output.
    const { data: analysisData } = await supabase
      .from("analysis")
      .select("tier2_json")
      .eq("team_id", tid)
      .maybeSingle();

    const focusHypothesis = (analysisData?.tier2_json as Record<string, unknown> | null)?.focus_hypothesis as
      | { statement_id?: number } | undefined;
    const statementId = focusHypothesis?.statement_id;

    if (!statementId) {
      setPageState("not_ready");
      return;
    }

    const { data: statementData } = await supabase
      .from("ps_statements")
      .select("*")
      .eq("statement_id", statementId)
      .single();

    setFocusStatement(statementData ?? null);

    // Resume at the board if the member has already submitted a story.
    const { count: storyCount } = await supabase
      .from("member_stories")
      .select("*", { count: "exact", head: true })
      .eq("member_id", me.member_id)
      .eq("team_id", tid);

    setPageState(storyCount && storyCount > 0 ? "board" : "chat");
  }

  function handleChatComplete() {
    setPageState("board");
    setNudge(null);
  }

  function handleBoardSubmit() {
    setPageState("done");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <img src="/octopus-logo.png" alt="" className="h-20 w-auto mx-auto mb-8" />
        <h1 className="text-4xl font-serif mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
          Hello, I&apos;m <span className="purple">Otis.</span>
        </h1>
        <p className="text-[var(--color-grey)]">Loading your session…</p>
      </main>
    );
  }

  if (pageState === "not_ready") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <img src="/octopus-logo.png" alt="" className="h-16 w-auto mx-auto mb-6" />
        <h1 className="text-2xl font-serif mb-3" style={{ fontFamily: "Playfair Display, serif" }}>
          Not quite ready yet
        </h1>
        <p className="text-[var(--color-grey)] max-w-sm">
          Your consultant is finishing the analysis. They&apos;ll be in touch when this activity is ready.
        </p>
      </main>
    );
  }

  if (pageState === "done") {
    const firstName = member?.display_name.split(" ")[0] ?? "there";
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <img src="/octopus-logo.png" alt="" className="h-20 w-auto mx-auto mb-8" />
        <h1 className="text-3xl font-serif mb-3" style={{ fontFamily: "Playfair Display, serif" }}>
          Thank you, {firstName}.
        </h1>
        <p className="text-[var(--color-grey)] max-w-sm leading-relaxed">
          Your responses have been saved. Your consultant will be in touch about the next step.
        </p>
      </main>
    );
  }

  const memberId = member?.member_id ?? "";
  const statementId = focusStatement?.statement_id ?? null;

  return (
    <main className="flex-1">
      <div className="w-full max-w-2xl mx-auto px-6 pt-12 pb-16 space-y-8">
        {/* Header */}
        <div>
          <img src="/octopus-logo.png" alt="" className="h-10 w-auto mb-4" />
          {focusStatement && (
            <div className="rounded-xl bg-[var(--color-purple)]/6 border border-[var(--color-purple)]/20 px-5 py-4 mb-4">
              <p className="text-xs uppercase tracking-widest text-[var(--color-purple)] mb-1">
                Your team&apos;s focus for this workshop
              </p>
              <p className="text-base font-medium">{focusStatement.statement_text}</p>
            </div>
          )}
          {pageState === "chat" && (
            <p className="text-sm text-[var(--color-grey)]">
              Before the activity, Otis wants to hear about a moment from your team.
            </p>
          )}
          {pageState === "board" && (
            <p className="text-sm text-[var(--color-grey)]">
              Add behaviors to each column. Chat with Otis if you want to think it through.
            </p>
          )}
        </div>

        {/* Story conversation */}
        {pageState === "chat" && statementId && teamId && (
          <Phase3Chat
            memberId={memberId}
            teamId={teamId}
            statementId={statementId}
            onComplete={handleChatComplete}
            nudge={nudge}
            onNudgeSeen={() => setNudge(null)}
          />
        )}

        {/* Behavior board + nudge display */}
        {pageState === "board" && teamId && (
          <div className="space-y-6">
            <Phase3Board
              memberId={memberId}
              teamId={teamId}
              statementId={statementId}
              onNudge={setNudge}
              onSubmit={handleBoardSubmit}
            />
            {nudge && (
              <div className="rounded-2xl border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/4 p-5">
                <p className="text-xs uppercase tracking-widest text-[var(--color-purple)] mb-2">Otis says</p>
                <p className="text-sm leading-relaxed">{nudge}</p>
                <button
                  type="button"
                  onClick={() => setNudge(null)}
                  className="mt-3 text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
