import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { logIdentityLookups } from "@/lib/auditLog";
import { requireEarlyAccessConsultant, requireTeamOwner } from "@/lib/requestAuth";
import type { Phase3ReportJson } from "@/types/database";
import {
  artifactMatchesTier1,
  currentTier1Provenance,
  RECOMPUTE_REQUIRED_MESSAGE,
  REINTERPRET_REQUIRED_MESSAGE,
  withTier1Provenance,
} from "@/lib/analysisProvenance";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] ?? character));
}

// POST /api/phase3/release
// { team_id, report: Phase3ReportJson, dry_run?: boolean, resend_all?: boolean }
// dry_run=true    → save draft only, no emails sent
// resend_all=true → ignore sent_member_ids and re-send to everyone with an email
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { team_id, report, dry_run = false, resend_all = false } = body ?? {};

  if (!team_id || !report) {
    return NextResponse.json({ error: "team_id and report required" }, { status: 400 });
  }

  const auth = await requireTeamOwner(req, team_id);
  if (!auth.ok) return auth.response;

  // Consultants may still save and refine their private draft. Sending the
  // Results & Team Agreement Activity to participants is beta early access.
  if (!dry_run) {
    const earlyAccess = await requireEarlyAccessConsultant(auth.value.userId);
    if (!earlyAccess.ok) return earlyAccess.response;
  }

  const { data: analysis, error: aErr } = await supabaseAdmin
    .from("analysis")
    .select("id, tier1_json, tier2_json, phase3_report_json")
    .eq("team_id", team_id)
    .maybeSingle();

  if (aErr || !analysis) {
    return NextResponse.json({ error: "Analysis not found for this team" }, { status: 404 });
  }
  const tier1Provenance = currentTier1Provenance(analysis.tier1_json);
  if (!tier1Provenance) {
    return NextResponse.json({ error: RECOMPUTE_REQUIRED_MESSAGE, code: "analysis_recompute_required" }, { status: 409 });
  }
  if (!artifactMatchesTier1(analysis.tier2_json, tier1Provenance)) {
    return NextResponse.json({ error: REINTERPRET_REQUIRED_MESSAGE, code: "analysis_reinterpret_required" }, { status: 409 });
  }

  const existing = (analysis.phase3_report_json as Phase3ReportJson | null) ?? null;
  const alreadySentIds: string[] = existing?.sent_member_ids ?? [];

  const now = new Date().toISOString();
  let sentCount = 0;
  let skippedAlreadySent = 0;
  const newSentIds = [...alreadySentIds];

  if (!dry_run) {
    const apiKey = process.env.RESEND_API_KEY;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const [identityRes, teamRes] = await Promise.all([
      supabaseAdmin.from("member_identity").select("member_id, display_name, email").eq("team_id", team_id),
      supabaseAdmin.from("teams").select("team_name").eq("team_id", team_id).single(),
    ]);

    const teamName = teamRes.data?.team_name ?? "your team";
    const allMembers = identityRes.data ?? [];
    void logIdentityLookups(allMembers.map((m) => m.member_id), "phase3_release", "sending Phase 3 report");
    const noEmail = allMembers.filter((m) => !m.email).length;
    skippedAlreadySent = resend_all ? 0 :
      allMembers.filter((m) => m.email && alreadySentIds.includes(m.member_id)).length;
    const toSend = allMembers.filter(
      (m) => m.email && (resend_all || !alreadySentIds.includes(m.member_id))
    );
    if (noEmail > 0) {
      console.warn(`[phase3/release] ${noEmail} member(s) have no email address — skipped.`);
    }
    if (skippedAlreadySent > 0) {
      console.log(`[phase3/release] ${skippedAlreadySent} already sent — skipped. Use resend_all=true to override.`);
    }

    if (apiKey && toSend.length > 0) {
      const resend = new Resend(apiKey);
      const loginUrl = `${APP_URL}/member-login`;
      const safeLoginUrl = escapeHtml(loginUrl);
      // Use RESEND_FROM_EMAIL if set (requires a verified Resend domain).
      // Falls back to the shared test sender — only reliably delivers to the
      // Resend account owner's address; use a verified domain for production.
      const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Otis <otis@wavelength.team>";

      for (const m of toSend) {
        const firstName = m.display_name.split(" ")[0];
        const safeFirstName = escapeHtml(firstName);
        const safeTeamName = escapeHtml(teamName);
        const { error: sendErr } = await resend.emails.send({
          from: fromAddress,
          to: m.email!,
          subject: `Your Results & Team Agreement Activity — ${teamName}`,
          text: `Hi ${firstName},\n\nYour consultant has finished the analysis for ${teamName} and your Results & Team Agreement Activity is ready.\n\nBefore the workshop, Otis will guide you through a short reflection connected to what your session will focus on. It takes around 10 minutes.\n\nStart here:\n${loginUrl}\n\nLog in with the email address you used for your assessment. Once you're in, you'll see a link to start the activity at the top of your profile page.\n\nFor questions or technical support, email contact@wavelength.team.`,
          html: `
<p>Hi ${safeFirstName},</p>

<p>Your consultant has finished the analysis for <strong>${safeTeamName}</strong> and your Results &amp; Team Agreement Activity is ready.</p>

<p>Before the workshop, Otis will guide you through a short reflection connected to what your session will focus on. It takes around 10 minutes.</p>

<p><a href="${safeLoginUrl}" style="display:inline-block;background:#2B2B6B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Start my activity</a></p>

<p>Or paste this link into your browser:<br/><a href="${safeLoginUrl}">${safeLoginUrl}</a></p>

<p>Log in with the email address you used for your assessment. Once you're in, you'll see a link to start the activity at the top of your profile page.</p>

<p style="color:#888;font-size:13px;">For questions or technical support, email <a href="mailto:contact@wavelength.team?subject=Otis%20activity%20support">contact@wavelength.team</a>.</p>
          `.trim(),
        });
        if (!sendErr) {
          newSentIds.push(m.member_id);
          sentCount++;
        } else {
          console.error("[phase3/release] Resend error for", m.member_id, sendErr);
        }
      }
    }
  }

  const updatedReport = withTier1Provenance({
    ...(report as Phase3ReportJson),
    sent_member_ids: newSentIds,
    released_at: dry_run ? (existing?.released_at ?? null) : now,
  }, tier1Provenance);

  const { error: saveErr } = await supabaseAdmin
    .from("analysis")
    .update({ phase3_report_json: updatedReport as unknown as import("@/types/database").Json })
    .eq("team_id", team_id);

  if (saveErr) {
    console.error("[phase3/release] save failed:", saveErr);
    return NextResponse.json({ error: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    released_at: updatedReport.released_at,
    sent_count: sentCount,
    skipped_already_sent: skippedAlreadySent,
    dry_run,
    using_test_sender: !process.env.RESEND_FROM_EMAIL,
  });
}
