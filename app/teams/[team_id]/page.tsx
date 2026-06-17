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
function severityColor(mean: number) {
  return mean < 2 ? PS_GREEN : mean <= 3 ? PS_YELLOW : PS_RED;
}

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
  const [openZone, setOpenZone] = useState<1 | 2 | 3 | null>(null);
  const [priorityOverride, setPriorityOverride] = useState<1 | 2 | 3 | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

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
        setRunError(
          data.error === "insufficient_responses"
            ? `Not enough responses — ${data.n_completed ?? 0} complete, need at least 3.`
            : "Something went wrong. Please try again."
        );
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
    const eligible = members.filter((m) => m.email && !m.invited_at && m.status !== "in_progress" && m.status !== "complete");
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
                      {m.email && !m.invited_at && m.status !== "in_progress" && m.status !== "complete" && (
                        <button type="button"
                          onClick={() => handleSendInvite(m.member_id)}
                          disabled={inviteSending.has(m.member_id)}
                          className="btn-secondary whitespace-nowrap"
                          style={{ padding: "4px 12px", fontSize: "12px" }}>
                          {inviteSending.has(m.member_id) ? "Sending..." : "Send invite"}
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
                {members.some((m) => m.email && !m.invited_at && m.status !== "in_progress" && m.status !== "complete") && (
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

        {/* ── Panel 3: Statement breakdown ──────────────────────────────── */}
        <section>
          <h2 className="text-3xl mb-6">Statement breakdown</h2>
          <div className="space-y-2">
            {([1, 2, 3] as const).map((zoneNum) => {
              const isOpen = openZone === zoneNum;
              const zoneStmts = tier1.ps_statements
                .filter((s) => stmtMap.get(s.statement_id)?.zone === zoneNum)
                .sort((a, b) => b.counts.red - a.counts.red);
              return (
                <div key={zoneNum} className="card overflow-hidden" style={{ padding: 0 }}>
                  <button type="button"
                    onClick={() => setOpenZone(isOpen ? null : zoneNum)}
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
                            <p className="text-xs text-[var(--color-grey)] mt-1">
                              {s.counts.green} of {total} answered green
                            </p>
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
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <p className="font-medium text-sm">{fish.name}</p>
                        <span className={ZONE_BADGE[zone]}>{ZONE_SHORT[zone]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden max-w-xs">
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(fish.flagged_pct, 100)}%`, backgroundColor: severityColor(fish.mean_severity) }} />
                        </div>
                        <p className="text-xs text-[var(--color-grey)] flex-shrink-0">
                          {Math.round(fish.flagged_pct)}% of members flagged this
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
        </section>

        {/* ── Panel 6: Coordination map ─────────────────────────────────── */}
        <section>
          <h2 className="text-3xl mb-2">How the team connects</h2>
          <p className="text-sm text-[var(--color-grey)] mb-6">
            Lines show coordination frequency. Dashed circles are peripheral members. Amber lines indicate asymmetric pairs.
          </p>
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
