import { NextRequest, NextResponse } from "next/server";
import { requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const [analysisRes, statementRes] = await Promise.all([
    supabaseAdmin.from("analysis").select("tier1_json, tier2_json, phase3_report_json").eq("team_id", teamId).maybeSingle(),
    supabaseAdmin.from("ps_statements").select("*").order("statement_id", { ascending: true }),
  ]);
  if (analysisRes.error || statementRes.error) {
    return NextResponse.json({ error: "Unable to load the member journey preview." }, { status: 500 });
  }
  return NextResponse.json({ analysis: analysisRes.data ?? null, statements: statementRes.data ?? [] });
}
