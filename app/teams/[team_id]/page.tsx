"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Analysis, MemberWithIdentity, Team } from "@/types/database";
import {
  hasText, ZONE_BADGE, ZONE_SHORT,
  type Tier1Result, type Tier2Result,
} from "@/components/dashboard/types";
import SharedPurposePanel from "@/components/dashboard/SharedPurposePanel";
import PsSafetyPanel from "@/components/dashboard/PsSafetyPanel";
import TeamConnectivityPanel from "@/components/dashboard/TeamConnectivityPanel";
import FreeTextPanel from "@/components/dashboard/FreeTextPanel";
import Accordion from "@/components/dashboard/Accordion";
import OtisChatBubble from "@/components/dashboard/OtisChatBubble";
import WorkshopPanel from "@/components/workshop/WorkshopPanel";
import ReportReview from "@/components/phase3/ReportReview";
import Phase4Panel from "@/components/phase4/Phase4Panel";
import type { Phase3ReportJson, Phase4SelfServeJson } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Participation note: replaces "confidence" framing entirely.
// A fully-responding team is complete data and gets no hedging.
// A partial team gets a plain note about missing voices.
function participationNote(completed: number, rosterSize: number | null): string {
  if (rosterSize === null) {
    return `${completed} team member${completed === 1 ? "" : "s"} responded.`;
  }
  if (completed >= rosterSize) {
    return `All ${completed} team member${completed === 1 ? "" : "s"} responded.`;
  }
  const missing = rosterSize - completed;
  return `${completed} of ${rosterSize} team members responded — ${missing} haven't responded yet, so this reflects part of the team, not all of it.`;
}

function participationBadgeCls(completed: number, rosterSize: number | null): string {
  if (rosterSize === null || completed >= rosterSize) return "bg-green-100 text-green-800";
  if (completed >= Math.ceil(rosterSize * 0.6)) return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-800";
}

function participationBadgeLabel(completed: number, rosterSize: number | null): string {
  if (rosterSize === null || completed >= rosterSize) return "Full participation";
  return `${completed} of ${rosterSize} responded`;
}
const PS_GREEN = "#2D7A4F";
// Workshop accent (#11b) — shared by the "Suggested focus for Team Agreement
// Activity" card and the Workshop tab so the focus reads as workshop-bound.
const WORKSHOP_ACCENT = "#8A6D1F";
const WORKSHOP_BG = "rgba(138,109,31,0.07)";
const WORKSHOP_BORDER = "rgba(138,109,31,0.35)";

