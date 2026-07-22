/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// TODO(phase2/cleanup): STALE + DEAD. This step is not in STEP_ORDER (not wired
// into the flow) and is built around the retired 3-point green/yellow/red scale.
// Type-checking disabled only to keep `next build` green during the Phase 1
// rebuild. Safe to delete once confirmed unused; do not revive without reworking
// for the 5-point scale.
"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member, PsLabel, PsStatement, Team, Zone } from "@/types/database";

type Dominant = "green" | "mixed" | "red";

function dominantFor(counts: { green: number; yellow: number; red: number }): Dominant {
  const total = counts.green + counts.yellow + counts.red;
  if (total === 0) return "mixed";
  if (counts.green / total >= 0.6) return "green";
  if (counts.red / total >= 0.4) return "red";
  return "mixed";
}

// Zone-level only — never mentions a specific statement.
const ZONE_REFLECTIONS: Record<Zone, Record<Dominant, string>> = {
  1: {
    green: "Your team sounds like a safe place to belong.",
    mixed:
      "Belonging seems mostly there, but not always consistent — some moments may feel less safe than others.",
    red: "It sounds like belonging doesn't feel fully secure on this team yet.",
  },
  2: {
    green:
      "It sounds like people can speak up freely on this team — including with the harder things.",
    mixed: "It sounds harder to speak freely — some things may not get said.",
    red: "Speaking up freely sounds genuinely difficult on this team right now.",
  },
  3: {
    green:
      "And at the deepest level — taking risks, challenging ideas — that sounds genuinely available to you.",
    mixed:
      "Taking real risks and challenging the status quo sounds possible sometimes, but not a given.",
    red: "And at the deepest level — taking risks, challenging ideas — that doesn't feel fully available yet.",
  },
};

export default function PsReflectStep({
  member,
  team,
  statements,
  ratings,
  supabase,
  readAloud,
  onAdvance,
}: {
  member: Member;
  team: Team;
  statements: PsStatement[];
  ratings: Record<number, PsLabel>;
  supabase: AppSupabaseClient;
  readAloud: boolean;
  onAdvance: () => void;
}) {
  const [responded, setResponded] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zoneMessages = ([1, 2, 3] as Zone[]).map((zone) => {
    const zoneStatementIds = statements
      .filter((s) => s.zone === zone)
      .map((s) => s.statement_id);

    const counts = { green: 0, yellow: 0, red: 0 };
    for (const id of zoneStatementIds) {
      const label = ratings[id];
      if (label) counts[label] += 1;
    }

    return ZONE_REFLECTIONS[zone][dominantFor(counts)];
  });

  async function handleResponse(matches: boolean) {
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("ps_reflection_checks")
      .insert({
        team_id: team.team_id,
        member_id: member.member_id,
        matches_reflection: matches,
      });

    if (insertError) {
      console.error("[interview/ps_reflect] failed to save reflection check:", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
      setError("Something went wrong saving that. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setResponded(matches);
  }

  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Thank you. Here&apos;s what I&apos;m seeing from your responses.
      </ChatBubble>

      {zoneMessages.map((message) => (
        <ChatBubble key={message} readAloud={readAloud}>
          {message}
        </ChatBubble>
      ))}

      {responded === null && (
        <>
          <ChatBubble readAloud={readAloud}>
            Does that match what you experience?
          </ChatBubble>

          {error && <p className="text-[var(--color-grey)] mb-4">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleResponse(true)}
              disabled={saving}
              className="btn-primary"
            >
              Yes, that&apos;s about right
            </button>
            <button
              type="button"
              onClick={() => handleResponse(false)}
              disabled={saving}
              className="btn-secondary"
            >
              Not quite
            </button>
          </div>
        </>
      )}

      {responded !== null && (
        <>
          <ChatBubble readAloud={readAloud}>
            I&apos;m going to hold onto what you&apos;ve told me and come
            back to it. Before I draw any conclusions, I want to ask you
            about something else — some specific challenges that tend to
            come up in virtual and remote teams. It should only take a few
            minutes.
          </ChatBubble>

          <button type="button" onClick={onAdvance} className="btn-primary">
            Continue
          </button>
        </>
      )}
    </div>
  );
}
