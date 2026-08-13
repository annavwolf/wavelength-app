"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Phase3ReportJson, PsStatement } from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";
import Phase3ReleasePreview from "@/components/phase3/Phase3ReleasePreview";

const TEAM_ASSESSMENT: { section: string; title: string; body: string }[] = [
  {
    section: "Privacy",
    title: "Beta privacy information",
    body: "Before the assessment opens, members read the beta privacy notice, choose whether short exact excerpts may be used without their name, choose whether to enable optional enhanced audio, and acknowledge the notice. Text input remains available.",
  },
  {
    section: "Introduction",
    title: "Landing & read-aloud",
    body: "Only after acknowledgement, Otis introduces himself and offers to read messages aloud.",
  },
  {
    section: "About You",
    title: "Profile & work location",
    body: "Name, with an optional broad work location. A recognised city and country can set a time zone automatically. The assessment does not request demographic details or a street address.",
  },
  {
    section: "About You",
    title: "Purpose & team name",
    body: "What the member thinks the team is for and an optional suggested team name.",
  },
  {
    section: "About You",
    title: "Roster & own role",
    body: "Review the roster and describe their own role and contribution to the team.",
  },
  { section: "About You", title: "Coordination", body: "How often they work with each teammate." },
  {
    section: "Psychological safety",
    title: "Why it matters",
    body: "Otis explains psychological safety and how the assessment works.",
  },
  {
    section: "Psychological safety",
    title: "The ocean descent",
    body: "The three-zone ocean metaphor for psychological safety.",
  },
  {
    section: "Psychological safety",
    title: "Diagnostic ratings",
    body: "The member rates each psychological-safety statement for their team.",
  },
  {
    section: "Psychological safety",
    title: "Is psychological safety important?",
    body: "Their own words on whether psychological safety matters here.",
  },
  {
    section: "Finish",
    title: "What happens next, review & close",
    body: "A recap, an editable review, and submission, with the option to withdraw.",
  },
];

const SECTION_COLOR: Record<string, string> = {
  Privacy: "#2E6E5E",
  Introduction: "#6B4EA8",
  "About You": "#A05A46",
  "Psychological safety": "#1A5A6E",
  Finish: "#2E6E5E",
};

function emptyReport(): Phase3ReportJson {
  return {
    ps_read_overall: "",
    ps_read_zone1: "",
    ps_read_zone2: "",
    ps_read_zone3: "",
    shared_purpose_read: "",
    focus_statement_id: null,
    focus_narrative: "",
    workshop_intro: "",
    include_shared_purpose: false,
    include_stories: true,
    include_rationalization_in_report: false,
    released_at: null,
    sent_member_ids: [],
  };
}

export default function JourneyPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const [report, setReport] = useState<Phase3ReportJson>(emptyReport());
  const [statements, setStatements] = useState<PsStatement[]>([]);
  const [spClassification, setSpClassification] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadJourney() {
      try {
        const response = await fetch(`/api/teams/${teamId}/journey`, { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to load the member journey.");
        if (cancelled) return;

        const analysis = data?.analysis;
        const tier1 = analysis?.tier1_json as Tier1Result | null | undefined;
        const tier2 = analysis?.tier2_json as Tier2Result | null | undefined;
        const releasedReport = analysis?.phase3_report_json as Phase3ReportJson | null | undefined;

        if (releasedReport) setReport(releasedReport);
        setStatements((data?.statements ?? tier1?.ps_statements ?? []) as PsStatement[]);
        setSpClassification(tier2?.shared_purpose_read?.classification);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the member journey.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadJourney();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const focusStatement = statements.find((statement) => statement.statement_id === report.focus_statement_id) ?? null;

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl" style={{ fontFamily: "Playfair Display, serif" }}>
            The full member journey
          </h1>
          <Link href={`/teams/${teamId}`} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">
            ← Back to dashboard
          </Link>
        </div>
        <p className="text-sm text-[var(--color-grey)] mb-10">
          Everything members experience, in order, for transparency. Read-only.
        </p>

        <section className="mb-12">
          <h2 className="text-xl mb-1" style={{ fontFamily: "Playfair Display, serif" }}>1 · Team Assessment</h2>
          <p className="text-sm text-[var(--color-grey)] mb-4">The initial survey members complete first.</p>
          <ol className="space-y-2.5">
            {TEAM_ASSESSMENT.map((item, index) => (
              <li key={`${item.section}-${item.title}`} className="rounded-xl border border-black/10 bg-white px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ background: SECTION_COLOR[item.section] ?? "#6B4EA8" }}
                  >
                    {item.section}
                  </span>
                  <span className="text-xs text-[var(--color-grey)]">{index + 1}</span>
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                <p className="text-sm text-[var(--color-ink)] leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-xl mb-1" style={{ fontFamily: "Playfair Display, serif" }}>2 · Report &amp; Activity Release</h2>
          <p className="text-sm text-[var(--color-grey)] mb-4">
            {report.released_at ? "As released to this team." : "The current draft (not yet released)."}
          </p>
          {loading ? (
            <p className="text-sm text-[var(--color-grey)]">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <Phase3ReleasePreview report={report} focusStatement={focusStatement} spClassification={spClassification} />
          )}
        </section>
      </div>
    </main>
  );
}