function memberStatusCls(m: MemberWithIdentity) {
  if (m.status === "complete") return "bg-green-100 text-green-700";
  if (m.status === "in_progress") return "bg-blue-100 text-blue-700";
  if (m.status === "invited") return "bg-amber-100 text-amber-700";
  return "bg-gray-200 text-[var(--color-ink)]";
}
function memberStatusLabel(m: MemberWithIdentity) {
  if (m.status === "complete") return "Complete ✓";
  if (m.status === "in_progress") return "In progress";
  if (m.status === "invited") {
    if (m.invited_at) {
      const d = new Date(m.invited_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return `Invite sent ${d}`;
    }
    return "Invited";
  }
  return "Not invited yet";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDashboardPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<MemberWithIdentity[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [phase3DoneIds, setPhase3DoneIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [interpretation, setInterpretation] = useState<Tier2Result | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"analytics" | "report" | "agreement" | "workshop">("analytics");

  useEffect(() => { load(); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const interval = window.setInterval(() => { void load(true); }, 30000);
    return () => window.clearInterval(interval);
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/dashboard`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTeam(null);
        return;
      }
      setTeam(data.team as Team);
      setMembers((data.members as MemberWithIdentity[] | undefined) ?? []);
      setPhase3DoneIds(new Set((data.phase3_done_member_ids as string[] | undefined) ?? []));
      const analysisRow = (data.analysis as Analysis | null | undefined) ?? null;
      setAnalysis(analysisRow);
      setInterpretation((analysisRow?.tier2_json as unknown as Tier2Result | null) ?? null);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function fetchMembers() {
    await load();
  }

  async function handleRunAnalysis() {
    setRunningAnalysis(true);
    setRunError(null);
    try {
      const res = await fetch("/api/analysis/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "insufficient_responses") {
          setRunError(`Not enough responses — ${data.n_completed ?? 0} complete, need at least 3.`);
        } else {
          const detail = [data.error, data.detail, data.hint].filter(Boolean).join(" — ");
          setRunError(`Analysis failed: ${detail || "unknown error"}`);
        }
        setRunningAnalysis(false);
        return;
      }
      await load();
    } catch {
      setRunError("Something went wrong. Please try again.");
      setRunningAnalysis(false);
    }
    setRunningAnalysis(false);
  }

  async function handleRunInterpretation() {
    setInterpreting(true);
    setInterpretError(null);
    try {
      const res = await fetch("/api/analysis/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = [data.error, data.detail, data.hint].filter(Boolean).join(" — ");
        setInterpretError(`Interpretation failed: ${detail || "unknown error"}`);
        setInterpreting(false);
        return;
      }
      setInterpretation(data as Tier2Result);
      if (data._save_warning) {
        setInterpretError(`Showing the read, but it was not saved: ${data._save_warning}.`);
      }
    } catch {
      setInterpretError("Something went wrong reaching Otis. Please try again.");
    }
    setInterpreting(false);
  }

  async function adoptTeamName(name: string) {
    if (!team || !name.trim() || name.trim() === team.team_name) return;
    const next = name.trim();
    const response = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: next }),
    });
    if (!response.ok) {
      console.error("[team] failed to adopt suggested name");
      return;
    }
    setTeam(await response.json());
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
        const { invited_at } = await res.json();
        setMembers((prev) =>
          prev.map((m) => m.member_id === memberId ? { ...m, invited_at, status: "invited" } : m)
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setInviteError(data.error ?? "Failed to send invite. Please try again.");
      }
    } catch {
      setInviteError("Failed to send invite. Please try again.");
    }
    setInviteSending((prev) => { const next = new Set(prev); next.delete(memberId); return next; });
  }

  async function handleSendAllPending() {
    const eligible = members.filter((m) => m.email && (m.status === "pending" || m.status === "invited") && !m.invited_at);
    setSendingAll(true);
    for (const m of eligible) {
      await handleSendInvite(m.member_id);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setSendingAll(false);
  }

  // ── Loading / not found ───────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-24">
        <p className="text-[var(--color-grey)]">Loading...</p>
      </main>
    );
  }
  if (!team) {
    return (
      <main className="flex-1 flex items-center justify-center py-24">
        <p className="text-[var(--color-grey)]">Team not found.</p>
      </main>
    );
  }

  const completeCount = members.filter((m) => m.status === "complete").length;
  const totalCount = members.length;
  const rosterSize = team.roster_size ?? totalCount;
  const pctComplete = rosterSize > 0 ? Math.round((completeCount / rosterSize) * 100) : 0;
  // conf retained for the stored tier1.participation.confidence (used by Otis reads and data quality note).
  const tier1 = analysis?.tier1_json as unknown as Tier1Result | null;
  const subtitle = team.industry ?? "";

  // ── SETUP MODE ────────────────────────────────────────────────────────────
  if (!tier1) {
    return (
      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-10">
            <div>
              <h1 className="text-4xl sm:text-5xl leading-tight">
                {team.team_name} <span className="accent">team.</span>
              </h1>
              {subtitle && <p className="text-sm text-[var(--color-grey)] mt-2">{subtitle}</p>}
              <div className="flex items-center gap-4 mt-3">
                <Link href={`/teams/${teamId}/members`} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
                  Edit members
                </Link>
                <Link href={`/teams/${teamId}/invite`} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
                  Invite page
                </Link>
              </div>
              {(() => {
                const suggestions = Array.from(
                  new Set(
                    members
                      .map((m) => m.team_name_suggestion?.trim())
                      .filter((s): s is string => !!s && s !== team.team_name)
                  )
                );
                if (suggestions.length === 0) return null;
                return (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--color-grey)]">
                      Members suggested:
                    </span>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => adoptTeamName(s)}
                        title="Use this as the team name"
                        className="text-xs px-3 py-1 rounded-full border border-black/15 hover:border-[var(--color-purple)] hover:text-[var(--color-purple)] transition-colors"
                      >
                        {s} <span className="opacity-60">· use</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            <Link href="/" className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] whitespace-nowrap mt-2">
              ← My Teams
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Member roster */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl">Team members</h2>
                <button type="button" onClick={fetchMembers}
                  className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
                  Refresh
                </button>
              </div>

              <div className="space-y-2">
                {members.map((m) => (
                    <div key={m.member_id} className="card flex items-center justify-between gap-4"
                      style={{ padding: "12px 20px" }}>
                    <div className="flex items-center gap-3">
                       <div>
                        <p className="font-medium text-sm">{m.display_name}</p>
                        {m.role && <p className="text-xs text-[var(--color-grey)]">{m.role}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.email && (m.status === "pending" || m.status === "invited") && (
                        <button type="button"
                          onClick={() => handleSendInvite(m.member_id)}
                          disabled={inviteSending.has(m.member_id)}
                          className="btn-secondary whitespace-nowrap"
                          style={{ padding: "4px 12px", fontSize: "12px" }}>
                          {inviteSending.has(m.member_id) ? "Sending..." : m.invited_at ? "Re-send" : "Send invite"}
                        </button>
                      )}
                      <span className={`text-xs px-3 py-1 rounded-full ${memberStatusCls(m)}`}>
                        {memberStatusLabel(m)}
                      </span>
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${
                          m.privacy_acknowledged_currently
                            ? "bg-purple-100 text-purple-800"
                            : m.privacy_acknowledged_at
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600"
                        }`}
                        title={m.privacy_acknowledged_at
                          ? `Acknowledged ${new Date(m.privacy_acknowledged_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                          : undefined}
                      >
                        {m.privacy_acknowledged_currently
                          ? "Privacy acknowledged"
                          : m.privacy_acknowledged_at
                            ? "Updated notice pending"
                            : "Privacy pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {inviteError && <p className="mt-3 text-sm text-red-600">{inviteError}</p>}

              <div className="mt-4 flex items-center gap-4">
                <p className="text-sm text-[var(--color-grey)]">
                  {completeCount}/{totalCount} completed the assessment
                </p>
                {members.some((m) => m.email && (m.status === "pending" || m.status === "invited") && !m.invited_at) && (
                  <button type="button" onClick={handleSendAllPending} disabled={sendingAll}
                    className="text-sm text-[var(--color-purple)] font-medium hover:underline">
                    {sendingAll ? "Sending..." : "Send all pending invites"}
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-[var(--color-grey)]">
                Privacy status shows whether each participant has acknowledged the current notice. Exact-word and voice-input choices remain private.
              </p>
            </div>

            {/* Progress panel */}
            <div className="card">
              <h2 className="text-2xl mb-6" style={{ fontFamily: "Playfair Display, serif" }}>
                Analysis readiness
              </h2>

              <div className="mb-1">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-[var(--color-grey)]">Completed</span>
                  <span className="font-medium">{pctComplete}%</span>
                </div>
                <div className="h-3 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pctComplete}%`, backgroundColor: PS_GREEN }} />
                </div>
              </div>

              <p className="text-sm text-[var(--color-grey)] mt-3 mb-6">
                {participationNote(completeCount, rosterSize)}
              </p>

              {completeCount < 3 ? (
                <p className="text-sm text-[var(--color-grey)] bg-black/5 rounded-xl px-4 py-3">
                  Analysis requires at least 3 completed assessments.
                </p>
              ) : (
                <>
                  <button type="button" onClick={handleRunAnalysis} disabled={runningAnalysis}
                    className="btn-primary w-full" style={{ textAlign: "center" }}>
                    {runningAnalysis ? "Otis is thinking..." : "Run analysis"}
                  </button>
                  {runError && <p className="text-sm text-red-600 mt-3">{runError}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── ANALYSIS MODE ─────────────────────────────────────────────────────────
  const completedCodes = Array.from(
    new Set((tier1.ps_statements ?? []).flatMap((statement) => statement.per_member.map((response) => response.private_code)))
  );
  const focus = interpretation?.focus_hypothesis;

  // Phase 3 completion — keyed off phase3_context_responses.synchronicity (the
  // reliable signal; doesn't depend on the members-table write of phase3_completed_at).
  const phase3Participants = members.filter((m) => m.status === "complete");
  const phase3CompletedCount = phase3Participants.filter((m) => phase3DoneIds.has(m.member_id)).length;
  const phase3TotalCount = phase3Participants.length;
  const phase3AllComplete = phase3TotalCount > 0 && phase3CompletedCount === phase3TotalCount;
  const phase3Outstanding = phase3Participants.filter((m) => !phase3DoneIds.has(m.member_id)).map((m) => m.display_name);

  return (
    <main className="flex-1">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-black/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/" className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">← My Teams</Link>
            <h2 className="text-lg" style={{ fontFamily: "Playfair Display, serif" }}>{team.team_name}</h2>
            <span className="text-sm text-[var(--color-grey)]">{completeCount}/{totalCount} completed the assessment</span>
            <span
              title={participationNote(completeCount, rosterSize)}
              className={`text-xs px-3 py-1 rounded-full font-medium cursor-help ${participationBadgeCls(completeCount, rosterSize)}`}>
              {participationBadgeLabel(completeCount, rosterSize)}
            </span>
            <Link href={`/teams/${teamId}/members`} className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
              Edit members
            </Link>
          </div>
          {/* Analysis controls live in the Analytics & Insights section (they drive that tab). */}
          <span className="text-xs text-[var(--color-grey)]">Last analysed {formatDate(tier1.computed_at)}</span>
        </div>
        {runError && (
          <div className="max-w-6xl mx-auto px-6 pb-2"><p className="text-sm text-red-600">{runError}</p></div>
        )}
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {([["analytics", "Analytics & Insights"], ["report", "Report & Activity Release"], ["agreement", "Team Agreement"], ["workshop", "Workshop"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-[var(--color-navy)] text-[var(--color-ink)] font-medium"
                    : "border-transparent text-[var(--color-grey)] hover:text-[var(--color-ink)]"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "report" ? (
        <div className="space-y-0">
          {/* Write + preview the member report, set release toggles, then release. */}
          <ReportReview
            teamId={teamId}
            tier1={tier1}
            tier2={interpretation}
            existingReport={(analysis?.phase3_report_json as Phase3ReportJson | null) ?? null}
          />
        </div>
      ) : activeTab === "analytics" ? (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-14">
          {/* Banner — textless ocean art (the TITLEONLY asset has baked-in zone
              labels that collide with the heading), darkened for legible text. */}
          <section className="relative rounded-2xl overflow-hidden">
            <img src="/ps-ocean.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,32,60,0.9) 0%, rgba(20,32,60,0.7) 60%, rgba(20,32,60,0.5) 100%)" }} />
            <div className="relative px-8 py-12 sm:py-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <h1 className="text-4xl sm:text-5xl text-white" style={{ fontFamily: "Playfair Display, serif", textShadow: "0 2px 14px rgba(0,0,0,0.45)" }}>
                  Analytics &amp; Insights
                </h1>
                <p className="text-base text-white/85 mt-2" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                  {team.team_name}{subtitle ? ` · ${subtitle}` : ""}
                </p>
                <p className="text-sm text-white/80 mt-3 max-w-xl" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                  {participationNote(completeCount, rosterSize)}
                </p>
              </div>
              {/* #8a — analysis controls belong to this section */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {interpretation && (
                  <button type="button" onClick={handleRunInterpretation} disabled={interpreting}
                    className="rounded-full border border-white/60 text-white px-4 py-2 text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-60">
                    {interpreting ? "Thinking…" : "Re-run read"}
                  </button>
                )}
                <button type="button" onClick={handleRunAnalysis} disabled={runningAnalysis}
                  className="rounded-full bg-white text-[var(--color-navy)] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-60">
                  {runningAnalysis ? "Running…" : "Re-run analysis"}
                </button>
              </div>
            </div>
          </section>

          {/* Run-interpretation CTA when the read hasn't been generated yet */}
          {!interpretation && (
            <div className="card border border-dashed border-black/20 text-center" style={{ padding: "28px 24px" }}>
              <p className="text-sm text-[var(--color-grey)] max-w-md mx-auto mb-5">
                The metrics are computed. Ask Otis to read them — it writes the psychological-safety and shared-purpose
                reads, and this round&apos;s focus.
              </p>
              <button type="button" onClick={handleRunInterpretation} disabled={interpreting} className="btn-primary">
                {interpreting ? "Otis is reading..." : "Run Otis's read"}
              </button>
              {interpretError && <p className="text-sm text-red-600 mt-4">{interpretError}</p>}
            </div>
          )}
          {interpretation && interpretError && <p className="text-sm text-red-600">{interpretError}</p>}

          {interpretation?.messy_or_insufficient_flag && (
            <p className="text-sm italic text-[var(--color-amber)]">
              Otis flagged this as a messy or thin read — treat the focus as a starting point and lean on the feedback round.
            </p>
          )}

          {/* Results & Team Agreement Activity completion — visible here so the consultant
              always knows who's in before opening the Team Agreement tab. */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-black/10 px-5 py-3" style={{ background: "rgba(20,32,60,0.04)" }}>
            <div>
              <span className="text-sm font-medium">Results &amp; Team Agreement Activity: {phase3CompletedCount}/{phase3TotalCount} members finished</span>
              {phase3TotalCount > 0 && phase3CompletedCount < phase3TotalCount && (
                <p className="text-xs text-[var(--color-grey)] mt-0.5">Waiting on: {phase3Outstanding.join(", ")}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${phase3AllComplete ? "bg-green-100 text-green-800" : phase3CompletedCount > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
              {phase3AllComplete ? "All finished" : phase3CompletedCount > 0 ? "In progress" : "Not started"}
            </span>
          </div>

          {/* ── a. SHARED PURPOSE — with the team's roles in their own words ── */}
          <SharedPurposePanel tier1={tier1} tier2={interpretation} />
          <FreeTextPanel
            title="Roles, in members' words"
            blurb="How each member described their own role and contribution. Raw, unanalysed — for your read only."
            entries={tier1.own_roles ?? []}
          />
          {/* ── b. PSYCHOLOGICAL SAFETY ── */}
          <PsSafetyPanel tier1={tier1} tier2={interpretation} />
          <FreeTextPanel
            title="Is psychological safety important to this team?"
            blurb="Members' own words, in response to whether PS matters for their team. Raw, unanalysed — for your read only. Dismissive or skeptical answers are also surfaced under Flagged concerns below."
            entries={tier1.ps_importance ?? []}
          />
          {focus && hasText(focus.hypothesis) && (
            <div className="rounded-2xl p-6" style={{ background: WORKSHOP_BG, border: `1px solid ${WORKSHOP_BORDER}`, borderLeft: `4px solid ${WORKSHOP_ACCENT}` }}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: WORKSHOP_ACCENT }}>◆ For the workshop</span>
                {focus.zone ? <span className={ZONE_BADGE[focus.zone] ?? ""}>{ZONE_SHORT[focus.zone] ?? `Zone ${focus.zone}`}</span> : null}
              </div>
              <h3 className="text-xl mb-1.5" style={{ fontFamily: "Playfair Display, serif" }}>Suggested focus for Team Agreement Activity</h3>
              <p className="text-base leading-relaxed">{focus.hypothesis}</p>
            </div>
          )}

          {/* ── c. FLAGGED CONCERNS (was "For you only — described, never quoted") ── */}
          {interpretation && hasText(interpretation.welfare_or_sensitive_note) && (
            <Accordion title={<span className="text-[var(--color-navy)] font-medium">Flagged concerns — described, never quoted</span>}>
              <p className="text-sm leading-relaxed">{interpretation.welfare_or_sensitive_note}</p>
            </Accordion>
          )}

          {/* ── d. HOW THE TEAM CONNECTS ── */}
          <TeamConnectivityPanel tier1={tier1} codes={completedCodes} />
        </div>
      ) : activeTab === "agreement" ? (
        <div className="space-y-0">
          <Phase4Panel
            teamId={teamId}
            initial={(analysis?.phase4_selfserve_json as Phase4SelfServeJson | null) ?? null}
            allComplete={phase3AllComplete}
            completedCount={phase3CompletedCount}
            totalCount={phase3TotalCount}
            outstanding={phase3Outstanding}
            tier1={tier1}
            tier2={interpretation}
            report={(analysis?.phase3_report_json as Phase3ReportJson | null) ?? null}
          />
        </div>
      ) : (
        // #11b — the Workshop screen carries the same accent as the "Suggested
        // focus for Team Agreement Activity" card, so the focus reads as its seed.
        <div className="min-h-[60vh]" style={{ background: WORKSHOP_BG }}>
          <WorkshopPanel
            teamId={teamId}
            teamName={team.team_name}
            members={members}
            focus={interpretation?.focus_hypothesis}
          />
        </div>
      )}

      {/* Persistent Otis chat, available in both tabs */}
      <OtisChatBubble teamId={teamId} />
    </main>
  );
}
