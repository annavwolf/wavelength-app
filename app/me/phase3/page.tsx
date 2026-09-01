"use client";

// Protected by middleware (/me/:path*) — member must have a valid session cookie.
// Member identity comes entirely from the session; no member_id in the URL.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PsStatement, Phase3ReportJson } from "@/types/database";
import type { Tier1Result, ZoneScore } from "@/components/dashboard/types";
import ChatBubble from "@/components/interview/ChatBubble";
import ReadAloudToggle from "@/components/interview/ReadAloudToggle";
import Phase3Chat from "@/components/phase3/Phase3Chat";
import Phase3Board from "@/components/phase3/Phase3Board";
import Phase3FrequencyStep from "@/components/phase3/Phase3FrequencyStep";
import Phase3ConsentStep from "@/components/phase3/Phase3ConsentStep";
import Phase3CommitAskStep from "@/components/phase3/Phase3CommitAskStep";
import Phase3SyncStep from "@/components/phase3/Phase3SyncStep";
import Phase3ReviewStep from "@/components/phase3/Phase3ReviewStep";
import Phase3ZoneReview from "@/components/phase3/Phase3ZoneReview";
import Phase3SharedPurposeReview from "@/components/phase3/Phase3SharedPurposeReview";
import Phase3ProgressBar, { type Phase3Step, phase3SectionOverlay } from "@/components/phase3/Phase3ProgressBar";
import { ITEM_EXAMPLES } from "@/lib/itemExamples";
import { ACTION_PHRASES, PLACE_PHRASES } from "@/prompts/phase3_conversation";
import { SHARED_PURPOSE_INTRO } from "@/lib/phase3Copy";
import MemberNav from "@/components/member/MemberNav";
import { primeSpeech, speakText, cancelSpeech } from "@/lib/speech";
import {
  VoiceInputProvider,
  useHostedSpeechAvailable,
  useVoiceParticipantMemberId,
} from "@/components/interview/VoiceInputContext";

type SessionMember = { member_id: string; display_name: string; phase3_completed_at?: string | null };
type PageState = "loading" | "not_ready" | "done" | "withdrawn" | Phase3Step;

// Full linear order of all possible steps. The actual order for a member is
// this filtered by the release toggles (see buildStepOrder).
const FULL_ORDER: Phase3Step[] = [
  "intro",
  "sp_intro",        // only if shared purpose included
  "shared_purpose",  // only if shared purpose included
  "results",
  "zone1",
  "zone2",
  "zone3",
  // Team Stories
  "focus",
  "focus2",
  "stories_intro",   // only if stories included
  "chat",            // only if stories included
  "impact",          // only if stories included
  "frequency",       // only if stories included
  "story_consent",   // only if stories included
  // Team Agreement
  "agreement_intro",
  "examples_meaning",
  "examples_behaviors",
  "board",
  "commit_praise",
  "commit_ask",
  "commit_sync",
  // Finish
  "finish_wellDone",
  "finish_next",
  "behavior_consent",
  "finish_review",
  "review",
];

const SHARED_PURPOSE_STEPS: Phase3Step[] = ["sp_intro", "shared_purpose"];
const STORY_STEPS: Phase3Step[] = ["stories_intro", "chat", "impact", "frequency", "story_consent"];

function buildStepOrder(includeSharedPurpose: boolean, includeStories: boolean): Phase3Step[] {
  return FULL_ORDER.filter((s) => {
    if (!includeSharedPurpose && SHARED_PURPOSE_STEPS.includes(s)) return false;
    if (!includeStories && STORY_STEPS.includes(s)) return false;
    return true;
  });
}

// Ocean-recap bands (mirrors the Phase 1 PsDescentStep visual).
const OCEAN_ZONES = [
  {
    key: "zone1",
    eyebrow: "Zone 1 · Safe to Belong",
    top: "4%",
    text: "Near the surface, it's about belonging — feeling welcome, respected, and free to be yourself.",
  },
  {
    key: "zone2",
    eyebrow: "Zone 2 · Safe to Speak Freely",
    top: "33%",
    text: "Deeper down, it becomes possible to speak freely — to be candid, raise hard things, and ask the obvious question.",
  },
  {
    key: "zone3",
    eyebrow: "Zone 3 · Safe to Innovate",
    top: "65%",
    text: "At the deepest level, members feel secure enough to innovate — to challenge how things are done and take real risks.",
  },
];

