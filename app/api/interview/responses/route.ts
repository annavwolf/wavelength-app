import { NextRequest, NextResponse } from "next/server";
import type { CoordinationFrequency, PsLabel } from "@/types/database";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_LABELS: PsLabel[] = [
  "strongly_disagree",
  "disagree",
  "neutral",
  "agree",
  "strongly_agree",
];
const LABEL_VALUES: Record<PsLabel, number> = {
  strongly_disagree: 1,
  disagree: 2,
  neutral: 3,
  agree: 4,
  strongly_agree: 5,
};
const VALID_FREQUENCIES: CoordinationFrequency[] = ["daily", "weekly", "occasionally", "rarely"];

type Participant = { member_id: string; team_id: string; status: string };

// The emailed interview URL is a narrowly scoped capability. All Phase 1
// response operations are tied to that one participant and require the beta
// privacy acknowledgement, rather than exposing the tables to the browser.
async function acknowledgedParticipant(memberId: unknown): Promise<
  | { ok: true; participant: Participant }
  | { ok: false; response: NextResponse }
> {
  if (typeof memberId !== "string" || !memberId) {
    return { ok: false, response: NextResponse.json({ error: "member_id is required" }, { status: 400 }) };
  }
  const [{ data: participant, error: memberError }, { data: acknowledgement, error: privacyError }] = await Promise.all([
    supabaseAdmin.from("members").select("member_id, team_id, status").eq("member_id", memberId).maybeSingle(),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("acknowledged_at, privacy_notice_version")
      .eq("member_id", memberId)
      .maybeSingle(),
  ]);
  if (memberError || privacyError) {
    return { ok: false, response: NextResponse.json({ error: "Unable to verify the interview session." }, { status: 500 }) };
  }
  if (!participant) {
    return { ok: false, response: NextResponse.json({ error: "Participant not found." }, { status: 404 }) };
  }
  if (participant.status === "opted_out") {
    return { ok: false, response: NextResponse.json({ error: "This participant has withdrawn." }, { status: 410 }) };
  }
  if (!acknowledgement?.acknowledged_at || acknowledgement.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Please acknowledge the current privacy information before continuing." }, { status: 409 }),
    };
  }
  return { ok: true, participant };
}

