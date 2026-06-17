"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Analysis, Fish, Member, PsStatement, Team } from "@/types/database";

// ── Tier 1 JSON shape ─────────────────────────────────────────────────────────

type ZoneStatus = "Strong" | "Mixed" | "Broken";
type ZoneResult = {
  pct_green: number;
  mean: number;
  status: ZoneStatus;
  counts: { green: number; yellow: number; red: number };
};
type StatementDist = {
  statement_id: number;
  counts: { green: number; yellow: number; red: number };
  responses: Array<{ private_code: string; label: "green" | "yellow" | "red" }>;
};
type DivergenceResult = {
  lean_green_count: number;
  lean_red_count: number;
  lean_mixed_count: number;
  is_divergent: boolean;
  outlier_private_codes: string[];
};
type RankedFish = {
  fish_id: string;
  name: string;
  mean_severity: number;
  flagged_count: number;
  flagged_pct: number;
  rank: number;
  responses: Array<{ private_code: string; severity_label: number }>;
};
type DirectedPair = {
  from_private_code: string;
  to_private_code: string | null;
  frequency: "daily" | "weekly" | "occasionally" | "rarely";
};
type AsymmetricPair = {
  high_freq_private_code: string;
  low_freq_private_code: string;
  high_frequency: string;
  low_frequency: string;
};
type PurposeEntry = {
  private_code: string;
  purpose_text: string;
  share_verbatim: boolean;
};
type Tier1Result = {
  computed_at: string;
  participation: {
    n_completed: number;
    roster_size: number | null;
    confidence: "high" | "moderate" | "provisional";
  };
  ps_zones: {
    zone1: ZoneResult;
    zone2: ZoneResult;
    zone3: ZoneResult;
    priority_zone: 1 | 2 | 3;
  };
  ps_statements: StatementDist[];
  divergence: {
    zone1: DivergenceResult;
    zone2: DivergenceResult;
    zone3: DivergenceResult;
  };
  fish: { ranked: RankedFish[]; custom: Array<{ private_code: string; custom_text: string; severity_label: number; share_verbatim: boolean }> };
  coordination: {
    pairs: DirectedPair[];
    peripheral_member_codes: string[];
    asymmetric_pairs: AsymmetricPair[];
  };
  purpose: PurposeEntry[];
};

// ── Tier 2 interpretation shape ─────────────────────────────────────────────────
type Tier2Assumption = {
  assumption: string;
  supporting_evidence?: string[];
  confidence?: "high" | "moderate" | "low";
  sure_or_unsure?: "sure" | "unsure";
  why_it_matters?: string;
  what_would_resonate_or_not?: string;
};
type Tier2FocusIssue = {
  target_rung?: string;
  fish?: string;
  vehicle?: string | null;
  buy_in_sentence?: string;
};
type Tier2PurposeAlignment = {
  level?: "strong" | "partial" | "divergent";
  description?: string;
};
type Tier2Result = {
  headline_read?: string;
  assumptions?: Tier2Assumption[];
  focus_issue?: Tier2FocusIssue;
  inout_plan?: string;
  deferred_for_later?: string[];
  messy_or_insufficient_flag?: boolean;
  focus_questions_for_feedback_round?: string[];
  context_questions_for_consultant?: string[];
  divergence_notes?: string;
  welfare_or_sensitive_note?: string;
  proposed_member_facing_summary?: string;
  purpose_alignment?: Tier2PurposeAlignment;
  data_quality_note?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeConfidence(n: number, rosterSize: number | null): "high" | "moderate" | "provisional" {
  if (rosterSize !== null && n >= rosterSize * 0.7 && n >= 3) return n >= 6 ? "high" : "moderate";
  return "provisional";
}

// True when a model-returned string carries real content (not empty, not "none").
function hasText(s?: string | null): s is string {
  return !!s && s.trim() !== "" && s.trim().toLowerCase() !== "none";
}

const TIER2_CONF_CLS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  moderate: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
};
const PURPOSE_LEVEL_CLS: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-700",
  divergent: "bg-red-100 text-red-700",
};

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

const ZONE_NAME = ["", "Safe to Belong", "Safe to Speak Freely", "Safe to Innovate"];
const ZONE_SHORT = ["", "Belonging", "Speaking up", "Learning"];
const ZONE_BADGE = ["", "badge-zone1", "badge-zone2", "badge-zone3"];
const PS_GREEN = "#2D7A4F", PS_YELLOW = "#C4860A", PS_RED = "#B94040";

