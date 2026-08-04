"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Analysis, Member, Team } from "@/types/database";
import {
  hasText, ZONE_BADGE, ZONE_SHORT,
  type Tier1Result, type Tier2Result,
} from "@/components/dashboard/types";
import SharedPurposePanel from "@/components/dashboard/SharedPurposePanel";
import PsSafetyPanel from "@/components/dashboard/PsSafetyPanel";
import TeamConnectivityPanel from "@/components/dashboard/TeamConnectivityPanel";
import OtisChatBubble from "@/components/dashboard/OtisChatBubble";
import WorkshopPanel from "@/components/workshop/WorkshopPanel";
import PreworkReview from "@/components/prework/PreworkReview";
import ReportReview from "@/components/phase3/ReportReview";
import Phase4Panel from "@/components/phase4/Phase4Panel";
import type { Phase3ReportJson, Phase4SelfServeJson } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeConfidence(n: number, rosterSize: number | null): "high" | "moderate" | "provisional" {
  if (rosterSize !== null && n >= rosterSize * 0.7 && n >= 3) return n >= 6 ? "high" : "moderate";
  return "provisional";
}

const CONF_LABEL: Record<string, string> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  provisional: "Provisional",
};
const CONF_CLS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  moderate: "bg-blue-100 text-blue-700",
  provisional: "bg-amber-100 text-amber-800",
};
const PS_GREEN = "#2D7A4F";

