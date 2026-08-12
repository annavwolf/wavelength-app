import { NextRequest, NextResponse } from "next/server";
import { requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const { data, error } = await supabaseAdmin.from("teams").select("*").eq("team_id", teamId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load team." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const teamName = typeof body?.team_name === "string" ? body.team_name.trim().slice(0, 160) : "";
  if (!teamName) return NextResponse.json({ error: "A team name is required." }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("teams")
    .update({ team_name: teamName })
    .eq("team_id", teamId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to update team." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  return NextResponse.json(data);
}
