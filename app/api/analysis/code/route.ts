import { NextRequest, NextResponse } from "next/server";
import { codeTeamInterviews } from "@/lib/coding";

// POST /api/analysis/code  { team_id }
// Runs the Phase 2 coding pass for a team: (re)derives coded labels from the
// stored interview text into interview_labels. Standalone for now so it can be
// tested in isolation; it will be folded into the compute pipeline (Analytics
// Spec Stage 1) as the step that runs before clustering.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const teamId: unknown = body?.team_id;
  if (typeof teamId !== "string") {
    return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  }

  try {
    const result = await codeTeamInterviews(teamId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/code] coding pass failed:", msg);
    return NextResponse.json({ error: "coding_failed", detail: msg }, { status: 500 });
  }
}
