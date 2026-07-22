"use client";

import { useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type {
  Member,
  PsInterviewResponse,
  PsLabel,
  PsStatement,
} from "@/types/database";
import { PS_COLOR_DOT, PS_LABEL_WORD, psColorGroup } from "@/lib/psLabels";

type ShareChoice = "private" | "open";

function choiceFromMember(m: Member): ShareChoice | null {
  if (m.share_verbatim_with_team && m.share_name_with_team) return "open";
  if (!m.share_verbatim_with_team && !m.share_name_with_team) return "private";
  return null;
}

// The four distilled buckets, in order, with member-facing labels.
const BUCKET_FIELDS: { key: keyof PsInterviewResponse; label: string }[] = [
  { key: "situation_text", label: "The situation" },
  { key: "out_behavior_text", label: "What happened" },
  { key: "outcome_text", label: "The effect" },
  { key: "in_behavior_text", label: "What could be different" },
];

function buildPrintableHTML(
  member: Member,
  purposeText: string,
  psStatements: PsStatement[],
  psRatings: Record<number, PsLabel>,
  interviewResponses: PsInterviewResponse[],
  rosterMissingName: string,
  rosterMissingRole: string,
  rosterNoted: boolean
): string {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const consentText =
    choiceFromMember(member) === "open"
      ? "Sharing my exact words and name with my team"
      : "Keeping responses fully private";

  const statementById = new Map(psStatements.map((s) => [s.statement_id, s]));

  const psSection = psStatements
    .map((s) => {
      const rating = psRatings[s.statement_id];
      // 3-color dot over the real answer word (the 5-point value is preserved).
      const symbol = rating ? PS_COLOR_DOT[psColorGroup(s, rating)] : "○";
      const word = rating ? PS_LABEL_WORD[rating] : "Not answered";
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px">${s.statement_text}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;white-space:nowrap">${symbol} ${word}</td>
      </tr>`;
    })
    .join("");

  const interviewSection = interviewResponses
    .map((r) => {
      const s = statementById.get(r.statement_id);
      const buckets = BUCKET_FIELDS.map((b) => {
        const val = (r[b.key] as string | null) ?? "";
        if (!val) return "";
        return `<p style="font-size:14px;margin:2px 0"><strong>${b.label}:</strong> ${val}</p>`;
      }).join("");
      return `<div style="margin-bottom:16px">
        <p style="font-size:14px;font-weight:600;margin-bottom:4px">${s?.statement_text ?? ""}${
          r.member_response_label ? ` — ${PS_LABEL_WORD[r.member_response_label]}` : ""
        }</p>
        ${buckets}
      </div>`;
    })
    .join("");

  const missingRow =
    rosterNoted && rosterMissingName
      ? `<p style="font-size:14px;color:#555">I flagged that <strong>${rosterMissingName}</strong>${rosterMissingRole ? ` (${rosterMissingRole})` : ""} may be missing from the team roster.</p>`
      : "";

  const demographics = [
    member.primary_language ? `Language: ${member.primary_language}` : null,
    member.gender_identity ? `Gender identity: ${member.gender_identity}` : null,
    member.ethnicity_cultural ? `Cultural background: ${member.ethnicity_cultural}` : null,
    member.age ? `Age: ${member.age}` : null,
    member.personal_context ? `Other context: ${member.personal_context}` : null,
  ]
    .filter(Boolean)
    .join("<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>My Otis session — ${member.display_name}</title>
<style>
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:760px;margin:0 auto;padding:40px 32px;color:#1F1F1F;line-height:1.5}
  h1{color:#6B4EA8;margin-bottom:4px}
  h2{color:#1A1A2E;font-size:16px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #eee;padding-bottom:6px;margin-top:36px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  td{vertical-align:top}
  .meta{color:#6B6B6B;font-size:14px;margin-bottom:8px}
  @media print{body{padding:16px}h2{page-break-after:avoid}}
</style>
</head>
<body>
<h1>My Otis session</h1>
<p class="meta">${member.display_name} · ${date}</p>

<h2>Privacy choice</h2>
<p style="font-size:14px">${consentText}</p>

<h2>Profile</h2>
<p style="font-size:14px">
  <strong>${member.display_name}</strong><br>
  ${[member.role, member.location, member.timezone].filter(Boolean).join(" · ")}<br>
  ${member.tenure_start ? `Joined: ${member.tenure_start}<br>` : ""}
  ${demographics || ""}
</p>

<h2>Shared purpose</h2>
<p style="font-size:14px">${purposeText || "<em>Not answered</em>"}</p>

${missingRow ? `<h2>Roster note</h2>${missingRow}` : ""}

<h2>Psychological safety — 12 statements</h2>
<table>${psSection}</table>

${interviewSection ? `<h2>What we talked through</h2>${interviewSection}` : ""}

<p style="margin-top:48px;font-size:12px;color:#999">Generated by Otis · wavelength-app.vercel.app</p>
</body>
</html>`;
}

export default function AlreadyCompleteStep({
  member,
  supabase,
  psStatements,
}: {
  member: Member;
  supabase: AppSupabaseClient;
  psStatements: PsStatement[];
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);

    const [
      { data: purposeData },
      { data: psData },
      { data: interviewData },
      { data: flagData },
    ] = await Promise.all([
      supabase
        .from("purpose_responses")
        .select("purpose_text")
        .eq("member_id", member.member_id)
        .maybeSingle(),
      supabase
        .from("ps_responses")
        .select("statement_id, label")
        .eq("member_id", member.member_id)
        .eq("round", 1),
      supabase
        .from("ps_interview_responses")
        .select("*")
        .eq("member_id", member.member_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("missing_member_flags")
        .select("missing_name, missing_role")
        .eq("reported_by_member_id", member.member_id)
        .maybeSingle(),
    ]);

    const purposeText = purposeData?.purpose_text ?? "";

    const psRatings: Record<number, PsLabel> = {};
    for (const row of psData ?? []) {
      psRatings[row.statement_id] = row.label as PsLabel;
    }

    const rosterNoted = !!flagData?.missing_name;
    const rosterMissingName = flagData?.missing_name ?? "";
    const rosterMissingRole = flagData?.missing_role ?? "";

    const html = buildPrintableHTML(
      member,
      purposeText,
      psStatements,
      psRatings,
      interviewData ?? [],
      rosterMissingName,
      rosterMissingRole,
      rosterNoted
    );

    setDownloading(false);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  const firstName = member.display_name.split(" ")[0];

  return (
    <div className="text-center py-8">
      <img
        src="/octopus-logo.png"
        alt=""
        className="h-20 w-auto mx-auto mb-8"
      />

      <h1
        className="text-4xl font-serif mb-4"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        You&apos;re all{" "}
        <span className="purple">done.</span>
      </h1>

      <p
        className="text-xl italic mb-6"
        style={{ color: "var(--color-purple)" }}
      >
        That was a real contribution, {firstName}.
      </p>

      <p className="text-[var(--color-grey)] max-w-md mx-auto mb-8">
        I&apos;ll bring your responses together with those from your
        teammates. Once everyone has spoken with me, your consultant will be
        in touch with what I found.
      </p>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="btn-secondary"
      >
        {downloading ? "Preparing..." : "Download my responses"}
      </button>

      <p className="mt-8 text-xs text-[var(--color-grey)]">
        Need to change something? Reach Dr. Wolf at{" "}
        <a
          href="mailto:anna.v.wolf@gmail.com"
          className="underline"
        >
          anna.v.wolf@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
