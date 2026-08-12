import { NextRequest, NextResponse } from "next/server";
import { requireConsultant } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await requireConsultant(request);
  if (!auth.ok) return auth.response;

  const { data: teams, error } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("consultant_id", auth.value.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load teams." }, { status: 500 });
  }

  return NextResponse.json({ teams: teams ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireConsultant(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const teamName = typeof body?.team_name === "string" ? body.team_name.trim().slice(0, 160) : "";
  if (!teamName) return NextResponse.json({ error: "A team name is required." }, { status: 400 });
  const rosterSize = Number.isInteger(body?.roster_size) && body.roster_size > 0 && body.roster_size <= 500
    ? body.roster_size
    : null;
  const textOrNull = (value: unknown, length: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, length) : null;

  const { error: consultantError } = await supabaseAdmin
    .from("consultants")
    .upsert({ consultant_id: auth.value.userId }, { onConflict: "consultant_id" });
  if (consultantError) return NextResponse.json({ error: "Unable to create consultant profile." }, { status: 500 });

  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .insert({
      consultant_id: auth.value.userId,
      team_name: teamName,
      industry: textOrNull(body?.industry, 160),
      // Kept only for historical rows. New assessments neither collect nor
      // use a remote/hybrid classification.
      virtuality_level: null,
      // Time-zone context is derived from optional city selections on the
      // roster, rather than asking a consultant to estimate it up front.
      timezones: null,
      roster_size: rosterSize,
      known_sensitivities: textOrNull(body?.known_sensitivities, 2000),
    })
    .select("team_id")
    .single();
  if (teamError || !team) return NextResponse.json({ error: "Unable to create team." }, { status: 500 });
  return NextResponse.json(team, { status: 201 });
}
