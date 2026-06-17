import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { member_id, team_id } = body ?? {};

  if (!member_id || !team_id) {
    return NextResponse.json({ error: "member_id and team_id are required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }
  const resend = new Resend(apiKey);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [{ data: member, error: memberError }, { data: team, error: teamError }] =
    await Promise.all([
      supabase.from("members").select("*").eq("member_id", member_id).single(),
      supabase.from("teams").select("team_name").eq("team_id", team_id).single(),
    ]);

  if (memberError || !member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (teamError || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  if (!member.email) {
    return NextResponse.json({ error: "Member has no email address" }, { status: 400 });
  }

  const interviewUrl = `${APP_URL}/interview/${member_id}`;
  const firstName = member.display_name.split(" ")[0];

  const { error: sendError } = await resend.emails.send({
    from: "Wavelength <noreply@wavelength.team>",
    to: member.email,
    subject: `Your Wavelength assessment — ${team.team_name}`,
    html: `
<p>Hi ${firstName},</p>

<p>Your consultant has set up a Wavelength psychological safety assessment for <strong>${team.team_name}</strong>.</p>

<p>This is a private, confidential interview — your individual responses are never shared with your team. It takes around 15–20 minutes and you can pause and resume at any time.</p>

<p><a href="${interviewUrl}" style="display:inline-block;background:#2B2B6B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Start my assessment</a></p>

<p>Or paste this link into your browser:<br/><a href="${interviewUrl}">${interviewUrl}</a></p>

<p style="color:#888;font-size:13px;">This link is personal to you — please don't share it. If you have questions, reply to this email or contact your consultant directly.</p>
    `.trim(),
  });

  if (sendError) {
    console.error("[invite/send] Resend error:", sendError);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("members")
    .update({ invited_at: now, status: "invited" })
    .eq("member_id", member_id);

  if (updateError) {
    console.error("[invite/send] failed to update member after send:", updateError);
  }

  return NextResponse.json({ success: true, invited_at: now });
}
