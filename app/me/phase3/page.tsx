"use client";

// Protected by middleware (/me/:path*) — member must have a valid session cookie.
// Member identity comes entirely from the session; no member_id in the URL.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { PsStatement, Phase3ReportJson } from "@/types/database";
import Phase3Chat from "@/components/phase3/Phase3Chat";
import Phase3Board from "@/components/phase3/Phase3Board";

type SessionMember = { member_id: string; display_name: string };
type PageState = "loading" | "not_ready" | "intro" | "chat" | "board" | "done";

const ZONE_NAME = ["", "Safe to Belong", "Safe to Speak Freely", "Safe to Innovate"];

export default function MemberPhase3Page() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());

  const [member, setMember] = useState<SessionMember | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [focusStatement, setFocusStatement] = useState<PsStatement | null>(null);
  const [reportJson, setReportJson] = useState<Phase3ReportJson | null>(null);
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

    // Resolve the focus item and report data.
    const { data: analysisData } = await supabase
      .from("analysis")
      .select("tier2_json, phase3_report_json")
      .eq("team_id", tid)
      .maybeSingle();

    const report = (analysisData?.phase3_report_json ?? null) as Phase3ReportJson | null;
    setReportJson(report);

    // Focus statement from phase3_report_json, with fallback to tier2_json.
    const statementId: number | undefined =
      (report?.focus_statement_id ?? undefined) ??
      ((analysisData?.tier2_json as Record<string, unknown> | null)?.focus_hypothesis as
        | { statement_id?: number } | undefined)?.statement_id;

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

    if (storyCount && storyCount > 0) {
      setPageState("board");
    } else {
      setPageState("intro");
    }
  }

  function handleIntroComplete() {
    setPageState("chat");
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

  const firstName = member?.display_name.split(" ")[0] ?? "there";

  if (pageState === "intro") {
    return (
      <main className="flex-1">
        <div className="w-full max-w-2xl mx-auto px-6 pt-12 pb-16 space-y-10">
          {/* Welcome */}
          <div>
            <img src="/octopus-logo.png" alt="" className="h-10 w-auto mb-5" />
            <h1 className="text-3xl font-serif mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
              Welcome back, {firstName}.
            </h1>
            <p className="text-[var(--color-grey)] leading-relaxed">
              Before you get started, here&apos;s where your team stands — and what your upcoming workshop will focus on.
            </p>
          </div>

          {/* PS zone summaries — only shown when consultant has written them */}
          {reportJson && (reportJson.ps_read_zone1 || reportJson.ps_read_zone2 || reportJson.ps_read_zone3) && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">
                How your team is doing on psychological safety
              </h2>
              {([1, 2, 3] as const).map((z) => {
                const read = z === 1 ? reportJson.ps_read_zone1 : z === 2 ? reportJson.ps_read_zone2 : reportJson.ps_read_zone3;
                if (!read) return null;
                return (
                  <div key={z} className="card px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purple)] mb-1">
                      {ZONE_NAME[z]}
                    </p>
                    <p className="text-sm leading-relaxed">{read}</p>
                  </div>
                );
              })}
            </section>
          )}

          {/* Shared purpose */}
          {reportJson?.shared_purpose_read && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">
                Your team&apos;s shared purpose
              </h2>
              <div className="card px-5 py-4">
                <p className="text-sm leading-relaxed">{reportJson.shared_purpose_read}</p>
              </div>
            </section>
          )}

          {/* Workshop focus — always shown */}
          {focusStatement && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">
                What your team will work on
              </h2>
              <div className="rounded-xl bg-[var(--color-purple)]/6 border border-[var(--color-purple)]/20 px-5 py-4">
                <p className="text-xs uppercase tracking-widest text-[var(--color-purple)] mb-1">Workshop focus</p>
                <p className="text-base font-medium">{focusStatement.statement_text}</p>
              </div>
              {reportJson?.focus_narrative ? (
                <p className="text-sm text-[var(--color-grey)] leading-relaxed">{reportJson.focus_narrative}</p>
              ) : (
                <p className="text-sm text-[var(--color-grey)] leading-relaxed">
                  Based on your team&apos;s survey results, your workshop will focus on strengthening this area of psychological safety.
                  You and your team will look at what makes it hard right now, and identify specific behaviors that could help.
                </p>
              )}
            </section>
          )}

          {/* Workshop intro note from consultant */}
          {reportJson?.workshop_intro && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">
                A note from your consultant
              </h2>
              <div className="card px-5 py-4">
                <p className="text-sm leading-relaxed">{reportJson.workshop_intro}</p>
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={handleIntroComplete}
            className="btn-primary"
          >
            Let&apos;s begin →
          </button>
        </div>
      </main>
    );
  }

  if (pageState === "done") {
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
            memberName={member?.display_name ?? ""}
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
