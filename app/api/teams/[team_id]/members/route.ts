import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logIdentityLookups } from "@/lib/auditLog";
import type { MemberWithIdentity } from "@/types/database";

// GET /api/teams/[team_id]/members
// Returns members joined with member_identity — the only server-mediated path
// through which the consultant sees email + display_name alongside response data.
// Uses the service-role client; the browser never queries member_identity directly.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ team_id: string }> }
) {
  const { team_id: teamId } = await params;

  const [membersRes, identityRes] = await Promise.all([
    supabaseAdmin.from("members").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
    supabaseAdmin.from("member_identity").select("member_id, email, display_name").eq("team_id", teamId),
  ]);

  if (membersRes.error) {
    return NextResponse.json({ error: membersRes.error.message }, { status: 500 });
  }

  const identityById = new Map(
    (identityRes.data ?? []).map((i) => [i.member_id, i])
  );

  const members: MemberWithIdentity[] = (membersRes.data ?? []).map((m) => ({
    ...m,
    display_name: identityById.get(m.member_id)?.display_name ?? "",
    email: identityById.get(m.member_id)?.email ?? null,
  }));

  await logIdentityLookups(
    members.map((m) => m.member_id),
    "roster_get",
    `team ${teamId}`
  );

  return NextResponse.json(members);
}

// POST /api/teams/[team_id]/members
// Creates a new member row + its identity row atomically.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ team_id: string }> }
) {
  const { team_id: teamId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const { display_name, email, role, location, timezone, private_code, status } = body;
  if (!display_name || !private_code) {
    return NextResponse.json({ error: "display_name and private_code are required" }, { status: 400 });
  }

  // Insert into members WITHOUT identity fields (display_name/email go to member_identity).
  // During the expand window (0020 applied, 0021 not yet) the columns are nullable
  // in members, so omitting them is safe. After 0021 they're dropped entirely.
  const { data: member, error: memberErr } = await supabaseAdmin
    .from("members")
    .insert({
      team_id: teamId,
      private_code,
      role: role ?? null,
      location: location ?? null,
      timezone: timezone ?? null,
      status: status ?? "pending",
    })
    .select("*")
    .single();

  if (memberErr || !member) {
    return NextResponse.json({ error: memberErr?.message ?? "insert failed" }, { status: 500 });
  }

  // Insert identity row.
  const { error: identityErr } = await supabaseAdmin.from("member_identity").insert({
    member_id: member.member_id,
    team_id: teamId,
    email: email ?? null,
    display_name,
  });

  if (identityErr) {
    // Roll back the member row if identity insert fails — keep the two in sync.
    await supabaseAdmin.from("members").delete().eq("member_id", member.member_id);
    return NextResponse.json({ error: identityErr.message }, { status: 500 });
  }

  const result: MemberWithIdentity = { ...member, display_name, email: email ?? null };
  return NextResponse.json(result, { status: 201 });
}

// DELETE /api/teams/[team_id]/members?member_id=…
// The member_identity row cascades on delete (FK ON DELETE CASCADE), so only
// the members row needs to be explicitly deleted.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ team_id: string }> }
) {
  const { team_id: teamId } = await params;
  const memberId = req.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("members")
    .delete()
    .eq("member_id", memberId)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
