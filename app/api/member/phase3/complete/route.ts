import { NextRequest, NextResponse } from "next/server";
import { requireAcknowledgedMember } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const auth = await requireAcknowledgedMember(request);
  if (!auth.ok) return auth.response;
  const completedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("members")
    .update({ phase3_completed_at: completedAt })
    .eq("member_id", auth.value.session.member_id)
    .eq("team_id", auth.value.session.team_id);
  if (error) return NextResponse.json({ error: "Unable to mark this activity complete." }, { status: 500 });
  return NextResponse.json({ ok: true, completed_at: completedAt });
}
