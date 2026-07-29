"use client";

// Protected by middleware (/me/:path*) — member must have a valid session cookie.
// Member identity comes entirely from the session; no member_id in the URL.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { PsStatement, Phase3ReportJson } from "@/types/database";
import Phase3Chat from "@/components/phase3/Phase3Chat";
import Phase3Board from "@/components/phase3/Phase3Board";
import PulseCheckWidget from "@/components/phase3/PulseCheckWidget";
import { ITEM_EXAMPLES } from "@/lib/itemExamples";
import { ACTION_PHRASES } from "@/prompts/phase3_conversation";

type SessionMember = { member_id: string; display_name: string };
type PageState = "loading" | "not_ready" | "intro" | "chat" | "transition" | "board" | "done";

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
    setPageState("transition");
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
    const memberId = member?.member_id ?? "";
    const tid = teamId ?? "";
    return (
      <main className="flex-1">
        <div className="w-full max-w-2xl mx-auto px-6 pt-12 pb-16 space-y-10">
          {/* §4.1 — Otis welcome */}
          <div>
            <img src="/octopus-logo.png" alt="" className="h-10 w-auto mb-5" />
            <div className="rounded-2xl border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/4 px-6 py-5 space-y-3">
              <p className="text-xs uppercase tracking-widest text-[var(--color-purple)]">Otis</p>
              <p className="text-base leading-relaxed">
                Welcome back, {firstName}. Before we get started, here&apos;s what today is about.
              </p>
              <p className="text-base leading-relaxed">
                Building psychological safety on a team happens one small step at a time. Today I want to help you take one of those steps.
              </p>
              <p className="text-base leading-relaxed">
                First we&apos;ll look at where your team is right now — what&apos;s going well, where there&apos;s room to grow. Then we&apos;ll focus in on <strong>one</strong> thing your team could work on together, and I&apos;ll ask you to think through some ideas about it. Your ideas will feed into a workshop your team will do together soon.
              </p>
              <p className="text-base leading-relaxed font-medium">Ready?</p>
            </div>
          </div>

          {/* §2.4 + §2.5 — Zone reads with ocean-depth bands + inline pulse checks */}
          {reportJson && (reportJson.ps_read_zone1 || reportJson.ps_read_zone2 || reportJson.ps_read_zone3) && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">
                Your team&apos;s psychological safety landscape
              </h2>
              {/* Ocean-depth container */}
              <div className="rounded-2xl overflow-hidden p-px" style={{
                background: "linear-gradient(to bottom, #b3d9f2 0%, #4a90c4 50%, #1a3a5c 100%)"
              }}>
                <div className="rounded-2xl space-y-3 p-4" style={{ background: "rgba(255,255,255,0.88)" }}>
                  {([1, 2, 3] as const).map((z) => {
                    const read = z === 1 ? reportJson.ps_read_zone1 : z === 2 ? reportJson.ps_read_zone2 : reportJson.ps_read_zone3;
                    const readKey = z === 1 ? "zone1" : z === 2 ? "zone2" : "zone3";
                    const borderColor = z === 1 ? "#b3d9f2" : z === 2 ? "#4a90c4" : "#1a3a5c";
                    if (!read) return null;
                    return (
                      <div key={z} className="rounded-xl bg-white px-5 py-4 space-y-3"
                        style={{ borderLeft: `4px solid ${borderColor}` }}>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                          style={{ color: borderColor }}>
                          {ZONE_NAME[z]}
                        </p>
                        <p className="text-sm leading-relaxed">{read}</p>
                        {memberId && tid && (
                          <PulseCheckWidget
                            memberId={memberId}
                            teamId={tid}
                            readKey={readKey as "zone1" | "zone2" | "zone3"}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* §2.2 + §2.5 — Shared purpose + pulse check */}
          {reportJson?.shared_purpose_read && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">
                Your team&apos;s shared purpose
              </h2>
              <div className="card px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed">{reportJson.shared_purpose_read}</p>
                {memberId && tid && (
                  <PulseCheckWidget memberId={memberId} teamId={tid} readKey="purpose" />
                )}
              </div>
            </section>
          )}

          {/* Workshop focus */}
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
                  You and your team will look at what makes it hard right now, and identify specific behaviours that could help.
                </p>
              )}
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
          That&apos;s it for now. This is exactly what we&apos;ll build on together in the workshop. I&apos;ll let your facilitator know you&apos;re done, and we&apos;ll be in touch to get the group session on the calendar.
        </p>
      </main>
    );
  }

  const memberId = member?.member_id ?? "";
  const statementId = focusStatement?.statement_id ?? null;
  const actionPhrase = statementId ? (ACTION_PHRASES[statementId] ?? "") : "";
  const itemExamples = statementId ? (ITEM_EXAMPLES[statementId] ?? null) : null;

  // §4.4 — Transition screen (educational, shown between chat and board)
  if (pageState === "transition") {
    return (
      <main className="flex-1">
        <div className="w-full max-w-2xl mx-auto px-6 pt-12 pb-16 space-y-8">
          <img src="/octopus-logo.png" alt="" className="h-10 w-auto" />

          {/* §4.4 Otis transition script */}
          <div className="rounded-2xl border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/4 px-6 py-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[var(--color-purple)]">Otis</p>
            <p className="text-base leading-relaxed">
              Thank you for sharing those. Now I&apos;d like to move into an activity that will feed into the workshop your team does together.
            </p>
            <p className="text-base leading-relaxed">
              Here&apos;s the goal: think about the situations you just told me about — the moments when the team was <em>not</em> a safe place to <strong>{actionPhrase}</strong> — and try to pinpoint what behaviours were working against psychological safety at those times. At the same time, think about what behaviours would make the team a safer place to <strong>{actionPhrase}</strong>.
            </p>
            <p className="text-base leading-relaxed">I&apos;d like you to land on:</p>
            <ul className="space-y-1 pl-4">
              <li className="text-base leading-relaxed"><strong className="text-[var(--color-amber)]">NEVER</strong> — behaviours you would never want to see if the team is to be a safe place to {actionPhrase}</li>
              <li className="text-base leading-relaxed"><strong className="text-[var(--color-navy)]">ALWAYS</strong> — behaviours you would always want to see</li>
              <li className="text-base leading-relaxed"><strong className="text-[var(--color-grey)]">SOMETIMES</strong> — behaviours that might depend on the situation. You&apos;ll debate these together as a team.</li>
            </ul>
            <p className="text-base leading-relaxed">
              One thing to keep in mind: <strong>a behaviour is something you can see or hear.</strong> It&apos;s observable — a subtle bit of body language, a specific phrase, a small ritual. The key is that it&apos;s an action, not a feeling or a general attitude.
            </p>
          </div>

          {/* §4.8 — Item-specific examples */}
          {itemExamples && focusStatement && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-grey)] leading-relaxed">
                To give you a sense of the range, here are some behaviour examples for <em>{focusStatement.statement_text}</em>. You don&apos;t have to use these — the point is just to show the kind of thing a behaviour can be.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[var(--color-navy)]/20 bg-[var(--color-navy)]/4 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-navy)] mb-2">ALWAYS</p>
                  <ul className="space-y-1">
                    {itemExamples.always.map((ex) => (
                      <li key={ex} className="text-sm leading-snug text-[var(--color-ink)]">· {ex}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[var(--color-amber)]/20 bg-[var(--color-amber)]/4 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-amber)] mb-2">NEVER</p>
                  <ul className="space-y-1">
                    {itemExamples.never.map((ex) => (
                      <li key={ex} className="text-sm leading-snug text-[var(--color-ink)]">· {ex}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPageState("board")}
            className="btn-primary"
          >
            Continue to the board →
          </button>
        </div>
      </main>
    );
  }

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
              statementText={focusStatement?.statement_text}
              actionPhrase={actionPhrase || undefined}
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