function zoneBadge(status: ZoneStatus) {
  if (status === "Strong") return { label: "Strong", cls: "bg-green-100 text-green-800" };
  if (status === "Mixed") return { label: "Mixed", cls: "bg-amber-100 text-amber-700" };
  return { label: "Needs attention", cls: "bg-red-100 text-red-700" };
}

const SEVERITY_COLOR: Record<number, string> = {
  1: "#9CA3AF",   // not a problem
  2: PS_YELLOW,   // slightly concerning
  3: "#F97316",   // could be a dead fish
  4: PS_RED,      // definitely a dead fish
};
const SEVERITY_LABEL: Record<number, string> = {
  1: "Not a problem",
  2: "Slightly concerning",
  3: "Could be a dead fish",
  4: "Definitely a dead fish",
};

// ── Zone card ─────────────────────────────────────────────────────────────────

function ZoneCard({ num, result, div, isPriority }: {
  num: 1 | 2 | 3;
  result: ZoneResult;
  div: DivergenceResult;
  isPriority: boolean;
}) {
  const badge = zoneBadge(result.status);
  const total = result.counts.green + result.counts.yellow + result.counts.red;
  const pG = total > 0 ? (result.counts.green / total) * 100 : 0;
  const pY = total > 0 ? (result.counts.yellow / total) * 100 : 0;
  const pR = total > 0 ? (result.counts.red / total) * 100 : 0;
  const mainColor = result.pct_green >= 75 ? PS_GREEN : result.pct_green >= 50 ? PS_YELLOW : PS_RED;

  return (
    <div className={`card relative${isPriority ? " border-2 border-[var(--color-purple)]" : ""}`}>
      {isPriority && (
        <span className="absolute top-4 right-4 text-xs font-medium text-[var(--color-purple)] uppercase tracking-wide">
          Priority
        </span>
      )}
      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-1">Zone {num}</p>
      <h3 className="text-lg mb-4" style={{ fontFamily: "Playfair Display, serif" }}>
        {ZONE_NAME[num]}
      </h3>
      <div className="text-4xl font-bold mb-3" style={{ color: mainColor }}>
        {Math.round(result.pct_green)}%
      </div>
      <div className="h-3 rounded-full overflow-hidden flex mb-3" style={{ backgroundColor: "#E5E7EB" }}>
        <div style={{ width: `${pG}%`, backgroundColor: PS_GREEN }} />
        <div style={{ width: `${pY}%`, backgroundColor: PS_YELLOW }} />
        <div style={{ width: `${pR}%`, backgroundColor: PS_RED }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-3 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
        {div.is_divergent && (
          <span className="text-xs px-3 py-1 rounded-full bg-[var(--color-navy)] text-white">Divergent</span>
        )}
      </div>
    </div>
  );
}

// ── Coordination map (SVG) ────────────────────────────────────────────────────

function CoordinationMap({ pairs, codes, peripheralCodes, asymmetricPairs }: {
  pairs: DirectedPair[];
  codes: string[];
  peripheralCodes: string[];
  asymmetricPairs: AsymmetricPair[];
}) {
  const n = codes.length;
  if (n === 0) return null;
  const cx = 250, cy = 250, R = 175, nodeR = 22;

  const pos: Record<string, { x: number; y: number }> = {};
  codes.forEach((c, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos[c] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  const asymSet = new Set(
    asymmetricPairs.flatMap((ap) => [`${ap.high_freq_private_code}:${ap.low_freq_private_code}`, `${ap.low_freq_private_code}:${ap.high_freq_private_code}`])
  );
  const freqColor: Record<string, string> = { daily: PS_GREEN, weekly: "#3B82F6", occasionally: "#9CA3AF", rarely: "#D1D5DB" };
  const freqWidth: Record<string, number> = { daily: 2.5, weekly: 1.5, occasionally: 1, rarely: 0.75 };

  return (
    <svg viewBox="0 0 500 500" className="w-full max-w-md mx-auto" aria-label="Team coordination network">
      {pairs.filter((p) => p.to_private_code).map((p, i) => {
        const f = pos[p.from_private_code], t = pos[p.to_private_code!];
        if (!f || !t) return null;
        const isAsym = asymSet.has(`${p.from_private_code}:${p.to_private_code}`);
        return (
          <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
            stroke={isAsym ? PS_YELLOW : (freqColor[p.frequency] ?? "#D1D5DB")}
            strokeWidth={freqWidth[p.frequency] ?? 1}
            strokeOpacity={p.frequency === "rarely" ? 0.3 : 0.65}
          />
        );
      })}
      {codes.map((c) => {
        const p = pos[c];
        if (!p) return null;
        const isPeri = peripheralCodes.includes(c);
        return (
          <g key={c}>
            <circle cx={p.x} cy={p.y} r={nodeR}
              fill="rgba(255,255,255,0.88)"
              stroke={isPeri ? "#9CA3AF" : "#1A1A2E"}
              strokeWidth={isPeri ? 1.5 : 2}
              strokeDasharray={isPeri ? "4 3" : undefined}
            />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontFamily="DM Sans, sans-serif" fontWeight="600" fill="#1A1A2E"
            >
              {c}
            </text>
          </g>
        );
      })}
      {asymmetricPairs.map((ap, i) => {
        const f = pos[ap.high_freq_private_code], t = pos[ap.low_freq_private_code];
        if (!f || !t) return null;
        return (
          <text key={i} x={(f.x + t.x) / 2} y={(f.y + t.y) / 2}
            textAnchor="middle" fontSize={13} fill={PS_YELLOW}>⚠</text>
        );
      })}
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDashboardPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const [supabase] = useState(() => createBrowserClient());

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [psStatements, setPsStatements] = useState<PsStatement[]>([]);
  const [teamFish, setTeamFish] = useState<Fish[]>([]);

  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [openZones, setOpenZones] = useState<Set<1 | 2 | 3>>(new Set());
  const [priorityOverride, setPriorityOverride] = useState<1 | 2 | 3 | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [interpretation, setInterpretation] = useState<Tier2Result | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  useEffect(() => { load(); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const { data: teamData, error: teamErr } = await supabase
      .from("teams").select("*").eq("team_id", teamId).single();
    if (teamErr || !teamData) { setLoading(false); return; }
    setTeam(teamData);

    const [membersRes, analysisRes, stmtsRes] = await Promise.all([
      supabase.from("members").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
      supabase.from("analysis").select("*").eq("team_id", teamId).maybeSingle(),
      supabase.from("ps_statements").select("*").order("statement_id", { ascending: true }),
    ]);

    setMembers(membersRes.data ?? []);
    setPsStatements(stmtsRes.data ?? []);

    const aRow = analysisRes.data ?? null;
    setAnalysis(aRow);
    if (aRow) {
      setApproved(aRow.consultant_approved);
      const fi = aRow.focus_issue;
      if (fi === "1" || fi === "2" || fi === "3") setPriorityOverride(parseInt(fi) as 1 | 2 | 3);
      setInterpretation((aRow.tier2_json as unknown as Tier2Result | null) ?? null);
    }

    if (teamData.selected_fish_ids.length > 0) {
      const { data: fishData } = await supabase
        .from("fish").select("*").in("fish_id", teamData.selected_fish_ids);
      setTeamFish(fishData ?? []);
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
        setInterpretError(`Showing the read, but it was not saved: ${data._save_warning}. Add the tier2_json column to persist it.`);
      }
    } catch {
      setInterpretError("Something went wrong reaching Wavelength. Please try again.");
    }
    setInterpreting(false);
  }

  async function handlePriorityChange(zone: 1 | 2 | 3) {
    setPriorityOverride(zone);
    await supabase.from("analysis").update({ focus_issue: String(zone) }).eq("team_id", teamId);
  }

  async function handleApprove() {
    setApproving(true);
    await Promise.all([
      supabase.from("analysis").update({ consultant_approved: true }).eq("team_id", teamId),
      supabase.from("teams").update({ status: "feedback" }).eq("team_id", teamId),
    ]);
    setApproved(true);
    setTeam((prev) => prev ? { ...prev, status: "feedback" } : prev);
    setApproving(false);
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
  const effectivePriority = priorityOverride ?? tier1?.ps_zones.priority_zone ?? 1;
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
                <Link href={`/teams/${teamId}/fish`} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
                  Fish settings
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
                    {runningAnalysis ? "Wavelength is thinking..." : "Run analysis"}
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
  const fishMap = new Map(teamFish.map((f) => [f.fish_id, f]));
  const stmtMap = new Map(psStatements.map((s) => [s.statement_id, s]));
  const completedCodes = members.filter((m) => m.status === "complete").map((m) => m.private_code);

  const zones: { num: 1 | 2 | 3; result: ZoneResult; div: DivergenceResult }[] = [
    { num: 1, result: tier1.ps_zones.zone1, div: tier1.divergence.zone1 },
    { num: 2, result: tier1.ps_zones.zone2, div: tier1.divergence.zone2 },
    { num: 3, result: tier1.ps_zones.zone3, div: tier1.divergence.zone3 },
  ];

  return (
    <main className="flex-1">
      {/* ── Panel 1: Sticky header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-black/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/" className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">
              ← Dashboard
            </Link>
            <h2 className="text-lg" style={{ fontFamily: "Playfair Display, serif" }}>{team.team_name}</h2>
            <span className="text-sm text-[var(--color-grey)]">{completeCount} of {totalCount} complete</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${CONF_CLS[tier1.participation.confidence]}`}>
              {CONF_LABEL[tier1.participation.confidence]}
            </span>
            <Link href={`/teams/${teamId}/members`} className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
              Edit members
            </Link>
            <Link href={`/teams/${teamId}/fish`} className="text-xs text-[var(--color-grey)] hover:text-[var(--color-ink)] underline">
              Fish settings
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--color-grey)]">
              Last analysed {formatDate(tier1.computed_at)}
            </span>
            <button type="button" onClick={handleRunAnalysis} disabled={runningAnalysis}
              className="btn-secondary" style={{ padding: "8px 18px", fontSize: "13px" }}>
              {runningAnalysis ? "Running..." : "Re-run analysis"}
            </button>
          </div>
        </div>
        {runError && (
          <div className="max-w-6xl mx-auto px-6 pb-2">
            <p className="text-sm text-red-600">{runError}</p>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-14">

        {/* ── Panel 2: Zone overview ────────────────────────────────────── */}
        <section>
          <h2 className="text-3xl mb-2">Psychological safety</h2>
          <p className="text-sm text-[var(--color-grey)] mb-6">
            Zones represent the three levels of psychological safety. The priority zone is where the team needs the most attention first.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {zones.map(({ num, result, div }) => (
              <ZoneCard key={num} num={num} result={result} div={div} isPriority={effectivePriority === num} />
            ))}
          </div>
        </section>

        {/* ── Panel 2b: Wavelength's interpretation (Tier 2 AI) ─────────────── */}
        <section id="wavelength-read">
          <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
            <h2 className="text-3xl">Wavelength&apos;s read</h2>
            {interpretation && (
              <button type="button" onClick={handleRunInterpretation} disabled={interpreting}
                className="btn-secondary" style={{ padding: "8px 18px", fontSize: "13px" }}>
                {interpreting ? "Thinking..." : "Re-run interpretation"}
              </button>
            )}
          </div>
          <p className="text-sm text-[var(--color-grey)] mb-6">
            Wavelength reads the numbers and the words together, then proposes assumptions to check with the team. Everything here is provisional until you approve it.
          </p>

          {!interpretation ? (
            <div className="card border border-dashed border-black/20 text-center" style={{ padding: "32px 24px" }}>
              <img src="/wavelength-mark.png" alt="" className="h-10 w-auto mx-auto mb-4 opacity-80"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <p className="text-sm text-[var(--color-grey)] max-w-md mx-auto mb-6">
                Ask Wavelength to interpret this team&apos;s results. It will surface strengths, name the focus issue, and draft questions for the feedback round.
              </p>
              <button type="button" onClick={handleRunInterpretation} disabled={interpreting}
                className="btn-primary">
                {interpreting ? "Wavelength is reading..." : "Run AI interpretation"}
              </button>
              {interpretError && <p className="text-sm text-red-600 mt-4">{interpretError}</p>}
              <p className="text-xs text-[var(--color-grey)] mt-6 max-w-md mx-auto">
                Members who kept their words private still inform the analysis — their responses shape the read but are never quoted.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {interpretError && <p className="text-sm text-red-600">{interpretError}</p>}

              {interpretation.messy_or_insufficient_flag && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Wavelength flagged this data as messy or insufficient for a confident read. Treat the focus below as a starting point and lean on the feedback round.
                </div>
              )}

              {/* Headline */}
              {hasText(interpretation.headline_read) && (
                <div className="card" style={{ padding: "20px 24px" }}>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">The honest gist</p>
                  <p className="text-lg leading-relaxed" style={{ fontFamily: "Playfair Display, serif" }}>
                    {interpretation.headline_read}
                  </p>
                </div>
              )}

              {/* Purpose alignment + Focus issue */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {interpretation.purpose_alignment && (hasText(interpretation.purpose_alignment.description) || interpretation.purpose_alignment.level) && (
                  <div className="card" style={{ padding: "18px 20px" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)]">Shared purpose</p>
                      {interpretation.purpose_alignment.level && (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full capitalize ${PURPOSE_LEVEL_CLS[interpretation.purpose_alignment.level] ?? "bg-gray-100 text-gray-700"}`}>
                          {interpretation.purpose_alignment.level}
                        </span>
                      )}
                    </div>
                    {hasText(interpretation.purpose_alignment.description) && (
                      <p className="text-sm leading-relaxed">{interpretation.purpose_alignment.description}</p>
                    )}
                  </div>
                )}

                {interpretation.focus_issue && (
                  <div className="card border border-[var(--color-purple)]/40" style={{ padding: "18px 20px" }}>
                    <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Focus issue</p>
                    {hasText(interpretation.focus_issue.buy_in_sentence) && (
                      <p className="text-sm font-medium leading-relaxed mb-3">&ldquo;{interpretation.focus_issue.buy_in_sentence}&rdquo;</p>
                    )}
                    <dl className="text-xs text-[var(--color-grey)] space-y-1">
                      {hasText(interpretation.focus_issue.target_rung) && (
                        <div><span className="font-medium text-[var(--color-ink)]">Target rung:</span> {interpretation.focus_issue.target_rung}</div>
                      )}
                      {hasText(interpretation.focus_issue.fish) && (
                        <div><span className="font-medium text-[var(--color-ink)]">Fish:</span> {interpretation.focus_issue.fish}</div>
                      )}
                      {hasText(interpretation.focus_issue.vehicle) && (
                        <div><span className="font-medium text-[var(--color-ink)]">Vehicle:</span> {interpretation.focus_issue.vehicle}</div>
                      )}
                    </dl>
                  </div>
                )}
              </div>

              {/* Assumptions */}
              {interpretation.assumptions && interpretation.assumptions.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Assumptions to check with the team</h3>
                  <div className="space-y-3">
                    {interpretation.assumptions.map((a, i) => (
                      <div key={i} className="card" style={{ padding: "16px 20px" }}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm font-medium leading-relaxed flex-1">{a.assumption}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {a.confidence && (
                              <span className={`text-xs px-2.5 py-0.5 rounded-full capitalize ${TIER2_CONF_CLS[a.confidence] ?? "bg-gray-100 text-gray-700"}`}>
                                {a.confidence}
                              </span>
                            )}
                            {a.sure_or_unsure && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--color-navy)] text-white capitalize">
                                {a.sure_or_unsure}
                              </span>
                            )}
                          </div>
                        </div>
                        {a.supporting_evidence && a.supporting_evidence.length > 0 && (
                          <ul className="text-xs text-[var(--color-grey)] list-disc pl-4 space-y-0.5 mb-2">
                            {a.supporting_evidence.map((e, j) => <li key={j}>{e}</li>)}
                          </ul>
                        )}
                        {hasText(a.why_it_matters) && (
                          <p className="text-xs text-[var(--color-grey)]"><span className="font-medium text-[var(--color-ink)]">Why it matters:</span> {a.why_it_matters}</p>
                        )}
                        {hasText(a.what_would_resonate_or_not) && (
                          <p className="text-xs text-[var(--color-grey)] mt-1"><span className="font-medium text-[var(--color-ink)]">What would resonate or not:</span> {a.what_would_resonate_or_not}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In/out plan + questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hasText(interpretation.inout_plan) && (
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">More-of / less-of framing</p>
                    <p className="text-sm leading-relaxed">{interpretation.inout_plan}</p>
                  </div>
                )}
                {interpretation.focus_questions_for_feedback_round && interpretation.focus_questions_for_feedback_round.length > 0 && (
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Questions for the feedback round</p>
                    <ul className="text-sm list-disc pl-4 space-y-1">
                      {interpretation.focus_questions_for_feedback_round.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {/* Context questions for consultant */}
              {interpretation.context_questions_for_consultant && interpretation.context_questions_for_consultant.length > 0 && (
                <div className="card" style={{ padding: "16px 20px" }}>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">What would sharpen the read (for you)</p>
                  <ul className="text-sm list-disc pl-4 space-y-1">
                    {interpretation.context_questions_for_consultant.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              )}

              {/* Divergence + deferred */}
              {(hasText(interpretation.divergence_notes) || (interpretation.deferred_for_later && interpretation.deferred_for_later.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hasText(interpretation.divergence_notes) && (
                    <div className="card" style={{ padding: "16px 20px" }}>
                      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Divergence</p>
                      <p className="text-sm leading-relaxed">{interpretation.divergence_notes}</p>
                    </div>
                  )}
                  {interpretation.deferred_for_later && interpretation.deferred_for_later.length > 0 && (
                    <div className="card" style={{ padding: "16px 20px" }}>
                      <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Deferred for a future round</p>
                      <ul className="text-sm list-disc pl-4 space-y-1">
                        {interpretation.deferred_for_later.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Welfare note — private to consultant */}
              {hasText(interpretation.welfare_or_sensitive_note) && (
                <div className="rounded-lg border border-[var(--color-navy)]/30 bg-[var(--color-navy)]/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-[var(--color-navy)] mb-1.5 font-medium">Private welfare note — for you only</p>
                  <p className="text-sm leading-relaxed">{interpretation.welfare_or_sensitive_note}</p>
                </div>
              )}

              {/* Proposed member-facing summary */}
              {hasText(interpretation.proposed_member_facing_summary) && (
                <div className="card border border-dashed border-black/20" style={{ padding: "18px 20px" }}>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-2">Draft summary for members — pending your approval</p>
                  <p className="text-sm leading-relaxed italic">{interpretation.proposed_member_facing_summary}</p>
                </div>
              )}

              {hasText(interpretation.data_quality_note) && (
                <p className="text-xs text-[var(--color-grey)]">{interpretation.data_quality_note}</p>
              )}
            </div>
          )}
        </section>

        {/* ── Panel 3: Statement breakdown ──────────────────────────────── */}
        <section>
          <h2 className="text-3xl mb-6">Statement breakdown</h2>
          <div className="space-y-2">
            {([1, 2, 3] as const).map((zoneNum) => {
              const isOpen = openZones.has(zoneNum);
              const zoneStmts = tier1.ps_statements
                .filter((s) => stmtMap.get(s.statement_id)?.zone === zoneNum)
                .sort((a, b) => b.counts.red - a.counts.red);
              return (
                <div key={zoneNum} className="card overflow-hidden" style={{ padding: 0 }}>
                  <button type="button"
                    onClick={() => setOpenZones((prev) => {
                      const next = new Set(prev);
                      if (next.has(zoneNum)) next.delete(zoneNum); else next.add(zoneNum);
                      return next;
                    })}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-black/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={ZONE_BADGE[zoneNum]}>{ZONE_SHORT[zoneNum]}</span>
                      <span className="font-medium">{ZONE_NAME[zoneNum]}</span>
                    </div>
                    <span className="text-[var(--color-grey)] text-xl leading-none">{isOpen ? "−" : "+"}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-black/5 px-6 pb-6">
                      {zoneStmts.length === 0 ? (
                        <p className="text-sm text-[var(--color-grey)] pt-4">No data for this zone.</p>
                      ) : zoneStmts.map((s) => {
                        const st = stmtMap.get(s.statement_id);
                        const total = s.counts.green + s.counts.yellow + s.counts.red;
                        const mean = total > 0
                          ? (s.counts.green * 3 + s.counts.yellow * 2 + s.counts.red * 1) / total
                          : 0;
                        const isMixed = s.counts.green >= 1 && s.counts.red >= 1;
                        return (
                          <div key={s.statement_id} className="pt-4 pb-3 border-b border-black/5 last:border-0">
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-sm flex-1 leading-relaxed">
                                {st?.statement_text ?? `Statement ${s.statement_id}`}
                              </p>
                              <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                                {s.responses.map((r, i) => (
                                  <span key={i} title={r.private_code}
                                    className="w-3.5 h-3.5 rounded-full inline-block cursor-help"
                                    style={{ backgroundColor: r.label === "green" ? PS_GREEN : r.label === "yellow" ? PS_YELLOW : PS_RED }}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-[var(--color-grey)] mt-1.5">
                              Mean: {mean.toFixed(1)} / 3.0
                            </p>
                            <p className="text-xs mt-0.5">
                              <span style={{ color: PS_GREEN }}>Green: {s.counts.green}</span>
                              {" · "}
                              <span style={{ color: PS_YELLOW }}>Yellow: {s.counts.yellow}</span>
                              {" · "}
                              <span style={{ color: PS_RED }}>Red: {s.counts.red}</span>
                            </p>
                            {isMixed && (
                              <p className="text-xs italic mt-1" style={{ color: PS_YELLOW }}>
                                Mixed responses — members experience this differently.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Panel 4: Dead fish ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-3xl">Dead fish</h2>
            <img src="/dead-fish.png" alt="" className="h-6 w-auto" />
          </div>
          {tier1.fish.ranked.length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">No fish response data yet.</p>
          ) : (
            <>
            <div className="space-y-2">
              {tier1.fish.ranked.slice(0, 5).map((fish, idx) => {
                const fd = fishMap.get(fish.fish_id);
                const zone = fd?.maps_to_zone ?? 1;
                return (
                  <div key={fish.fish_id}
                    className={`card flex items-center gap-4${idx === 0 ? " bg-[var(--color-purple)]/5" : ""}`}
                    style={{ padding: "14px 20px" }}>
                    <span className="flex-shrink-0 h-7 w-7 rounded-full bg-[var(--color-navy)] text-white text-xs flex items-center justify-center font-semibold">
                      {fish.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <p className="font-medium text-sm">{fish.name}</p>
                        <span className={ZONE_BADGE[zone]}>{ZONE_SHORT[zone]}</span>
                      </div>
                      {fish.responses && fish.responses.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {fish.responses.map((r, i) => (
                            <span key={i}
                              title={`${r.private_code}: ${SEVERITY_LABEL[r.severity_label] ?? r.severity_label}`}
                              className="flex items-center gap-1 cursor-help">
                              <span className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                                style={{ backgroundColor: SEVERITY_COLOR[r.severity_label] ?? "#9CA3AF" }} />
                              <span className="text-xs text-[var(--color-grey)]">{r.private_code}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[var(--color-grey)]">
                        Mean severity: {fish.mean_severity.toFixed(1)} / 4.0 · {Math.round(fish.flagged_pct)}% flagged
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[var(--color-grey)] mt-4 leading-relaxed">
              &lsquo;Flagged&rsquo; means the member rated this pattern as &ldquo;This could be a dead fish&rdquo; or &ldquo;This is definitely a dead fish&rdquo; (options 3 or 4 on the scale).
            </p>
            </>
          )}
        </section>

        {/* ── Panel 5: Purpose alignment ────────────────────────────────── */}
        <section>
          <h2 className="text-3xl mb-6">Shared purpose</h2>
          {tier1.purpose.length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">No purpose responses recorded.</p>
          ) : (
            <div className="space-y-3">
              {tier1.purpose.map((entry, i) => (
                <div key={i} className="card" style={{ padding: "16px 20px" }}>
                  <div className="flex items-start gap-3">
                    <span className="bg-[var(--color-navy)] text-white text-xs px-3 py-1 rounded-full flex-shrink-0 mt-0.5">
                      {entry.private_code}
                    </span>
                    {entry.share_verbatim ? (
                      <p className="text-sm leading-relaxed">{entry.purpose_text}</p>
                    ) : (
                      <p className="text-sm text-[var(--color-grey)] italic">
                        This member preferred to keep their words private.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-6 text-xs text-[var(--color-grey)]">
            Wavelength&apos;s purpose alignment read is in the{" "}
            <a href="#wavelength-read" className="underline">Wavelength&apos;s read</a> panel above.
            Members who kept their words private still inform the alignment analysis — their responses are never quoted directly.
          </p>
        </section>

        {/* ── Panel 6: Coordination map ─────────────────────────────────── */}
        <section>
          <h2 className="text-3xl mb-2">How the team connects</h2>
          <p className="text-sm text-[var(--color-grey)] mb-6">
            Lines show coordination frequency. Dashed circles are peripheral members. Amber lines indicate asymmetric pairs.
          </p>
          {tier1.coordination.pairs.length > 0 && (() => {
            const n = completedCodes.length;
            const totalPossible = n * (n - 1);
            const activePairs = tier1.coordination.pairs.filter(
              (p) => p.to_private_code && (p.frequency === "daily" || p.frequency === "weekly")
            ).length;
            const density = totalPossible > 0 ? Math.round((activePairs / totalPossible) * 100) : 0;

            const incomingCounts = new Map<string, number>(completedCodes.map((c) => [c, 0]));
            for (const p of tier1.coordination.pairs) {
              if (p.to_private_code && (p.frequency === "daily" || p.frequency === "weekly")) {
                incomingCounts.set(p.to_private_code, (incomingCounts.get(p.to_private_code) ?? 0) + 1);
              }
            }
            const sorted = [...completedCodes].sort(
              (a, b) => (incomingCounts.get(b) ?? 0) - (incomingCounts.get(a) ?? 0)
            );
            const mostConnected = sorted[0] ?? null;
            const leastConnected = sorted[sorted.length - 1] ?? null;
            const asymCount = tier1.coordination.asymmetric_pairs.length;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="card" style={{ padding: "16px 20px" }}>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">Network summary</p>
                  <p className="text-sm mb-1.5">
                    <span className="font-medium">Team density:</span>{" "}
                    <span className="text-[var(--color-grey)]">{density}% of possible connections are active (weekly or more)</span>
                  </p>
                  {asymCount > 0 && (
                    <p className="text-sm" style={{ color: PS_YELLOW }}>
                      {asymCount} asymmetric pair{asymCount !== 1 ? "s" : ""} detected — where one member reports coordinating more frequently than the other.
                    </p>
                  )}
                </div>
                <div className="card" style={{ padding: "16px 20px" }}>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-3">Connectivity</p>
                  {mostConnected && (
                    <p className="text-sm mb-1.5">
                      <span className="font-medium">Most connected:</span>{" "}
                      <span className="bg-[var(--color-navy)] text-white text-xs px-2 py-0.5 rounded-full">{mostConnected}</span>
                    </p>
                  )}
                  {leastConnected && leastConnected !== mostConnected && (
                    <p className="text-sm">
                      <span className="font-medium">Least connected:</span>{" "}
                      <span className="bg-[var(--color-navy)] text-white text-xs px-2 py-0.5 rounded-full">{leastConnected}</span>
                      <span className="text-[var(--color-grey)] text-xs ml-2">— may be working in relative isolation</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
          {tier1.coordination.pairs.length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">No coordination data yet.</p>
          ) : (
            <>
              <CoordinationMap
                pairs={tier1.coordination.pairs}
                codes={completedCodes}
                peripheralCodes={tier1.coordination.peripheral_member_codes}
                asymmetricPairs={tier1.coordination.asymmetric_pairs}
              />
              <div className="flex flex-wrap gap-5 mt-4 text-xs text-[var(--color-grey)] justify-center">
                {[
                  { color: PS_GREEN, label: "Daily" },
                  { color: "#3B82F6", label: "Weekly" },
                  { color: "#9CA3AF", label: "Occasionally" },
                  { color: "#D1D5DB", label: "Rarely" },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3.5 h-3.5 rounded-full border border-dashed border-[#9CA3AF]" />
                  Peripheral
                </span>
                <span className="flex items-center gap-1.5">
                  <span style={{ color: PS_YELLOW }}>⚠</span>
                  Asymmetric
                </span>
              </div>
            </>
          )}
        </section>

        {/* ── Panel 7: Consultant controls ──────────────────────────────── */}
        <section className="border-t border-black/10 pt-10">
          <p className="text-xs uppercase tracking-widest text-[var(--color-grey)] mb-6">
            Consultant controls — these affect what members see
          </p>
          <div className="card space-y-8">
            <div>
              <label className="form-label">Priority zone</label>
              <select
                value={effectivePriority}
                onChange={(e) => handlePriorityChange(parseInt(e.target.value) as 1 | 2 | 3)}
                className="form-input mt-1"
                style={{ maxWidth: "320px" }}
              >
                <option value={1}>Zone 1 — Safe to Belong</option>
                <option value={2}>Zone 2 — Safe to Speak Freely</option>
                <option value={3}>Zone 3 — Safe to Innovate</option>
              </select>
              <p className="text-xs text-[var(--color-grey)] mt-1">
                Computed: Zone {tier1.ps_zones.priority_zone}
                {priorityOverride ? " · overridden by you" : ""}
              </p>
            </div>

            <div>
              {approved ? (
                <p className="text-sm font-medium text-green-700">
                  ✓ Analysis approved and released to members.
                </p>
              ) : (
                <button type="button" onClick={handleApprove} disabled={approving} className="btn-primary">
                  {approving ? "Saving..." : "Approve and release to members"}
                </button>
              )}
              <p className="text-xs text-[var(--color-grey)] mt-2">All changes are logged.</p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
