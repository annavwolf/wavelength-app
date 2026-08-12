import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { logIdentityLookup } from "@/lib/auditLog";
import { requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] ?? character));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = body?.member_id;
  const teamId = body?.team_id;
  if (!memberId || !teamId) {
    return NextResponse.json({ error: "member_id and team_id are required" }, { status: 400 });
  }

  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email service not configured" }, { status: 500 });

  const [{ data: identity, error: identityError }, { data: team, error: teamError }] = await Promise.all([
    supabaseAdmin
      .from("member_identity")
      .select("email, display_name")
      .eq("member_id", memberId)
      .eq("team_id", teamId)
      .maybeSingle(),
    supabaseAdmin.from("teams").select("team_name").eq("team_id", teamId).maybeSingle(),
  ]);
  if (identityError || !identity) return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  if (teamError || !team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (!identity.email) return NextResponse.json({ error: "This participant has no email address" }, { status: 400 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const interviewUrl = `${appUrl}/interview/${memberId}`;
  const firstName = identity.display_name.split(" ")[0] || "there";
  const safeFirstName = escapeHtml(firstName);
  const safeTeamName = escapeHtml(team.team_name);
  const safeInterviewUrl = escapeHtml(interviewUrl);
  const text = `Hi ${firstName},

Your consultant has set up an Otis beta team assessment for ${team.team_name}.

Before the interview begins, you will read the beta participant privacy notice and choose whether team materials use summaries only or may include short, non-attributed exact excerpts. Voice input is optional. The interview takes around 15-20 minutes, and you can pause and resume.

Start here:
${interviewUrl}

This personal link grants access to your interview. Please do not share it. For privacy questions, withdrawal, or technical support, email contact@wavelength.team.`;

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Otis <otis@wavelength.team>",
    to: identity.email,
    subject: `Your Otis beta assessment: ${team.team_name}`,
    text,
    html: `
<p>Hi ${safeFirstName},</p>
<p>Your consultant has set up an Otis beta team assessment for <strong>${safeTeamName}</strong>.</p>
<p>Before the interview begins, you will read the beta participant privacy notice and choose whether team materials use summaries only or may include short, non-attributed exact excerpts. Voice input is optional. The interview takes around 15-20 minutes, and you can pause and resume.</p>
<p><a href="${safeInterviewUrl}" style="display:inline-block;background:#2B2B6B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Start my assessment</a></p>
<p>Or paste this link into your browser:<br/><a href="${safeInterviewUrl}">${safeInterviewUrl}</a></p>
<p style="color:#888;font-size:13px;">This personal link grants access to your interview. Please do not share it. For privacy questions, withdrawal, or technical support, email <a href="mailto:contact@wavelength.team?subject=Otis%20beta%20participant%20support">contact@wavelength.team</a>.</p>`.trim(),
  });
  if (sendError) {
    console.error("[invite/send] email delivery failed", { name: sendError.name, message: sendError.message });
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 502 });
  }

  const invitedAt = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("members")
    .update({ invited_at: invitedAt, status: "invited" })
    .eq("member_id", memberId)
    .eq("team_id", teamId);
  if (updateError) {
    return NextResponse.json({ error: "Email sent, but invite status could not be saved." }, { status: 500 });
  }

  void logIdentityLookup(memberId, "invite_send", "sending beta assessment invite");
  return NextResponse.json({ success: true, invited_at: invitedAt });
}