function memberStatusCls(m: Member) {
  if (m.status === "complete") return "bg-green-100 text-green-700";
  if (m.status === "in_progress") return "bg-blue-100 text-blue-700";
  if (m.status === "invited") return "bg-amber-100 text-amber-700";
  return "bg-gray-200 text-[var(--color-ink)]";
}
function memberStatusLabel(m: Member) {
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
function formatVirtuality(v: Team["virtuality_level"]) {
  if (v === "fully_remote") return "Fully remote";
  if (v === "hybrid") return "Hybrid";
  if (v === "mostly_in_person") return "Mostly in-person";
  return null;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDashboardPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const [supabase] = useState(() => createBrowserClient());

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

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

  async function load() {
    setLoading(true);
    const { data: teamData, error: teamErr } = await supabase
      .from("teams").select("*").eq("team_id", teamId).single();
    if (teamErr || !teamData) { setLoading(false); return; }
    setTeam(teamData);

    const [membersRes, analysisRes] = await Promise.all([
      supabase.from("members").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
      supabase.from("analysis").select("*").eq("team_id", teamId).maybeSingle(),
    ]);

    setMembers(membersRes.data ?? []);

    const aRow = analysisRes.data ?? null;
    setAnalysis(aRow);
    if (aRow) {
      setInterpretation((aRow.tier2_json as unknown as Tier2Result | null) ?? null);
    }

    setLoading(false);
  }

  async function fetchMembers() {
    const { data } = await supabase.from("members").select("*").eq("team_id", teamId).order("created_at");
    if (data) setMembers(data);
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
  const conf = computeConfidence(completeCount, team.roster_size);
  const tier1 = analysis?.tier1_json as unknown as Tier1Result | null;
  const subtitle = [team.industry, formatVirtuality(team.virtuality_level)].filter(Boolean).join(" · ");

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
            </div>
            <Link href="/" className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] whitespace-nowrap mt-2">
              ← Back to dashboard
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
                      <span className="bg-[var(--color-navy)] text-white text-xs px-3 py-1 rounded-full flex-shrink-0">
                        {m.private_code}
                      </span>
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
                    </div>
                  </div>
                ))}
              </div>

              {inviteError && <p className="mt-3 text-sm text-red-600">{inviteError}</p>}

              <div className="mt-4 flex items-center gap-4">
                <p className="text-sm text-[var(--color-grey)]">
                  {completeCount} of {totalCount} complete
                </p>
                {members.some((m) => m.email && (m.status === "pending" || m.status === "invited") && !m.invited_at) && (
                  <button type="button" onClick={handleSendAllPending} disabled={sendingAll}
                    className="text-sm text-[var(--color-purple)] font-medium hover:underline">
                    {sendingAll ? "Sending..." : "Send all pending invites"}
                  </button>
                )}
              </div>
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
                {conf === "high" ? "High confidence"
                  : conf === "moderate" ? "Moderate confidence"
                    : "Provisional (3+ members needed)"}
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
  const completedCodes = members.filter((m) => m.status === "complete").map((m) => m.private_code);
  const focus = interpretation?.focus_hypothesis;

  return (
    <main className="flex-1">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-black/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/" className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">← Dashboard</Link>
            <h2 className="text-lg" style={{ fontFamily: "Playfair Display, serif" }}>{team.team_name}</h2>
            <span className="text-sm text-[var(--color-grey)]">{completeCount} of {totalCount} complete</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${CONF_CLS[tier1.participation.confidence]}`}>
              {CONF_LABEL[tier1.participation.confidence]}
            </span>
            <Link href={`/teams/${teamId}/members`} className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
              Edit members
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--color-grey)]">Last analysed {formatDate(tier1.computed_at)}</span>
            {interpretation && (
              <button type="button" onClick={handleRunInterpretation} disabled={interpreting}
                className="btn-secondary" style={{ padding: "8px 16px", fontSize: "13px" }}>
                {interpreting ? "Thinking..." : "Re-run read"}
              </button>
            )}
            <button type="button" onClick={handleRunAnalysis} disabled={runningAnalysis}
              className="btn-secondary" style={{ padding: "8px 18px", fontSize: "13px" }}>
              {runningAnalysis ? "Running..." : "Re-run analysis"}
            </button>
          </div>
        </div>
        {runError && (
          <div className="max-w-6xl mx-auto px-6 pb-2"><p className="text-sm text-red-600">{runError}</p></div>
        )}
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {([["analytics", "Analytics & Insights"], ["report", "Phase 3"], ["agreement", "Team Agreement"], ["workshop", "Workshop"]] as const).map(([id, label]) => (
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
          {/* §1 — Write the member report + send emails to unlock /me/phase3 */}
          <ReportReview
            teamId={teamId}
            tier1={tier1}
            tier2={interpretation}
            existingReport={(analysis?.phase3_report_json as Phase3ReportJson | null) ?? null}
          />
          {/* §2 — Review member pre-work submissions (appears after members complete the survey) */}
          <div className="border-t border-black/10 mt-2 pt-2">
            <PreworkReview teamId={teamId} tier1={tier1} tier2={interpretation} />
          </div>
        </div>
      ) : activeTab === "analytics" ? (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-14">
          {/* Banner — textless ocean art (the TITLEONLY asset has baked-in zone
              labels that collide with the heading), darkened for legible text. */}
          <section className="relative rounded-2xl overflow-hidden">
            <img src="/ps-ocean.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-navy)]/85 to-[var(--color-navy)]/55" />
            <div className="relative px-8 py-10">
              <h1 className="text-3xl sm:text-4xl text-white" style={{ fontFamily: "Playfair Display, serif" }}>
                Analytics &amp; Insights
              </h1>
              <p className="text-sm text-white/80 mt-2">
                {team.team_name}{subtitle ? ` · ${subtitle}` : ""}
              </p>
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

          {/* Consultant-only read context (read-only; Phase 3 owns edit/approve) */}
          {interpretation && (
            <div className="space-y-4">
              {interpretation.messy_or_insufficient_flag && (
                <p className="text-sm italic text-[var(--color-amber)]">
                  Otis flagged this as a messy or thin read — treat the focus as a starting point and lean on the feedback round.
                </p>
              )}
              {focus && hasText(focus.hypothesis) && (
                <div className="rounded-2xl border border-[var(--color-purple)]/30 bg-[var(--color-purple)]/5 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs uppercase tracking-widest text-[var(--color-grey)]">This round&apos;s focus — a seed for the workshop</p>
                    {focus.zone ? <span className={ZONE_BADGE[focus.zone] ?? ""}>{ZONE_SHORT[focus.zone] ?? `Zone ${focus.zone}`}</span> : null}
                  </div>
                  <p className="text-base leading-relaxed">{focus.hypothesis}</p>
                </div>
              )}
              {hasText(interpretation.welfare_or_sensitive_note) && (
                <div className="rounded-xl border border-[var(--color-navy)]/30 bg-[var(--color-navy)]/5 px-5 py-4">
                  <p className="text-xs uppercase tracking-widest text-[var(--color-navy)] mb-1.5 font-medium">
                    For you only — described, never quoted
                  </p>
                  <p className="text-sm leading-relaxed">{interpretation.welfare_or_sensitive_note}</p>
                </div>
              )}
              {hasText(interpretation.data_quality_note) && (
                <p className="text-xs text-[var(--color-grey)]">{interpretation.data_quality_note}</p>
              )}
            </div>
          )}

          <SharedPurposePanel tier1={tier1} tier2={interpretation} />
          <PsSafetyPanel tier1={tier1} tier2={interpretation} />
          <TeamConnectivityPanel tier1={tier1} codes={completedCodes} />
        </div>
      ) : activeTab === "agreement" ? (
        <Phase4Panel
          teamId={teamId}
          initial={(analysis?.phase4_selfserve_json as Phase4SelfServeJson | null) ?? null}
          allComplete={members.length > 0 && members.every((m) => m.status === "complete")}
        />
      ) : (
        <WorkshopPanel
          teamId={teamId}
          teamName={team.team_name}
          members={members}
          focus={interpretation?.focus_hypothesis}
        />
      )}

      {/* Persistent Otis chat, available in both tabs */}
      <OtisChatBubble teamId={teamId} />
    </main>
  );
}
