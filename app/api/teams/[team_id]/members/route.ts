import { NextRequest, NextResponse } from "next/server";
import { logIdentityLookups } from "@/lib/auditLog";
import { resolveCityLocation } from "@/lib/cities";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";
import type { MemberWithIdentity } from "@/types/database";

function nextPrivateCode(codes: string[]) {
  const occupied = new Set(codes);
  for (let number = 101; number < 10000; number += 1) {
    const candidate = `P${number}`;
    if (!occupied.has(candidate)) return candidate;
  }
  throw new Error("Unable to allocate a participant code.");
}

// The only consultant route that joins roster identity with a team member row.
// A consultant must own the team before this service-role lookup is allowed.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ team_id: string }> }
) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;

  const [membersRes, identityRes, privacyRes] = await Promise.all([
    supabaseAdmin.from("members").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
    supabaseAdmin.from("member_identity").select("member_id, email, display_name").eq("team_id", teamId),
    supabaseAdmin.from("member_privacy_acknowledgements").select("member_id, acknowledged_at, privacy_notice_version").eq("team_id", teamId),
  ]);
  if (membersRes.error || identityRes.error || privacyRes.error) {
    return NextResponse.json({ error: "Unable to load team members." }, { status: 500 });
  }

  const identityById = new Map((identityRes.data ?? []).map((identity) => [identity.member_id, identity]));
  const privacyById = new Map((privacyRes.data ?? []).map((record) => [record.member_id, record]));
  const members: MemberWithIdentity[] = (membersRes.data ?? []).map((member) => {
    const identity = identityById.get(member.member_id);
    const privacy = privacyById.get(member.member_id);
    const identityNameMissing = !identity?.display_name?.trim();
    return {
      ...member,
      // Participant codes remain only in the pseudonymous analysis payload.
      // Never return a roster-to-code lookup to the consultant browser.
      private_code: "",
      display_name: identityNameMissing ? "Name to be confirmed" : (identity?.display_name ?? ""),
      email: identity?.email ?? null,
      identity_name_missing: identityNameMissing,
      privacy_acknowledged_at: privacy?.acknowledged_at ?? null,
      privacy_notice_version: privacy?.privacy_notice_version ?? null,
      privacy_acknowledged_currently: Boolean(
        privacy?.acknowledged_at && privacy.privacy_notice_version === PRIVACY_NOTICE_VERSION
      ),
      // Consultants can see acknowledgement status, not a named participant's
      // exact-excerpt choice.
      verbatim_preference: null,
    };
  });
  await logIdentityLookups(members.map((member) => member.member_id), "roster_get", `team ${teamId}`);
  return NextResponse.json(members);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ team_id: string }> }
) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Participant details are required." }, { status: 400 });
  }
  const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required to invite a participant." }, { status: 400 });
  }
  const requestedLocation = typeof body.location === "string" ? body.location.trim() : "";
  const location = requestedLocation ? resolveCityLocation(requestedLocation) : null;

  const { data: existingMembers, error: existingError } = await supabaseAdmin
    .from("members")
    .select("private_code")
    .eq("team_id", teamId);
  if (existingError) return NextResponse.json({ error: "Unable to create participant." }, { status: 500 });
  const privateCode = nextPrivateCode((existingMembers ?? []).map((member) => member.private_code));

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .insert({
      team_id: teamId,
      private_code: privateCode,
      role: typeof body.role === "string" && body.role.trim() ? body.role.trim().slice(0, 240) : null,
      location: location?.location ?? (requestedLocation ? requestedLocation.slice(0, 200) : null),
      // Time zone is derived server-side only when a city/country is
      // recognised. Do not accept a browser-supplied value here.
      timezone: location?.timezone ?? null,
      status: "pending",
      share_verbatim_with_team: false,
      share_name_with_team: false,
      phase3_story_verbatim: false,
      phase3_behavior_verbatim: false,
    })
    .select("*")
    .single();
  if (memberError || !member) return NextResponse.json({ error: "Unable to create participant." }, { status: 500 });

  const { error: identityError } = await supabaseAdmin.from("member_identity").insert({
    member_id: member.member_id,
    team_id: teamId,
    email,
    display_name: displayName,
  });
  if (identityError) {
    await supabaseAdmin.from("members").delete().eq("member_id", member.member_id);
    return NextResponse.json({ error: "Unable to create participant identity." }, { status: 500 });
  }
  const result: MemberWithIdentity = {
    ...member,
    private_code: "",
    display_name: displayName || "Name to be confirmed",
    email,
    identity_name_missing: !displayName,
  };
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ team_id: string }> }
) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const memberId = request.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("members").delete().eq("member_id", memberId).eq("team_id", teamId);
  if (error) return NextResponse.json({ error: "Unable to remove participant." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
