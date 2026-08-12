import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireTeamOwner } from "@/lib/requestAuth";
import type { Zone } from "@/types/database";

// Phase 4 §7.4 — Lock. The facilitator has read the assembled agreement aloud,
// the team has edited it, and fist-of-five has passed. This writes the final
// artefact and closes the room. Server-side because it touches three tables and
// must keep code_of_conduct.is_current consistent (only one current per team).
export async function POST(req: NextRequest) {
  let teamId: string;
  let agreements: string;
  let revisitDate: string | null;
  let focusZone: Zone | null;
  try {
    const body = await req.json();
    teamId = body.team_id;
    agreements = body.agreements;
    revisitDate = body.revisit_date ?? null;
    focusZone = (body.focus_zone ?? null) as Zone | null;
    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json({ error: "team_id required" }, { status: 400 });
    }
    if (!agreements || typeof agreements !== "string" || !agreements.trim()) {
      return NextResponse.json({ error: "agreement text is empty" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const auth = await requireTeamOwner(req, teamId);
  if (!auth.ok) return auth.response;

  // Session must exist and be at the agreement movement.
  const { data: session, error: sessErr } = await supabaseAdmin
    .from("workshop_sessions")
    .select("*")
    .eq("team_id", teamId)
    .maybeSingle();
  if (sessErr) return NextResponse.json({ error: "db_error", detail: sessErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "no_workshop_session" }, { status: 400 });

  // Next version for this team, and retire the previous current agreement.
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("code_of_conduct")
    .select("version")
    .eq("team_id", teamId)
    .order("version", { ascending: false })
    .limit(1);
  if (exErr) return NextResponse.json({ error: "db_error", detail: exErr.message }, { status: 500 });
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const { error: retireErr } = await supabaseAdmin
    .from("code_of_conduct")
    .update({ is_current: false })
    .eq("team_id", teamId)
    .eq("is_current", true);
  if (retireErr) return NextResponse.json({ error: "db_error", detail: retireErr.message }, { status: 500 });

  const agreedAt = new Date().toISOString();
  const { data: coc, error: insErr } = await supabaseAdmin
    .from("code_of_conduct")
    .insert({
      team_id: teamId,
      version: nextVersion,
      agreements,
      focus_zone: focusZone,
      agreed_at: agreedAt,
      is_current: true,
    })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: "db_error", detail: insErr.message }, { status: 500 });

  // Revisit date → followups (spec §7.4). Optional: only if a date was set.
  let followupWarning: string | null = null;
  if (revisitDate) {
    const { data: fu, error: fuCountErr } = await supabaseAdmin
      .from("followups")
      .select("round")
      .eq("team_id", teamId)
      .order("round", { ascending: false })
      .limit(1);
    if (fuCountErr) {
      followupWarning = fuCountErr.message;
    } else {
      const nextRound = (fu?.[0]?.round ?? 0) + 1;
      const { error: fuErr } = await supabaseAdmin
        .from("followups")
        .insert({ team_id: teamId, scheduled_for: revisitDate, round: nextRound });
      if (fuErr) followupWarning = fuErr.message;
    }
  }

  const { error: closeErr } = await supabaseAdmin
    .from("workshop_sessions")
    .update({ phase: "closed", locked_at: agreedAt, revisit_date: revisitDate, updated_at: agreedAt })
    .eq("id", session.id);
  if (closeErr) return NextResponse.json({ error: "db_error", detail: closeErr.message }, { status: 500 });

  return NextResponse.json({ code_of_conduct: coc, followup_warning: followupWarning });
}
