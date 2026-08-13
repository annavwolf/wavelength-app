import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { logIdentityLookups } from "@/lib/auditLog";
import { buildArtifacts } from "@/lib/phase4Artifacts";
import { requireEarlyAccessConsultant, requireTeamOwner } from "@/lib/requestAuth";
import type { Json, Phase4SelfServeJson } from "@/types/database";
import {
  artifactMatchesTier1,
  currentTier1Provenance,
  RECOMPUTE_REQUIRED_MESSAGE,
  REPORT_REBUILD_REQUIRED_MESSAGE,
  withTier1Provenance,
} from "@/lib/analysisProvenance";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] ?? character));
}

// POST /api/phase4/release
// { team_id, selfserve: Phase4SelfServeJson, dry_run?, resend_all? }
// Mirrors /api/phase3/release: dry_run saves the (edited) draft only; release
// locks the exit-interview content, generates the two read-only artifacts filled
// with the team's data (§7.1), writes everything to analysis.phase4_selfserve_json
// (per-team storage, surfaced on member profiles), and emails members a link.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { team_id, selfserve, dry_run = false, resend_all = false } = body ?? {};

  if (!team_id || !selfserve) {
    return NextResponse.json({ error: "team_id and selfserve required" }, { status: 400 });
  }

  const auth = await requireTeamOwner(req, team_id);
  if (!auth.ok) return auth.response;
  const earlyAccess = await requireEarlyAccessConsultant(auth.value.userId);
  if (!earlyAccess.ok) return earlyAccess.response;

  const { data: analysis, error: aErr } = await supabaseAdmin
    .from("analysis")
    .select("id, tier1_json, phase4_selfserve_json")
    .eq("team_id", team_id)
    .maybeSingle();
  if (aErr || !analysis) {
    return NextResponse.json({ error: "Analysis not found for this team" }, { status: 404 });
  }
  const tier1Provenance = currentTier1Provenance(analysis.tier1_json);
  if (!tier1Provenance) {
    return NextResponse.json({ error: RECOMPUTE_REQUIRED_MESSAGE, code: "analysis_recompute_required" }, { status: 409 });
  }

  const existing = (analysis.phase4_selfserve_json as Phase4SelfServeJson | null) ?? null;
  if (!artifactMatchesTier1(existing, tier1Provenance)) {
    return NextResponse.json({ error: REPORT_REBUILD_REQUIRED_MESSAGE, code: "phase4_regenerate_required" }, { status: 409 });
  }
  const alreadySentIds: string[] = existing?.sent_member_ids ?? [];

  const now = new Date().toISOString();
  let sentCount = 0;
  let skippedAlreadySent = 0;
  const newSentIds = [...alreadySentIds];

  const incoming = selfserve as Phase4SelfServeJson;

  // Generate the filled read-only artifacts from the (possibly edited) content.
  const artifacts = dry_run
    ? existing?.artifacts ?? []
    : buildArtifacts({
        agreement: incoming.agreement,
        agreementText: incoming.agreement_text,
        clarity: incoming.clarity,
        asyncSkew: incoming.async_skew,
      });

  if (!dry_run) {
    const apiKey = process.env.RESEND_API_KEY;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const [identityRes, teamRes] = await Promise.all([
      supabaseAdmin.from("member_identity").select("member_id, display_name, email").eq("team_id", team_id),
      supabaseAdmin.from("teams").select("team_name").eq("team_id", team_id).single(),
    ]);

    const teamName = teamRes.data?.team_name ?? "your team";
    const allMembers = identityRes.data ?? [];
    void logIdentityLookups(allMembers.map((m) => m.member_id), "phase4_release", "sending Phase 4 agreement");
    const noEmail = allMembers.filter((m) => !m.email).length;
    skippedAlreadySent = resend_all ? 0 :
      allMembers.filter((m) => m.email && alreadySentIds.includes(m.member_id)).length;
    const toSend = allMembers.filter(
      (m) => m.email && (resend_all || !alreadySentIds.includes(m.member_id))
    );
    if (noEmail > 0) {
      console.warn(`[phase4/release] ${noEmail} member(s) have no email address — skipped.`);
    }

    if (apiKey && toSend.length > 0) {
      const resend = new Resend(apiKey);
      const loginUrl = `${APP_URL}/member-login`;
      const safeLoginUrl = escapeHtml(loginUrl);
      const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Otis <otis@wavelength.team>";

      for (const m of toSend) {
        const firstName = m.display_name.split(" ")[0];
        const safeFirstName = escapeHtml(firstName);
        const safeTeamName = escapeHtml(teamName);
        const { error: sendErr } = await resend.emails.send({
          from: fromAddress,
          to: m.email!,
          subject: `Your team's results are ready — ${teamName}`,
          text: `Hi ${firstName},\n\nOtis has drawn up a Team Behaviour Agreement for ${teamName}, along with a game plan for the next 30 days.\n\nYour results include your team's agreement, what to do next, and three guides to run your own team meeting.\n\nSee them here:\n${loginUrl}\n\nLog in with the email address you used for your assessment. Your results are on your profile page.\n\nIf you have any questions, contact your consultant directly.`,
          html: `
<p>Hi ${safeFirstName},</p>

<p>Otis has drawn up a Team Behaviour Agreement for <strong>${safeTeamName}</strong>, along with a game plan for the next 30 days.</p>

<p>Your results include your team's agreement, what to do next, and three guides to run your own team meeting.</p>

<p><a href="${safeLoginUrl}" style="display:inline-block;background:#2B2B6B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">See my team's results</a></p>

<p>Or paste this link into your browser:<br/><a href="${safeLoginUrl}">${safeLoginUrl}</a></p>

<p>Log in with the email address you used for your assessment. Your results are on your profile page.</p>

<p style="color:#888;font-size:13px;">For questions or technical support, email <a href="mailto:contact@wavelength.team?subject=Otis%20team%20results%20support">contact@wavelength.team</a>.</p>
          `.trim(),
        });
        if (!sendErr) {
          newSentIds.push(m.member_id);
          sentCount++;
        } else {
          console.error("[phase4/release] Resend error for", m.member_id, sendErr);
        }
      }
    }
  }

  const updated = withTier1Provenance({
    ...incoming,
    artifacts,
    sent_member_ids: newSentIds,
    released_at: dry_run ? (existing?.released_at ?? null) : now,
  }, tier1Provenance);

  const { error: saveErr } = await supabaseAdmin
    .from("analysis")
    .update({ phase4_selfserve_json: updated as unknown as Json })
    .eq("team_id", team_id);
  if (saveErr) {
    console.error("[phase4/release] save failed:", saveErr);
    return NextResponse.json({ error: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    released_at: updated.released_at,
    sent_count: sentCount,
    skipped_already_sent: skippedAlreadySent,
    dry_run,
    using_test_sender: !process.env.RESEND_FROM_EMAIL,
  });
}