export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get("member_id");
  const kind = request.nextUrl.searchParams.get("kind");
  const auth = await acknowledgedParticipant(memberId);
  if (!auth.ok) return auth.response;
  const { participant } = auth;

  if (kind === "purpose") {
    const { data, error } = await supabaseAdmin
      .from("purpose_responses")
      .select("purpose_text")
      .eq("member_id", participant.member_id)
      .eq("team_id", participant.team_id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load your saved purpose." }, { status: 500 });
    return NextResponse.json({ purpose_text: data?.purpose_text ?? null });
  }

  if (kind === "ps") {
    const { data, error } = await supabaseAdmin
      .from("ps_responses")
      .select("statement_id, label")
      .eq("member_id", participant.member_id)
      .eq("team_id", participant.team_id)
      .eq("round", 1);
    if (error) return NextResponse.json({ error: "Unable to load saved ratings." }, { status: 500 });
    return NextResponse.json({ responses: data ?? [] });
  }

  if (kind === "coordination") {
    const { data, error } = await supabaseAdmin
      .from("coordination_ratings")
      .select("target_member_id, target_member_name, frequency")
      .eq("member_id", participant.member_id)
      .eq("team_id", participant.team_id);
    if (error) return NextResponse.json({ error: "Unable to load saved coordination ratings." }, { status: 500 });
    return NextResponse.json({ ratings: data ?? [] });
  }

  return NextResponse.json({ error: "Unknown response type." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const auth = await acknowledgedParticipant(body?.member_id);
  if (!auth.ok) return auth.response;
  const { participant } = auth;
  const kind = body?.kind;

  if (kind === "purpose") {
    const purposeText = typeof body.purpose_text === "string" ? body.purpose_text.trim().slice(0, 6000) : "";
    if (!purposeText) return NextResponse.json({ error: "A purpose response is required." }, { status: 400 });
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("purpose_responses")
      .select("id")
      .eq("member_id", participant.member_id)
      .eq("team_id", participant.team_id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: "Unable to save your purpose." }, { status: 500 });
    const result = existing
      ? await supabaseAdmin.from("purpose_responses").update({ purpose_text: purposeText }).eq("id", existing.id)
      : await supabaseAdmin.from("purpose_responses").insert({ member_id: participant.member_id, team_id: participant.team_id, purpose_text: purposeText });
    if (result.error) return NextResponse.json({ error: "Unable to save your purpose." }, { status: 500 });
    return NextResponse.json({ ok: true, purpose_text: purposeText });
  }

  if (kind === "ps") {
    const statementId = body.statement_id;
    const label: unknown = body.label;
    if (typeof statementId !== "number" || typeof label !== "string" || !VALID_LABELS.includes(label as PsLabel)) {
      return NextResponse.json({ error: "A valid statement and rating are required." }, { status: 400 });
    }
    const validLabel = label as PsLabel;
    const { data: statement, error: statementError } = await supabaseAdmin
      .from("ps_statements")
      .select("statement_id, zone")
      .eq("statement_id", statementId)
      .maybeSingle();
    if (statementError || !statement) return NextResponse.json({ error: "That statement is not available." }, { status: 400 });
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("ps_responses")
      .select("id")
      .eq("member_id", participant.member_id)
      .eq("team_id", participant.team_id)
      .eq("statement_id", statementId)
      .eq("round", 1)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: "Unable to save your rating." }, { status: 500 });
    const payload = { label: validLabel, response_value: LABEL_VALUES[validLabel], zone: statement.zone };
    const result = existing
      ? await supabaseAdmin.from("ps_responses").update(payload).eq("id", existing.id)
      : await supabaseAdmin.from("ps_responses").insert({
          member_id: participant.member_id,
          team_id: participant.team_id,
          statement_id: statementId,
          round: 1,
          ...payload,
        });
    if (result.error) return NextResponse.json({ error: "Unable to save your rating." }, { status: 500 });
    return NextResponse.json({ ok: true, statement_id: statementId, label: validLabel });
  }

  if (kind === "coordination") {
    const targetMemberId = body.target_member_id;
    const frequency = body.frequency;
    if (typeof targetMemberId !== "string" || !VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: "A team member and frequency are required." }, { status: 400 });
    }
    if (targetMemberId === participant.member_id) {
      return NextResponse.json({ error: "You cannot rate coordination with yourself." }, { status: 400 });
    }
    const [targetRes, ownIdentityRes] = await Promise.all([
      supabaseAdmin.from("members").select("member_id").eq("member_id", targetMemberId).eq("team_id", participant.team_id).maybeSingle(),
      supabaseAdmin.from("member_identity").select("display_name").eq("member_id", targetMemberId).maybeSingle(),
    ]);
    if (!targetRes.data || !ownIdentityRes.data?.display_name) {
      return NextResponse.json({ error: "That team member is not available." }, { status: 400 });
    }
    const targetName = ownIdentityRes.data.display_name;
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("coordination_ratings")
      .select("id")
      .eq("member_id", participant.member_id)
      .eq("team_id", participant.team_id)
      .eq("target_member_id", targetMemberId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: "Unable to save your coordination rating." }, { status: 500 });
    const result = existing
      ? await supabaseAdmin.from("coordination_ratings").update({ frequency, target_member_name: targetName }).eq("id", existing.id)
      : await supabaseAdmin.from("coordination_ratings").insert({
          member_id: participant.member_id,
          team_id: participant.team_id,
          target_member_id: targetMemberId,
          target_member_name: targetName,
          frequency,
        });
    if (result.error) return NextResponse.json({ error: "Unable to save your coordination rating." }, { status: 500 });
    return NextResponse.json({ ok: true, target_member_id: targetMemberId, frequency });
  }

  if (kind === "question") {
    const question = typeof body.question_text === "string" ? body.question_text.trim().slice(0, 2000) : "";
    if (!question) return NextResponse.json({ error: "A question is required." }, { status: 400 });
    const { error } = await supabaseAdmin.from("member_questions").insert({
      member_id: participant.member_id,
      team_id: participant.team_id,
      question_text: question,
    });
    if (error) return NextResponse.json({ error: "Unable to save your question." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown response type." }, { status: 400 });
}
