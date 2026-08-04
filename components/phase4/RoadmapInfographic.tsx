"use client";

// Phase 4 self-serve §6.3 — the roadmap infographic. An inline component (not a
// static image) so labels can carry the team's own cadence later. Horizontal
// timeline: one TEAM MEETING block (Finalise Agreement + Game Plan) feeding four
// weekly check-ins and a continuous NEVER/ALWAYS reinforcement band, ending with
// a future Otis re-visit. Hovering any element shows a plain-language summary;
// clicking navigates to the relevant artifact (the re-visit has no download).

import { useRouter } from "next/navigation";
import { useState } from "react";

type Node = {
  id: string;
  summary: string;
  href: string | null; // null = future step, no download
};

const NODES: Record<string, Node> = {
  meeting: {
    id: "meeting",
    summary: "One 45–60 min meeting to finalise your agreement and build your 30-day game plan. Opens your meeting agenda and game plan.",
    href: "/me/results/meeting-agenda",
  },
  checkin: {
    id: "checkin",
    summary: "A short 10–15 min check-in each week for four weeks, added to a meeting you already have. Opens the check-in protocol.",
    href: "/me/results/check-in",
  },
  reinforce: {
    id: "reinforce",
    summary: "Reinforcing NEVER/ALWAYS behaviours in the moment, all the way through — not only at check-ins. Opens your game plan strategies.",
    href: "/me/results/game-plan",
  },
  revisit: {
    id: "revisit",
    summary: "At the end of the 30 days your team will check back in with Otis to see what moved. This step isn't available yet.",
    href: null,
  },
};

export default function RoadmapInfographic() {
  const router = useRouter();
  const [active, setActive] = useState<Node | null>(null);

  const go = (n: Node) => { if (n.href) router.push(n.href); };

  const block = (n: Node, label: React.ReactNode, className: string) => (
    <button
      type="button"
      onMouseEnter={() => setActive(n)}
      onFocus={() => setActive(n)}
      onMouseLeave={() => setActive(null)}
      onClick={() => go(n)}
      className={`text-left transition-transform hover:-translate-y-0.5 ${n.href ? "cursor-pointer" : "cursor-default"} ${className}`}
      aria-label={n.summary}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5 overflow-x-auto">
        <div className="min-w-[640px] space-y-3">
          {/* Top row: meeting → check-ins → revisit */}
          <div className="flex items-stretch gap-3">
            {block(
              NODES.meeting,
              <div className="rounded-xl bg-[var(--color-navy)] text-white px-4 py-3 h-full flex flex-col justify-center min-w-[160px]">
                <p className="text-xs uppercase tracking-widest opacity-80">Team meeting</p>
                <p className="text-sm font-medium mt-1">Finalise agreement</p>
                <p className="text-sm font-medium">+ game plan</p>
              </div>,
              ""
            )}

            <div className="flex items-center text-[var(--color-grey)]">→</div>

            <div className="flex-1 flex gap-2">
              {["W1", "W2", "W3", "W4"].map((w) => (
                <div key={w} className="flex-1">
                  {block(
                    NODES.checkin,
                    <div className="rounded-xl border border-[var(--color-navy)]/30 bg-[var(--color-navy)]/5 px-2 py-3 text-center h-full flex flex-col justify-center">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--color-grey)]">{w}</p>
                      <p className="text-xs font-medium mt-0.5">Check-in</p>
                    </div>,
                    ""
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center text-[var(--color-grey)]">→</div>

            {block(
              NODES.revisit,
              <div className="rounded-xl border border-dashed border-[var(--color-grey)]/50 bg-black/3 px-4 py-3 h-full flex flex-col justify-center min-w-[130px] text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-grey)]">Later</p>
                <p className="text-xs font-medium mt-0.5">Otis re-visit</p>
                <p className="text-[10px] text-[var(--color-grey)]">(coming soon)</p>
              </div>,
              ""
            )}
          </div>

          {/* Reinforcement band beneath */}
          {block(
            NODES.reinforce,
            <div className="rounded-xl bg-[var(--color-amber)]/10 border border-[var(--color-amber)]/30 px-4 py-2.5 text-center">
              <p className="text-xs font-medium text-[var(--color-ink)]">
                NEVER / ALWAYS behaviour reinforcement — continuous, in the moment
              </p>
            </div>,
            "block w-full"
          )}
        </div>
      </div>

      {/* Hover/focus summary */}
      <div className="min-h-[2.5rem] rounded-xl bg-black/4 px-4 py-3">
        <p className="text-sm text-[var(--color-grey)] leading-relaxed">
          {active ? active.summary : "Hover a step to see what happens, or click to open its guide."}
        </p>
      </div>
    </div>
  );
}