export default function MemberPhase3Page() {
  const router = useRouter();

  const [member, setMember] = useState<SessionMember | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [focusStatement, setFocusStatement] = useState<PsStatement | null>(null);
  const [reportJson, setReportJson] = useState<Phase3ReportJson | null>(null);
  const [tier1, setTier1] = useState<Tier1Result | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  // Furthest step reached — gates forward navigation.
  const [reachedStep, setReachedStep] = useState<Phase3Step>("intro");
  const [rosterNames, setRosterNames] = useState<string[]>([]);
  const [spClassification, setSpClassification] = useState<string | undefined>(undefined);
  const [readAloud, setReadAloud] = useState(false);
  const [introChunk, setIntroChunk] = useState(0);
  // Phase 3 uses the participant's global, explicit exact-word choice.
  const [storyVerbatim, setStoryVerbatim] = useState(false);
  const [behaviorVerbatim, setBehaviorVerbatim] = useState(false);
  const [voiceInputAllowed, setVoiceInputAllowed] = useState(false);
  // True while a chat (story/impact) is loading or Otis is thinking — gates the
  // page's Continue button so members can't breeze past a pending reply.
  const [chatBusy, setChatBusy] = useState(false);
  // True while the member has jumped back to a step from the review summary.
  // Shows a "Return to summary" button so they don't have to step through everything.
  const [editingFromReview, setEditingFromReview] = useState(false);

  // Release toggles drive which sections the member sees. Stories default ON
  // for older reports (undefined); shared purpose defaults OFF.
  const includeSharedPurpose = !!reportJson?.include_shared_purpose;
  const includeStories = reportJson?.include_stories !== false;
  const stepOrder = buildStepOrder(includeSharedPurpose, includeStories);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      // `/api/member/me` is deliberately small and gives legacy participants a
      // route back to the mandatory privacy screen if their acknowledgement is
      // missing. The Phase 3 payload itself comes from the scoped bootstrap API.
      const meResponse = await fetch("/api/member/me");
      if (meResponse.status === 401) { router.push("/member-login"); return; }
      if (!meResponse.ok) { setPageState("not_ready"); return; }
      const meData = await meResponse.json();
      if (!meData.privacy_acknowledgement?.acknowledged_at) {
        router.replace(`/interview/${meData.member.member_id}`);
        return;
      }

      const res = await fetch("/api/member/phase3/bootstrap");
      if (!res.ok) { setPageState("not_ready"); return; }
      const data = await res.json();
      const me: SessionMember = data.member;
      const tid: string = meData.team?.team_id ?? data.member?.team_id ?? "";
      setMember(me);
      setTeamId(tid);
      if (!tid) { setPageState("not_ready"); return; }

      // A completed member should return to the terminal confirmation rather
      // than being sent back into the activity by heuristic resume data.
      if (me.phase3_completed_at) {
        setPageState("done");
        return;
      }

      const verbatimAllowed = data.privacy_acknowledgement?.verbatim_preference === "verbatim";
      setStoryVerbatim(verbatimAllowed);
      setBehaviorVerbatim(verbatimAllowed);
      setVoiceInputAllowed(data.privacy_acknowledgement?.voice_input_opt_in === true);

      const report = (data.report ?? null) as Phase3ReportJson | null;
      setReportJson(report);
      setTier1((data.tier1 ?? null) as Tier1Result | null);
      setSpClassification(data.shared_purpose_classification);
      setFocusStatement((data.focus_statement ?? null) as PsStatement | null);

      if (!data.focus_statement) { setPageState("not_ready"); return; }

      setRosterNames(Array.isArray(data.roster_names) ? data.roster_names : []);

      // Resume: pick the furthest sensible step from server-scoped own data.
      const storyCount = Number(data.story_count ?? 0);
      const behaviorCount = Number(data.behavior_count ?? 0);
      const ctx = data.context as { frequency?: string | null; impact_text?: string | null; commitment?: string | null; synchronicity?: string | null } | null;

      const localIncludeStories = report?.include_stories !== false;
      let target: Phase3Step = "intro";
      if (behaviorCount > 0 || ctx?.commitment || ctx?.synchronicity) target = "board";
      else if (localIncludeStories && ctx?.frequency) target = "story_consent";
      else if (localIncludeStories && ctx?.impact_text) target = "frequency";
      else if (localIncludeStories && storyCount > 0) target = "impact";

      setPageState(target);
      setReachedStep(target);
    } catch {
      setPageState("not_ready");
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function stopSpeech() {
    cancelSpeech();
  }

  function goToStep(next: Phase3Step) {
    stopSpeech();
    setChatBusy(false);
    setEditingFromReview(false);
    setPageState(next);
    setReachedStep((prev) => (stepOrder.indexOf(next) > stepOrder.indexOf(prev) ? next : prev));
  }

  // Called by Phase3ReviewStep's Edit buttons — jumps to a step but remembers
  // to return to the review summary afterwards.
  function goToStepFromReview(next: Phase3Step) {
    stopSpeech();
    setChatBusy(false);
    setEditingFromReview(true);
    setPageState(next);
  }

  // Advance to the next active step after `from` (robust to toggled-out steps).
  function goNext(from: Phase3Step) {
    const i = stepOrder.indexOf(from);
    if (i >= 0 && i + 1 < stepOrder.length) goToStep(stepOrder[i + 1]);
  }

  function goBack() {
    if (pageState === "done" || pageState === "withdrawn") { goToStep("review"); return; }
    const idx = stepOrder.indexOf(pageState as Phase3Step);
    if (idx > 0) goToStep(stepOrder[idx - 1]);
  }

  function toggleReadAloud() {
    setReadAloud((prev) => {
      const next = !prev;
      if (next) primeSpeech(); // unlock synth within this user gesture
      else stopSpeech();
      return next;
    });
  }

  // ── Loading / not-ready (no chrome) ───────────────────────────────────────
  if (pageState === "loading") {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <a
          href="/me"
          className="absolute left-6 top-6 text-sm font-medium text-[var(--color-grey)] hover:text-[var(--color-ink)] transition-colors"
        >
          Exit to my profile
        </a>
        <img src="/octopus-logo.png" alt="" className="h-20 w-auto mx-auto mb-8" />
        <p className="text-sm font-medium text-[var(--color-grey)] mb-2">Results &amp; Team Agreement Activity</p>
        <p className="text-[var(--color-grey)]">Loading your session…</p>
      </main>
    );
  }

  if (pageState === "not_ready") {
    return (
      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-end mb-4">
            <a href="/me" className="text-sm font-medium text-[var(--color-grey)] hover:text-[var(--color-ink)] transition-colors">
              Exit to my profile
            </a>
          </div>
          <MemberNav />
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <img src="/octopus-logo.png" alt="" className="h-16 w-auto mx-auto mb-6" />
            <h1 className="text-2xl font-serif mb-3" style={{ fontFamily: "Playfair Display, serif" }}>Not quite ready yet</h1>
            <p className="text-[var(--color-grey)] max-w-sm">
              Your consultant is finishing the analysis. They&apos;ll be in touch when the Results &amp; Team Agreement Activity is ready.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const firstName = member?.display_name.split(" ")[0] ?? "there";
  const memberId = member?.member_id ?? "";
  const tid = teamId ?? "";
  const statementId = focusStatement?.statement_id ?? null;
  const actionPhrase = statementId ? (ACTION_PHRASES[statementId] ?? "") : "";
  const placePhrase = statementId ? (PLACE_PHRASES[statementId] ?? "") : "";
  const itemExamples = statementId ? (ITEM_EXAMPLES[statementId] ?? null) : null;
  const zoneScore = (n: 1 | 2 | 3): ZoneScore | undefined => (tier1?.ps_zones ?? []).find((z) => z.zone === n);

  const isTerminal = pageState === "done" || pageState === "withdrawn";
  const stepIdx = isTerminal ? stepOrder.length : stepOrder.indexOf(pageState);
  const canBack = isTerminal || stepIdx > 0;

  // Shared big-Otis message page with a Continue button.
  function BigOtisPage({ children, onNext, nextLabel = "Continue →" }: { children: React.ReactNode; onNext: () => void; nextLabel?: string }) {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 pb-16 pt-2 flex flex-col items-center">
        <img src="/octopus-logo.png" alt="" aria-hidden className="otis-float h-28 w-auto mb-8" />
        <div className="w-full">{children}</div>
        <button type="button" onClick={onNext} className="btn-primary mt-8">{nextLabel}</button>
      </div>
    );
  }

  // ── Per-step content ───────────────────────────────────────────────────────
  function renderContent() {
    switch (pageState) {
      case "intro":
        return (
          <div className="flex flex-col items-center pt-2">
            <img src="/octopus-logo.png" alt="" aria-hidden className="otis-float h-32 w-auto mb-10" />
            <div className="w-full max-w-xl">
              {introChunk === 0 && (
                <div className="text-center space-y-6">
                  <p className="text-xl" style={{ fontFamily: "Playfair Display, serif" }}>
                    Would you like me to read my messages aloud?
                  </p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <button type="button" onClick={() => { if (!readAloud) toggleReadAloud(); setIntroChunk(1); }} className="btn-primary">Yes, please</button>
                    <button type="button" onClick={() => { if (readAloud) toggleReadAloud(); setIntroChunk(1); }} className="btn-secondary">No thanks</button>
                  </div>
                </div>
              )}
              {introChunk === 1 && (
                <ChatBubble
                  key="w1"
                  readAloud={readAloud}
                  hideAvatar
                  centered
                  speakText={`Welcome back, ${firstName}. Remember, I'll save your progress if you need to leave and come back to this conversation.`}
                >
                  Welcome back, {firstName}.
                  <br />
                  <br />
                  Remember, I&apos;ll save your progress if you need to leave and come back to this conversation.
                </ChatBubble>
              )}
              {introChunk === 2 && (
                <ChatBubble key="w2" readAloud={readAloud} hideAvatar centered>
                  Here&apos;s what I want to do today. I&apos;ve spoken with your team about Psychological Safety, and I
                  want to share some insights I&apos;ve noticed and ask whether you agree.
                </ChatBubble>
              )}
              {introChunk === 3 && (
                <ChatBubble key="w3" readAloud={readAloud} hideAvatar centered>
                  After that, I want us to focus on one area your team could work on together to improve psychological
                  safety. This will lead into the formation of a Team Agreement, and possibly a live workshop with your
                  whole team at some point in the future.
                </ChatBubble>
              )}
            </div>

            {introChunk > 0 && (
              <div className="flex w-full max-w-xl items-center justify-between mt-10">
                <button
                  type="button"
                  onClick={() => { stopSpeech(); setIntroChunk((c) => Math.max(0, c - 1)); }}
                  aria-label="Previous"
                  className="p-3 rounded-full border border-black/15 text-[var(--color-grey)] hover:text-[var(--color-ink)] transition-colors text-xl leading-none"
                >←</button>
                {introChunk < 3 ? (
                  <button
                    type="button"
                    onClick={() => { stopSpeech(); setIntroChunk((c) => c + 1); }}
                    aria-label="Next"
                    className="p-3 rounded-full bg-[var(--color-navy)] text-white text-xl leading-none"
                  >→</button>
                ) : (
                  <button type="button" onClick={() => goNext("intro")} className="btn-primary">See our results →</button>
                )}
              </div>
            )}
          </div>
        );

      case "sp_intro":
        return (
          <BigOtisPage onNext={() => goNext("sp_intro")}>
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              {SHARED_PURPOSE_INTRO}
            </ChatBubble>
          </BigOtisPage>
        );

      case "shared_purpose":
        return (
          <Phase3SharedPurposeReview
            read={reportJson?.shared_purpose_read || undefined}
            classification={spClassification}
            memberId={memberId}
            teamId={tid}
            readAloud={readAloud}
            onNext={() => goNext("shared_purpose")}
          />
        );

      case "results":
        return (
          <div className="w-full max-w-2xl mx-auto px-4 pb-16 space-y-6 sm:px-6">
            <ChatBubble readAloud={readAloud}>
              If you recall from our last conversations, I asked you to picture psychological safety like exploring an
              ocean with your team.
            </ChatBubble>
            <div className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-2xl">
              <div className="relative">
                <img src="/ps-ocean.png" alt="Ocean cross-section showing three depths of psychological safety" className="block h-auto w-full" />
                <div className="pointer-events-none absolute inset-0 hidden sm:block" style={{ background: "linear-gradient(to right, rgba(6,18,28,0.55), rgba(6,18,28,0.2) 50%, rgba(6,18,28,0) 72%)" }} />
              </div>
              <div className="space-y-4 bg-[var(--color-bg)] px-4 py-5 sm:contents">
                {OCEAN_ZONES.map((zone) => (
                  <Speakable
                    key={zone.key}
                    readAloud={readAloud}
                    text={`${zone.eyebrow}. ${zone.text}`}
                    className="w-full rounded-xl border border-black/10 bg-white px-5 py-4 shadow-sm sm:absolute sm:left-[5%] sm:top-[var(--zone-top)] sm:w-[46%] sm:border-white/20 sm:bg-white/[0.14] sm:px-4 sm:py-3.5 sm:shadow-none sm:backdrop-blur-md"
                    style={{ "--zone-top": zone.top } as React.CSSProperties}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-purple)] sm:mb-1.5 sm:text-sm sm:font-normal sm:text-white/80">{zone.eyebrow}</p>
                    <p className="text-[17px] leading-relaxed text-[var(--color-ink)] sm:text-base sm:text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{zone.text}</p>
                  </Speakable>
                ))}
              </div>
            </div>
            <ChatBubble readAloud={readAloud}>Let&apos;s review each zone one at a time.</ChatBubble>
            <button type="button" onClick={() => goToStep("zone1")} className="btn-primary">Continue →</button>
          </div>
        );

      case "zone1":
      case "zone2":
      case "zone3": {
        const n = (pageState === "zone1" ? 1 : pageState === "zone2" ? 2 : 3) as 1 | 2 | 3;
        const read = n === 1 ? reportJson?.ps_read_zone1 : n === 2 ? reportJson?.ps_read_zone2 : reportJson?.ps_read_zone3;
        return (
          <Phase3ZoneReview
            key={pageState}
            zone={n}
            score={zoneScore(n)}
            read={read ?? undefined}
            memberId={memberId}
            teamId={tid}
            readAloud={readAloud}
            nextLabel={n === 3 ? "Continue →" : "Next →"}
            onNext={() => goToStep(n === 1 ? "zone2" : n === 2 ? "zone3" : "focus")}
          />
        );
      }

      case "focus":
        return (
          <BigOtisPage onNext={() => goToStep("focus2")}>
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              Thanks for your feedback, {firstName}. The point of these assessments is to find out where to focus our
              efforts in continuously improving teamwork through new agreements about how to work together.
            </ChatBubble>
          </BigOtisPage>
        );

      case "focus2":
        return (
          <BigOtisPage onNext={() => goNext("focus2")}>
            <ChatBubble
              readAloud={readAloud}
              hideAvatar
              centered
              speakText={`I've identified one area that I think would be good to focus on first: making your team a safer place to ${actionPhrase}. This was a low-scoring area among your team. Which is why I suggest it becomes the focus of your Team Agreement.`}
            >
              I&apos;ve identified one area that I think would be good to focus on first:{" "}
              <strong>making your team a safer place to {actionPhrase}</strong>. This was a low-scoring area among your
              team. Which is why I suggest it becomes <strong>the focus of your Team Agreement</strong>.
            </ChatBubble>
          </BigOtisPage>
        );

      case "stories_intro":
        return (
          <BigOtisPage onNext={() => goToStep("chat")}>
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              I&apos;d like to hear some stories from you, about your team.
            </ChatBubble>
          </BigOtisPage>
        );

      case "chat":
        return (
          <div className="w-full max-w-2xl mx-auto px-6 pb-16 space-y-8 pt-4">
            {statementId && teamId && (
              <Phase3Chat
                memberId={memberId} teamId={teamId} statementId={statementId} kind="story"
                memberName={member?.display_name ?? ""} readAloud={readAloud}
                onBusyChange={setChatBusy}
                onComplete={() => { /* member advances with Continue */ }}
              />
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => goToStep("impact")} disabled={chatBusy} className="btn-primary" style={chatBusy ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
                {chatBusy ? "Otis is thinking…" : "Continue →"}
              </button>
            </div>
          </div>
        );

      case "impact":
        return (
          <div className="w-full max-w-2xl mx-auto px-6 pb-16 space-y-8 pt-4">
            {statementId && teamId && (
              <Phase3Chat
                memberId={memberId} teamId={teamId} statementId={statementId} kind="impact"
                memberName={member?.display_name ?? ""} readAloud={readAloud}
                onBusyChange={setChatBusy}
                onComplete={() => { /* member advances with Continue */ }}
              />
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => goToStep("frequency")} disabled={chatBusy} className="btn-primary" style={chatBusy ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
                {chatBusy ? "Otis is thinking…" : "Continue →"}
              </button>
            </div>
          </div>
        );

      case "frequency":
        return teamId ? (
          <Phase3FrequencyStep memberId={memberId} teamId={teamId} readAloud={readAloud} onComplete={() => goToStep("story_consent")} />
        ) : null;

      case "story_consent":
        return (
          <Phase3ConsentStep
            variant="story" memberName={firstName} readAloud={readAloud}
            onSaved={(v) => setStoryVerbatim(v)} onComplete={() => goToStep("agreement_intro")}
          />
        );

      case "agreement_intro":
        return (
          <BigOtisPage onNext={() => goToStep("examples_meaning")}>
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              Now I&apos;d like to move into an activity that will contribute to a Team Agreement about what behaviours you{" "}
              <strong style={{ color: "#2D7A4F" }}>ALWAYS</strong> and <strong style={{ color: "#B94040" }}>NEVER</strong>{" "}
              want to see on your team, specifically when the goal is to make your team{" "}
              <strong className="text-[var(--color-ink)]">a place where {placePhrase}</strong>.
            </ChatBubble>
          </BigOtisPage>
        );

      case "examples_meaning":
        return (
          <div className="w-full max-w-2xl mx-auto px-6 pb-16 pt-2 flex flex-col items-center">
            <img src="/octopus-logo.png" alt="" aria-hidden className="otis-float h-24 w-auto mb-8" />
            <ChatBubble readAloud={readAloud} hideAvatar centered>Here are some examples of what I mean.</ChatBubble>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6">
              <ExampleMeaningCard readAloud={readAloud} color="#2D7A4F" label="ALWAYS" text={`Behaviours you would always want to see if the team is to become a place where ${placePhrase}. Things that reinforce and support this kind of environment.`} />
              <ExampleMeaningCard readAloud={readAloud} color="#C4860A" label="SOMETIMES" text="Behaviours that might need to be approached cautiously, or are helpful only in some situations. You may debate these together as a team." />
              <ExampleMeaningCard readAloud={readAloud} color="#B94040" label="NEVER" text="Behaviours you would never want to see. Things that shut down or harm this kind of environment." />
            </div>
            <button type="button" onClick={() => goToStep("examples_behaviors")} className="btn-primary mt-8">Continue →</button>
          </div>
        );

      case "examples_behaviors":
        return (
          <div className="w-full max-w-2xl mx-auto px-6 pb-16 pt-2 flex flex-col items-center">
            <img src="/octopus-logo.png" alt="" aria-hidden className="otis-float h-24 w-auto mb-8" />
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              One thing to keep in mind: a behaviour is something you can see or hear. It&apos;s observable — a subtle bit
              of body language, a specific phrase, a small ritual. The key is that it&apos;s an action, not a feeling or a
              general attitude.
              <br /><br />
              Here are some behaviour examples.
            </ChatBubble>
            {itemExamples && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-6">
                <Speakable
                  readAloud={readAloud}
                  text={`Always examples. ${itemExamples.always.join(". ")}.`}
                  className="rounded-xl border px-5 py-4"
                  style={{ borderColor: "#2D7A4F55", background: "#2D7A4F12" }}
                >
                  <p className="text-base font-semibold uppercase tracking-widest mb-2.5" style={{ color: "#2D7A4F" }}>ALWAYS</p>
                  <ul className="space-y-2">
                    {itemExamples.always.map((ex) => <li key={ex} className="text-base leading-relaxed text-[var(--color-ink)]">· {ex}</li>)}
                  </ul>
                </Speakable>
                <Speakable
                  readAloud={readAloud}
                  text={`Never examples. ${itemExamples.never.join(". ")}.`}
                  className="rounded-xl border px-5 py-4"
                  style={{ borderColor: "#B9404055", background: "#B940400F" }}
                >
                  <p className="text-base font-semibold uppercase tracking-widest mb-2.5" style={{ color: "#B94040" }}>NEVER</p>
                  <ul className="space-y-2">
                    {itemExamples.never.map((ex) => <li key={ex} className="text-base leading-relaxed text-[var(--color-ink)]">· {ex}</li>)}
                  </ul>
                </Speakable>
              </div>
            )}
            <button type="button" onClick={() => goToStep("board")} className="btn-primary mt-8">Continue to the board →</button>
          </div>
        );

      case "board":
        return (
          <div className="w-full max-w-2xl mx-auto px-6 pb-16 space-y-8 pt-4">
            {teamId && (
              <Phase3Board
                memberId={memberId} teamId={teamId} statementId={statementId}
                placePhrase={placePhrase || undefined} readAloud={readAloud}
                onSubmit={() => goToStep("commit_praise")}
              />
            )}
          </div>
        );

      case "commit_praise":
        return (
          <BigOtisPage onNext={() => goToStep("commit_ask")}>
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              Excellent contribution, {firstName}. I&apos;m curious what your team members have come up with, and I hope you
              get the chance to discuss it with them.
            </ChatBubble>
          </BigOtisPage>
        );

      case "commit_ask":
        return teamId ? (
          <Phase3CommitAskStep memberId={memberId} teamId={teamId} readAloud={readAloud} onComplete={() => goToStep("commit_sync")} />
        ) : null;

      case "commit_sync":
        return teamId ? (
          <Phase3SyncStep memberId={memberId} teamId={teamId} rosterNames={rosterNames} readAloud={readAloud} onComplete={() => goToStep("finish_wellDone")} />
        ) : null;

      case "finish_wellDone":
        return (
          <BigOtisPage onNext={() => goToStep("finish_next")}>
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              Well done, {firstName}. I&apos;m proud of the conversation we&apos;ve had today and how much you&apos;ve contributed.
            </ChatBubble>
          </BigOtisPage>
        );

      case "finish_next":
        return (
          <BigOtisPage onNext={() => goToStep("behavior_consent")}>
            <ChatBubble
              readAloud={readAloud}
              hideAvatar
              centered
              speakText="Here's what I want to do next. I'll speak with everyone on the team and collect more ALWAYS and NEVER ideas. I'll put them in a collage — like sticky notes on a wall — and see if I can find patterns. I'll get back to you with the results, and what I think your Team Agreement should be. I hope your team will find the time to discuss it, tweak it, and make a plan to put it into practice."
            >
              Here&apos;s what I want to do next. I&apos;ll speak with everyone on the team and collect more ALWAYS and NEVER ideas.
              <br /><br />
              I&apos;ll put them in a collage — like sticky notes on a wall — and see if I can find patterns.
              <br /><br />
              I&apos;ll get back to you with the results, and what I think your Team Agreement should be.
              <br /><br />
              I hope your team will find the time to discuss it, tweak it, and make a plan to put it into practice.
            </ChatBubble>
          </BigOtisPage>
        );

      case "behavior_consent":
        return (
          <Phase3ConsentStep
            variant="behavior" memberName={firstName} readAloud={readAloud}
            onSaved={(v) => setBehaviorVerbatim(v)} onComplete={() => goToStep("finish_review")}
          />
        );

      case "finish_review":
        return (
          <BigOtisPage onNext={() => goToStep("review")} nextLabel="Review my conversation →">
            <ChatBubble readAloud={readAloud} hideAvatar centered>
              Understood. I&apos;ll respect your decision.
            </ChatBubble>
          </BigOtisPage>
        );

      case "review":
        return teamId ? (
          <Phase3ReviewStep
            memberId={memberId} teamId={teamId} memberName={firstName}
            storyVerbatim={storyVerbatim} behaviorVerbatim={behaviorVerbatim} readAloud={readAloud}
            includeStories={includeStories}
            onEditStep={goToStepFromReview}
            onConsentChange={(f) => {
              if (typeof f.phase3_story_verbatim === "boolean") setStoryVerbatim(f.phase3_story_verbatim);
              if (typeof f.phase3_behavior_verbatim === "boolean") setBehaviorVerbatim(f.phase3_behavior_verbatim);
            }}
            onSubmit={async () => {
              // Record Phase 3 completion through the signed member session
              // before showing the terminal state. A failed save must remain
              // retryable rather than looking like a finished submission.
              const response = await fetch("/api/member/phase3/complete", { method: "POST" });
              if (!response.ok) return false;
              stopSpeech();
              setPageState("done");
              return true;
            }}
            onWithdrawn={() => { stopSpeech(); setPageState("withdrawn"); }}
          />
        ) : null;

      case "done":
        return (
          <div className="w-full max-w-2xl mx-auto px-6 pb-16 text-center flex flex-col items-center py-12">
            <img src="/octopus-logo.png" alt="" className="h-20 w-auto mx-auto mb-8" />
            <h1 className="text-3xl font-serif mb-3" style={{ fontFamily: "Playfair Display, serif" }}>Thank you, {firstName}.</h1>
            <p className="text-[var(--color-grey)] max-w-sm leading-relaxed mb-8">
              That&apos;s it for now. This is exactly what we&apos;ll build on together in the workshop. I&apos;ll let your
              facilitator know you&apos;re done, and we&apos;ll be in touch to get the group session on the calendar.
            </p>
            <a href="/me" className="btn-primary inline-block text-center" style={{ textDecoration: "none" }}>
              Back to my team
            </a>
          </div>
        );

      case "withdrawn":
        return (
          <div className="w-full max-w-2xl mx-auto px-6 pb-16 text-center flex flex-col items-center py-12">
            <img src="/octopus-logo.png" alt="" className="h-20 w-auto mx-auto mb-8" />
            <h1 className="text-3xl font-serif mb-3" style={{ fontFamily: "Playfair Display, serif" }}>You&apos;ve been removed.</h1>
            <p className="text-[var(--color-grey)] max-w-sm leading-relaxed">
              Your live contribution to this activity has been deleted. If a team report was already generated, it may
              still contain earlier material; contact Wavelength support for help with that report.
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  const barStep: Phase3Step = isTerminal ? "review" : (pageState as Phase3Step);

  // ── Shared shell ───────────────────────────────────────────────────────────
  return (
    <VoiceInputProvider allowed={voiceInputAllowed} memberId={member?.member_id}>
    <main className="flex-1 flex flex-col items-center relative">
      {/* Section tint overlay — matches the progress bar colour for the section */}
      <div className="fixed inset-0 pointer-events-none transition-colors duration-700" style={{ background: phase3SectionOverlay(barStep) }} />

      <div className="relative z-10 w-full max-w-2xl px-4 pt-6 sm:px-6 sm:pt-8">
        {/* A safe, non-destructive exit is always available from within the activity. */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col items-start gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-grey)]">Results &amp; Team Agreement Activity</p>
            <a
              href="/me"
              className="text-sm font-medium text-[var(--color-grey)] hover:text-[var(--color-ink)] transition-colors"
            >
              Exit to my profile
            </a>
          </div>
          <ReadAloudToggle enabled={readAloud} onToggle={toggleReadAloud} />
        </div>
        <Phase3ProgressBar step={barStep} reachedStep={reachedStep} complete={isTerminal} onSectionClick={goToStep} activeSteps={stepOrder} />
      </div>

      <div className="w-full relative z-10">{renderContent()}</div>

      {/* Fixed bottom-left controls: back arrow, or "Return to summary" when editing from review */}
      {editingFromReview ? (
        <button
          type="button"
          onClick={() => goToStep("review")}
          className="relative z-20 mb-4 ml-4 self-start rounded-full border border-[var(--color-purple)]/40 bg-white/90 px-4 py-2.5 text-sm font-medium text-[var(--color-purple)] shadow-sm transition-colors hover:bg-[var(--color-purple)] hover:text-white sm:fixed sm:bottom-6 sm:left-6 sm:mb-0 sm:ml-0"
        >
          ← Return to summary
        </button>
      ) : canBack ? (
        <button type="button" onClick={goBack} aria-label="Go back" className="relative z-20 mb-4 ml-4 self-start rounded-full border border-black/15 bg-white/90 p-3 text-xl leading-none text-[var(--color-grey)] shadow-sm transition-colors hover:text-[var(--color-ink)] sm:fixed sm:bottom-6 sm:left-6 sm:mb-0 sm:ml-0 sm:bg-white/60 sm:backdrop-blur-sm">←</button>
      ) : null}
    </main>
    </VoiceInputProvider>
  );
}

function ExampleMeaningCard({ color, label, text, readAloud }: { color: string; label: string; text: string; readAloud: boolean }) {
  return (
    <Speakable
      readAloud={readAloud}
      text={`${label}. ${text}`}
      className="rounded-xl border px-4 py-4"
      style={{ borderColor: `${color}55`, background: `${color}12` }}
    >
      <p className="text-base font-semibold uppercase tracking-widest mb-1.5" style={{ color }}>{label}</p>
      <p className="text-base leading-relaxed text-[var(--color-ink)]">{text}</p>
    </Speakable>
  );
}

// A read-aloud-aware wrapper for non-bubble content (ocean zones, example
// cards). Speaks on mount when read-aloud is on, and is clickable to replay.
function Speakable({
  readAloud,
  text,
  children,
  className,
  style,
}: {
  readAloud: boolean;
  text: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const spoken = useRef(false);
  const hostedSpeech = useHostedSpeechAvailable();
  const memberId = useVoiceParticipantMemberId();
  useEffect(() => {
    if (!readAloud || !text) { spoken.current = false; return; }
    if (spoken.current) return;
    spoken.current = true;
    void speakText(text, 0.95, { allowHosted: hostedSpeech, memberId });
  }, [readAloud, text, hostedSpeech, memberId]);
  return (
    <div
      className={`${className ?? ""} ${readAloud ? "cursor-pointer hover:ring-1 hover:ring-[var(--color-purple)]/30 transition-all" : ""}`}
      style={style}
      onClick={readAloud ? () => { cancelSpeech(); void speakText(text, 0.95, { allowHosted: hostedSpeech, memberId }); } : undefined}
      title={readAloud ? "Click to replay" : undefined}
    >
      {children}
    </div>
  );
}
