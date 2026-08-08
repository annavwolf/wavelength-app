"use client";

// Transparency viewer — the full member journey end to end, read-only:
//   1. Team Assessment (the initial survey, formerly "Phase 1")
//   2. Report & Activity Release (the Phase 3 member experience)
// Distinct from the focused release preview: this is the whole thing, so a
// consultant can see exactly what members go through.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Phase3ReportJson, PsStatement } from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";
import Phase3ReleasePreview from "@/components/phase3/Phase3ReleasePreview";

// Team Assessment (initial survey) storyboard — fixed order.
const TEAM_ASSESSMENT: { section: string; title: string; body: string }[] = [
  { section: "Introduction", title: "Landing & read-aloud", body: "Otis introduces himself and offers to read messages aloud." },
  { section: "About You", title: "Profile & personal context", body: "Name, role, and optional voluntary context (language, background, tenure)." },
  { section: "About You", title: "Purpose & team name", body: "What the member thinks the team is for; an optional suggested team name." },
  { section: "About You", title: "Roster & own role", body: "Confirm the team roster (flag anyone missing) and describe their own role." },
  { section: "About You", title: "Coordination", body: "How often they work with each teammate." },
  { section: "Psych Safety", title: "Why it matters + consent", body: "Otis explains psychological safety; the member sets their sharing consent." },
  { section: "Psych Safety", title: "The ocean descent", body: "The three-zone ocean metaphor for psychological safety." },
  { section: "Psych Safety", title: "Diagnostic ratings", body: "The member rates each psychological-safety statement for their team." },
  { section: "Psych Safety", title: "Is PS important?", body: "Their own words on whether psychological safety matters here." },
  { section: "Finish", title: "What happens next, review & close", body: "A recap, an editable review, and submit — with the option to withdraw." },
];

const SECTION_COLOR: Record<string, string> = {
  "Introduction": "#6B4EA8", "About You": "#A05A46", "Psych Safety": "#1A5A6E", "Finish": "#2E6E5E",
};

function emptyReport(): Phase3ReportJson {
  return {
    ps_read_overall: "", ps_read_zone1: "", ps_read_zone2: "", ps_read_zone3: "",
    shared_purpose_read: "", focus_statement_id: null, focus_narrative: "", workshop_intro: "",
    include_shared_purpose: false, include_stories: true, include_rationalization_in_report: false,
    released_at: null, sent_member_ids: [],
  };
}

export default function JourneyPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const [supabase] = useState(() => createBrowserClient());
  const [report, setReport] = useState<Phase3ReportJson>(emptyReport());
  const [statements, setStatements] = useState<PsStatement[]>([]);
  const [spClassification, setSpClassification] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [{ data: analysis }, { data: stmts }] = await Promise.all([
        supabase.from("analysis").select("tier1_json, tier2_json, phase3_report_json").eq("team_id", teamId).maybeSingle(),
        supabase.from("ps_statements").select("*").order("statement_id", { ascending: true }),
      ]);
      const rep = (analysis?.phase3_report_json as Phase3ReportJson | null) ?? null;
      if (rep) setReport(rep);
      const tier1 = (analysis?.tier1_json as Tier1Result | null) ?? null;
      setStatements((stmts as PsStatement[]) ?? tier1?.ps_statements as unknown as PsStatement[] ?? []);
      const tier2 = (analysis?.tier2_json as Tier2Result | null) ?? null;
      setSpClassification(tier2?.shared_purpose_read?.classification);
      setLoading(false);
    })();
  }, [teamId, supabase]);

  const focusStatement = statements.find((s) => s.statement_id === report.focus_statement_id) ?? null;

  return (
    <main className="flex-1 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl" style={{ fontFamily: "Playfair Display, serif" }}>The full member journey</h1>
          <Link href={`/teams/${teamId}`} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)]">← Back to dashboard</Link>
        </div>
        <p className="text-sm text-[var(--color-grey)] mb-10">
          Everything members experience, in order — for transparency. Read-only.
        </p>

        {/* Team Assessment */}
        <section className="mb-12">
          <h2 className="text-xl mb-1" style={{ fontFamily: "Playfair Display, serif" }}>1 · Team Assessment</h2>
          <p className="text-sm text-[var(--color-grey)] mb-4">The initial survey members complete first.</p>
          <ol className="space-y-2.5">
            {TEAM_ASSESSMENT.map((s, i) => (
              <li key={i} className="rounded-xl border border-black/10 bg-white px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: SECTION_COLOR[s.section] ?? "#6B4EA8" }}>{s.section}</span>
                  <span className="text-sm font-medium">{s.title}</span>
                </div>
                <p className="text-sm text-[var(--color-ink)] leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Report & Activity Release */}
        <section>
          <h2 className="text-xl mb-1" style={{ fontFamily: "Playfair Display, serif" }}>2 · Report &amp; Activity Release</h2>
          <p className="text-sm text-[var(--color-grey)] mb-4">
            {report.released_at ? "As released to this team." : "The current draft (not yet released)."}
          </p>
          {loading ? (
            <p className="text-sm text-[var(--color-grey)]">Loading…</p>
          ) : (
            <Phase3ReleasePreview report={report} focusStatement={focusStatement} spClassification={spClassification} />
          )}
        </section>
      </div>
    </main>
  );
}
