"use client";

import { useEffect, useState } from "react";
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

// Generates a standalone HTML document the member can print or save as PDF.
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

function ConsentCard({
  choice,
  selected,
  onSelect,
}: {
  choice: ShareChoice;
  selected: boolean;
  onSelect: () => void;
}) {
  const label =
    choice === "private"
      ? "Keep my responses fully private — describe patterns, don't quote me, don't attach my name."
      : "I'm comfortable sharing my exact words, and my name, with my team — as a step toward open conversation.";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`card w-full text-left py-4 flex items-start gap-4 transition-colors border-2 ${
        selected
          ? "border-[var(--color-purple)] bg-[var(--color-purple)]/5"
          : "border-transparent"
      }`}
    >
      <span
        className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs ${
          selected
            ? "border-[var(--color-purple)] bg-[var(--color-purple)] text-white"
            : "border-black/20 text-transparent"
        }`}
      >
        ✓
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function ReviewStep({
  member,
  psStatements,
  psRatings,
  purposeText,
  rosterMissingName,
  rosterMissingRole,
  rosterNoted,
  supabase,
  onSaved,
  onAdvance,
}: {
  member: Member;
  psStatements: PsStatement[];
  psRatings: Record<number, PsLabel>;
  purposeText: string;
  rosterMissingName: string;
  rosterMissingRole: string;
  rosterNoted: boolean;
  supabase: AppSupabaseClient;
  onSaved: (fields: Partial<Member>) => void;
  onAdvance: () => void;
}) {
  const [consentChoice, setConsentChoice] = useState<ShareChoice | null>(
    choiceFromMember(member)
  );
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // The interview transcript is always fetched here (it lives only in the DB).
  // psRatings/purpose fall back to a fetch when the in-memory draft is empty
  // (i.e. the member resumed straight to review).
  const [interviewResponses, setInterviewResponses] = useState<PsInterviewResponse[]>([]);
  const [ratings, setRatings] = useState<Record<number, PsLabel>>(psRatings);
  const [purpose, setPurpose] = useState<string>(purposeText);

  useEffect(() => {
    async function load() {
      const { data: interviews } = await supabase
        .from("ps_interview_responses")
        .select("*")
        .eq("member_id", member.member_id)
        .order("created_at", { ascending: true });
      setInterviewResponses(interviews ?? []);

      if (Object.keys(psRatings).length === 0) {
        const { data: psRows } = await supabase
          .from("ps_responses")
          .select("statement_id, label")
          .eq("member_id", member.member_id)
          .eq("round", 1);
        const map: Record<number, PsLabel> = {};
        for (const row of psRows ?? []) map[row.statement_id] = row.label as PsLabel;
        setRatings(map);
      }

      if (!purposeText) {
        const { data: purposeRow } = await supabase
          .from("purpose_responses")
          .select("purpose_text")
          .eq("member_id", member.member_id)
          .maybeSingle();
        if (purposeRow?.purpose_text) setPurpose(purposeRow.purpose_text);
      }
    }
    load().catch((e) => console.error("[interview/review] load failed:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectConsent(next: ShareChoice) {
    setConsentChoice(next);
    setSavingConsent(true);
    setConsentError(null);

    const fields =
      next === "open"
        ? { share_verbatim_with_team: true, share_name_with_team: true }
        : { share_verbatim_with_team: false, share_name_with_team: false };

    const { error: updateError } = await supabase
      .from("members")
      .update(fields)
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/review] failed to save consent change:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      setConsentError("Couldn't save your change — please try again.");
    } else {
      onSaved(fields);
    }
    setSavingConsent(false);
  }

  function handleDownload() {
    const html = buildPrintableHTML(
      member,
      purpose,
      psStatements,
      ratings,
      interviewResponses,
      rosterMissingName,
      rosterMissingRole,
      rosterNoted
    );
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    // Slight delay so the window paints before print dialog opens.
    setTimeout(() => w.print(), 400);
  }

  function handleEmail() {
    const subject = encodeURIComponent("My Otis session");
    const body = encodeURIComponent(
      `Hi,\n\nI completed a Otis team interview and wanted to keep a copy.\n\nFor the full formatted version, please use the Download / Print button on the review screen.\n\n— ${member.display_name}`
    );
    window.open(`mailto:${member.email ?? ""}?subject=${subject}&body=${body}`);
  }

  const statementById = new Map(psStatements.map((s) => [s.statement_id, s]));

  const hasDemographics = [
    member.primary_language,
    member.gender_identity,
    member.ethnicity_cultural,
    member.age,
    member.personal_context,
  ].some(Boolean);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[var(--color-grey)] mb-2">
          Before we finish, here&apos;s everything you&apos;ve shared with me
          today. Take a look — you can change your privacy choice at the
          bottom if you&apos;d like, and you can keep a copy for yourself.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" onClick={handleDownload} className="btn-secondary">
            ↓ Download / Print
          </button>
          {member.email && (
            <button type="button" onClick={handleEmail} className="btn-secondary">
              ✉ Email me a copy
            </button>
          )}
        </div>
      </div>

      {/* Profile */}
      <section>
        <h2 className="text-2xl mb-4">Your profile</h2>
        <div className="card space-y-1">
          <p className="font-medium">{member.display_name}</p>
          <p className="text-sm text-[var(--color-grey)]">
            {[member.role, member.location, member.timezone]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {member.tenure_start && (
            <p className="text-sm text-[var(--color-grey)]">
              Joined: {member.tenure_start}
            </p>
          )}
          {hasDemographics && (
            <div className="pt-2 border-t border-black/5 mt-2 space-y-0.5">
              {member.primary_language && (
                <p className="text-sm text-[var(--color-grey)]">
                  Language: {member.primary_language}
                </p>
              )}
              {member.gender_identity && (
                <p className="text-sm text-[var(--color-grey)]">
                  Gender identity: {member.gender_identity}
                </p>
              )}
              {member.ethnicity_cultural && (
                <p className="text-sm text-[var(--color-grey)]">
                  Background: {member.ethnicity_cultural}
                </p>
              )}
              {member.age && (
                <p className="text-sm text-[var(--color-grey)]">Age: {member.age}</p>
              )}
              {member.personal_context && (
                <p className="text-sm text-[var(--color-grey)]">
                  Context: {member.personal_context}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Purpose */}
      <section>
        <h2 className="text-2xl mb-4">Shared purpose</h2>
        <div className="card">
          <p className="text-[var(--color-grey)]">
            {purpose || <em>Not answered.</em>}
          </p>
        </div>
      </section>

      {/* Roster note */}
      {rosterNoted && rosterMissingName && (
        <section>
          <h2 className="text-2xl mb-4">Roster note</h2>
          <div className="card">
            <p className="text-[var(--color-grey)]">
              You flagged that <strong>{rosterMissingName}</strong>
              {rosterMissingRole ? ` (${rosterMissingRole})` : ""} may be
              missing from the team.
            </p>
          </div>
        </section>
      )}

      {/* PS Diagnostic */}
      <section>
        <h2 className="text-2xl mb-4">Psychological safety</h2>
        <div className="space-y-2">
          {psStatements.map((s) => {
            const rating = ratings[s.statement_id];
            return (
              <div
                key={s.statement_id}
                className="card py-3 flex items-start justify-between gap-4"
              >
                <p className="text-sm flex-1">{s.statement_text}</p>
                <span className="flex-shrink-0 text-sm whitespace-nowrap">
                  {rating ? (
                    <>
                      {PS_COLOR_DOT[psColorGroup(s, rating)]}{" "}
                      <span className="text-[var(--color-grey)]">
                        {PS_LABEL_WORD[rating]}
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--color-grey)]">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interview */}
      {interviewResponses.length > 0 && (
        <section>
          <h2 className="text-2xl mb-4">What we talked through</h2>
          <div className="space-y-4">
            {interviewResponses.map((r) => {
              const s = statementById.get(r.statement_id);
              return (
                <div key={r.id} className="card space-y-2">
                  <p className="font-medium text-sm">
                    {s?.statement_text}
                    {r.member_response_label && (
                      <span className="text-[var(--color-grey)]">
                        {" "}
                        — {PS_LABEL_WORD[r.member_response_label]}
                      </span>
                    )}
                  </p>
                  {BUCKET_FIELDS.map((b) => {
                    const val = (r[b.key] as string | null) ?? "";
                    if (!val) return null;
                    return (
                      <p key={b.key} className="text-sm text-[var(--color-grey)]">
                        <span className="text-[var(--color-ink)]">{b.label}:</span> {val}
                      </p>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Editable consent */}
      <section>
        <h2 className="text-2xl mb-2">Your privacy choice</h2>
        <p className="text-[var(--color-grey)] text-sm mb-4">
          You can change this here — it takes effect immediately.
        </p>
        <div className="space-y-3">
          <ConsentCard
            choice="private"
            selected={consentChoice === "private"}
            onSelect={() => selectConsent("private")}
          />
          <ConsentCard
            choice="open"
            selected={consentChoice === "open"}
            onSelect={() => selectConsent("open")}
          />
        </div>
        {savingConsent && (
          <p className="text-sm text-[var(--color-grey)] mt-2">Saving…</p>
        )}
        {consentError && (
          <p className="text-sm text-[var(--color-grey)] mt-2">{consentError}</p>
        )}
      </section>

      <button type="button" onClick={onAdvance} className="btn-primary">
        Finish
      </button>
    </div>
  );
}
