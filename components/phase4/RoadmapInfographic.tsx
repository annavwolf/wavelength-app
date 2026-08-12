"use client";

// Phase 4 self-serve §6.3 — the roadmap infographic. An inline component (not a
// static image) so labels can carry the team's own cadence later. Horizontal
// timeline: one TEAM MEETING block (Finalise Agreement + Game Plan) feeding four
// weekly check-ins and a continuous NEVER/ALWAYS reinforcement band, ending with
// a future Otis re-visit. Hovering any element shows a plain-language summary;
// clicking navigates to the relevant artifact (the re-visit has no download).

import { useState } from "react";

type Node = {
  id: string;
  summary: string;
  memberHref: string | null;   // used on the member-facing results page
  consultantSlug: string | null; // used for /teams/[id]/guide/[slug]
};

const NODES: Record<string, Node> = {
  meeting: {
    id: "meeting",
    summary: "One 45–60 min meeting to finalise your agreement and build your 30-day game plan.",
    memberHref: "/me/results/meeting-agenda",
    consultantSlug: "meeting-agenda",
  },
  checkin: {
    id: "checkin",
    summary: "A short 10–15 min check-in each week for four weeks, added to a meeting you already have.",
    memberHref: "/me/results/check-in",
    consultantSlug: "check-in",
  },
  reinforce: {
    id: "reinforce",
    summary: "Reinforcing NEVER/ALWAYS behaviours in the moment, all the way through — not only at check-ins.",
    memberHref: "/me/results/game-plan",
    consultantSlug: "game-plan",
  },
  revisit: {
    id: "revisit",
    summary: "At the end of the 30 days your team will check back in with Otis to see what moved. Coming soon.",
    memberHref: null,
    consultantSlug: null,
  },
};

export default function RoadmapInfographic({ teamId }: { teamId?: string }) {
  const [active, setActive] = useState<Node | null>(null);

  const go = (n: Node) => {
    const href = teamId && n.consultantSlug
      ? `/teams/${teamId}/guide/${n.consultantSlug}`
      : n.memberHref;
    if (href) window.open(href, "_blank", "noopener");
  };

  const isClickable = (n: Node) =>
    teamId ? !!n.consultantSlug : !!n.memberHref;

  // All active nodes share the same navy style so the infographic reads as one
  // coherent system. Only the coming-soon "Otis re-visit" is greyed/dashed.
  const block = (n: Node, label: React.ReactNode, className: string) => (
    <button
      type="button"
      onMouseEnter={() => setActive(n)}
      onFocus={() => setActive(n)}
      onMouseLeave={() => setActive(null)}
      onBlur={() => setActive(null)}
      onClick={() => go(n)}
      className={`text-left transition-transform hover:-translate-y-0.5 active:translate-y-0 ${isClickable(n) ? "cursor-pointer" : "cursor-default opacity-50"} ${className}`}
      aria-label={n.summary}
    >
      {label}
    </button>
  );

  const NAVY_BG = "var(--color-navy)";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5 overflow-x-auto">
        <div className="min-w-[640px] space-y-3">
          {/* Top row */}
          <div className="flex items-stretch gap-3">
            {block(
              NODES.meeting,
              <div className="rounded-xl text-white px-4 py-3 h-full flex flex-col justify-center min-w-[160px]"
                style={{ background: NAVY_BG }}>
                <p className="text-[10px] uppercase tracking-widest opacity-70">Team meeting</p>
                <p className="text-sm font-medium mt-1">Finalise agreement</p>
                <p className="text-sm font-medium">+ game plan ↗</p>
              </div>,
              ""
            )}

            <div className="flex items-center text-[var(--color-grey)] text-lg">→</div>

            <div className="flex-1 flex gap-2">
              {["W1", "W2", "W3", "W4"].map((w) => (
                <div key={w} className="flex-1">
                  {block(
                    NODES.checkin,
                    <div className="rounded-xl text-white px-2 py-3 text-center h-full flex flex-col justify-center"
                      style={{ background: NAVY_BG }}>
                      <p className="text-[10px] uppercase tracking-widest opacity-70">{w}</p>
                      <p className="text-xs font-medium mt-0.5">Check-in ↗</p>
                    </div>,
                    ""
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center text-[var(--color-grey)] text-lg">→</div>

            {block(
              NODES.revisit,
              <div className="rounded-xl border border-dashed border-black/20 bg-black/3 px-4 py-3 h-full flex flex-col justify-center min-w-[130px] text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-grey)]">Later</p>
                <p className="text-xs font-medium text-[var(--color-grey)] mt-0.5">Otis re-visit</p>
                <p className="text-[10px] text-[var(--color-grey)]">(coming soon)</p>
              </div>,
              ""
            )}
          </div>

          {/* Reinforcement band */}
          {block(
            NODES.reinforce,
            <div className="rounded-xl text-white px-4 py-2.5 text-center"
              style={{ background: NAVY_BG }}>
              <p className="text-xs font-medium opacity-90">
                NEVER / ALWAYS behaviour reinforcement — continuous, in the moment ↗
              </p>
            </div>,
            "block w-full"
          )}
        </div>
      </div>

      {/* Hover summary */}
      <div className="min-h-[2.5rem] rounded-xl bg-black/4 px-4 py-3">
        <p className="text-sm text-[var(--color-grey)] leading-relaxed">
          {active
            ? active.summary
            : "Click any step to open its guide in a new tab."}
        </p>
      </div>
    </div>
  );
}
