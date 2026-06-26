"use client";

import { useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Fish, Member, PsLabel, PsStatement } from "@/types/database";

type ShareChoice = "private" | "open";

function choiceFromMember(m: Member): ShareChoice | null {
  if (m.share_verbatim_with_team && m.share_name_with_team) return "open";
  if (!m.share_verbatim_with_team && !m.share_name_with_team) return "private";
  return null;
}

const LABEL_SYMBOL: Record<PsLabel, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

const LABEL_WORD: Record<PsLabel, string> = {
  green: "Sounds like my team",
  yellow: "Sometimes / not sure",
  red: "Doesn't sound like my team",
};

const FISH_SEVERITY: Record<number, string> = {
  1: "Not really us",
  2: "Occasionally",
  3: "A real pattern",
  4: "A big problem",
};

// Generates a standalone HTML document the member can print or save as PDF.
function buildPrintableHTML(
  member: Member,
  purposeText: string,
  psStatements: PsStatement[],
  psRatings: Record<number, PsLabel>,
  teamFish: Fish[],
  deadfishRatings: Record<string, number>,
  deadfishCustomText: string,
  deadfishCustomSeverity: number | null,
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

  const psSection = psStatements
    .map((s) => {
      const rating = psRatings[s.statement_id];
      const symbol = rating ? LABEL_SYMBOL[rating] : "○";
      const word = rating ? LABEL_WORD[rating] : "Not answered";
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px">${s.statement_text}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;white-space:nowrap">${symbol} ${word}</td>
      </tr>`;
    })
    .join("");

  const fishSection = teamFish
    .map((f) => {
      const sev = deadfishRatings[f.fish_id];
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px">${f.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px">${sev ? FISH_SEVERITY[sev] : "Not rated"}</td>
      </tr>`;
    })
    .join("");

  const customFishRow =
    deadfishCustomText
      ? `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;font-style:italic">${deadfishCustomText}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px">${deadfishCustomSeverity ? FISH_SEVERITY[deadfishCustomSeverity] : ""}</td>
        </tr>`
      : "";

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

<h2>Dead fish — team patterns</h2>
<table>${fishSection}${customFishRow}</table>

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
  teamFish,
  deadfishRatings,
  deadfishCustomText,
  deadfishCustomSeverity,
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
  teamFish: Fish[];
  deadfishRatings: Record<string, number>;
  deadfishCustomText: string;
  deadfishCustomSeverity: number | null;
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
      purposeText,
      psStatements,
      psRatings,
      teamFish,
      deadfishRatings,
      deadfishCustomText,
      deadfishCustomSeverity,
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
                <p className="text-sm text-[var(--color-grey)]">
                  Age: {member.age}
                </p>
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
            {purposeText || <em>Not answered.</em>}
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
            const rating = psRatings[s.statement_id];
            return (
              <div
                key={s.statement_id}
                className="card py-3 flex items-start justify-between gap-4"
              >
                <p className="text-sm flex-1">{s.statement_text}</p>
                <span className="flex-shrink-0 text-sm whitespace-nowrap">
                  {rating ? (
                    <>
                      {LABEL_SYMBOL[rating]}{" "}
                      <span className="text-[var(--color-grey)]">
                        {LABEL_WORD[rating]}
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

      {/* Dead fish */}
      <section>
        <h2 className="text-2xl mb-4">Team patterns</h2>
        <div className="space-y-2">
          {teamFish.map((f) => {
            const sev = deadfishRatings[f.fish_id];
            return (
              <div
                key={f.fish_id}
                className="card py-3 flex items-start justify-between gap-4"
              >
                <p className="text-sm flex-1">{f.name}</p>
                <span className="flex-shrink-0 text-sm text-[var(--color-grey)] whitespace-nowrap">
                  {sev ? FISH_SEVERITY[sev] : "—"}
                </span>
              </div>
            );
          })}
          {deadfishCustomText && (
            <div className="card py-3 flex items-start justify-between gap-4">
              <p className="text-sm flex-1 italic">{deadfishCustomText}</p>
              <span className="flex-shrink-0 text-sm text-[var(--color-grey)] whitespace-nowrap">
                {deadfishCustomSeverity
                  ? FISH_SEVERITY[deadfishCustomSeverity]
                  : "—"}
              </span>
            </div>
          )}
        </div>
      </section>

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
