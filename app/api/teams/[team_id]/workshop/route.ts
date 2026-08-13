import { NextRequest, NextResponse } from "next/server";
import { requireEarlyAccessConsultant, requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";
import type { WorkshopSessionInsert, WorkshopSessionUpdate } from "@/types/database";

const WORKSHOP_PHASES = ["orient", "pairs", "whole_team", "reinforcement", "agreement", "closed"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const earlyAccess = await requireEarlyAccessConsultant(auth.value.userId);
  if (!earlyAccess.ok) return earlyAccess.response;
  const { data: session, error } = await supabaseAdmin
    .from("workshop_sessions")
    .select("*")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load workshop." }, { status: 500 });
  if (!session) return NextResponse.json({ session: null, pair_submissions: [] });
  const { data: pairSubmissions, error: submissionError } = await supabaseAdmin
    .from("pair_submissions")
    .select("*")
    .eq("session_id", session.id)
    .order("pair_index");
  if (submissionError) return NextResponse.json({ error: "Unable to load workshop submissions." }, { status: 500 });
  return NextResponse.json({ session, pair_submissions: pairSubmissions ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const earlyAccess = await requireEarlyAccessConsultant(auth.value.userId);
  if (!earlyAccess.ok) return earlyAccess.response;
  const body = await request.json().catch(() => null);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("workshop_sessions")
    .select("*")
    .eq("team_id", teamId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Unable to start workshop." }, { status: 500 });
  if (existing) return NextResponse.json({ session: existing, already_started: true });

  const input = body?.focus_frame;
  const frame = input && typeof input === "object"
    ? {
        item: typeof input.item === "string" ? input.item.slice(0, 2000) : "",
        objective: typeof input.objective === "string" ? input.objective.slice(0, 2000) : "",
        context: typeof input.context === "string" ? input.context.slice(0, 2000) : "",
        why: typeof input.why === "string" ? input.why.slice(0, 4000) : "",
        zone: [1, 2, 3].includes(input.zone) ? input.zone : null,
      }
    : null;
  const insert: WorkshopSessionInsert = {
    team_id: teamId,
    phase: "orient",
    focus_frame: frame,
    started_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin.from("workshop_sessions").insert(insert).select("*").single();
  if (error || !data) return NextResponse.json({ error: "Unable to start workshop." }, { status: 500 });
  return NextResponse.json({ session: data }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const earlyAccess = await requireEarlyAccessConsultant(auth.value.userId);
  if (!earlyAccess.ok) return earlyAccess.response;
  const body = await request.json().catch(() => null);
  const sessionId = body?.session_id;
  const update = body?.update;
  if (typeof sessionId !== "string" || !update || typeof update !== "object") {
    return NextResponse.json({ error: "A session and update are required." }, { status: 400 });
  }
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("workshop_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (sessionError || !session) return NextResponse.json({ error: "Workshop session not found." }, { status: 404 });

  const allowed: WorkshopSessionUpdate = {};
  if (typeof update.phase === "string" && WORKSHOP_PHASES.includes(update.phase)) allowed.phase = update.phase as WorkshopSessionUpdate["phase"];
  if (update.focus_frame === null || typeof update.focus_frame === "object") allowed.focus_frame = update.focus_frame;
  if (update.pairs === null || Array.isArray(update.pairs)) allowed.pairs = update.pairs;
  if (Array.isArray(update.selected_always)) allowed.selected_always = update.selected_always;
  if (Array.isArray(update.selected_never)) allowed.selected_never = update.selected_never;
  if (update.capture_sheet && typeof update.capture_sheet === "object") allowed.capture_sheet = update.capture_sheet;
  if (update.revisit_date === null || typeof update.revisit_date === "string") allowed.revisit_date = update.revisit_date;
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: "No valid workshop fields were provided." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("workshop_sessions")
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Unable to save workshop changes." }, { status: 500 });
  return NextResponse.json({ session: data });
}
