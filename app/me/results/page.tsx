"use client";

// Phase 4 self-serve §6 — the member exit interview. Deliberately minimal:
// members see three things (the agreement, what to do next, the roadmap), plus
// downloads and a soft closing note. Everything else lives in the artifacts.
// Behind the /me/:path* member-auth middleware; gated on phase4 release.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Phase4SelfServeJson } from "@/types/database";
import RoadmapInfographic from "@/components/phase4/RoadmapInfographic";

type MeData = {
  member: { display_name: string };
  team: { team_name: string } | null;
  phase4_released: boolean;
  phase4: Phase4SelfServeJson | null;
};

export default function MemberResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<MeData | null>(null);
  const [state, setState] = useState<"loading" | "not_ready" | "ready" | "error">("loading");

  useEffect(() => {
    fetch("/api/member/me")
      .then(async (res) => {
        if (res.status === 401) { router.push("/member-login"); return; }
        if (!res.ok) { setState("error"); return; }
        const d = (await res.json()) as MeData;
        setData(d);
        setState(d.phase4_released && d.phase4 ? "ready" : "not_ready");
      })
      .catch(() => setState("error"));
  }, [router]);

  if (state === "loading") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <img src="/octopus-logo.png" alt="" className="h-20 w-auto mx-auto mb-8" />
        <p className="text-[var(--color-grey)]">Loading your results…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-[var(--color-grey)]">
          We couldn&apos;t load your results.{" "}
          <button onClick={() => window.location.reload()} className="underline">Try again</button>.
        </p>
      </main>
    );
  }

  if (state === "not_ready" || !data?.phase4) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <img src="/octopus-logo.png" alt="" className="h-16 w-auto mx-auto mb-6" />
        <h1 className="text-2xl font-serif mb-3" style={{ fontFamily: "Playfair Display, serif" }}>Not quite ready yet</h1>
        <p className="text-[var(--color-grey)] max-w-sm">
          Your consultant is finishing your team&apos;s results. They&apos;ll be in touch when they&apos;re ready.
        </p>
        <Link href="/me" className="text-sm text-[var(--color-grey)] underline mt-6">Back to your profile</Link>
      </main>
    );
  }

  const p4 = data.phase4;
  const a = p4.agreement;
  const firstName = data.member.display_name.split(" ")[0];

  return (
    <main className="flex-1">
      <div className="w-full max-w-2xl mx-auto px-6 pt-12 pb-20 space-y-10">
        <div>
          <img src="/octopus-logo.png" alt="" className="h-10 w-auto mb-5" />
          <h1 className="text-3xl font-serif" style={{ fontFamily: "Playfair Display, serif" }}>
            Your team&apos;s results
          </h1>
          {data.team && <p className="accent text-lg mt-1">{data.team.team_name}</p>}
          <p className="text-[var(--color-grey)] leading-relaxed mt-3">
            Thanks, {firstName}. Here&apos;s what your team told Otis, drawn together.
          </p>
        </div>

        {/* §6.1 — The agreement */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">Your team&apos;s agreement</h2>
          <div className="rounded-2xl border border-[var(--color-navy)]/20 bg-[var(--color-navy)]/4 px-6 py-5 space-y-4">
            <p className="text-base leading-relaxed">
              In order to make this team a place where <strong>{a.ps_item}</strong>
              {a.situations.length > 0 && (
                <>, especially during <strong>{a.situations.join(" and ")}</strong></>
              )}
              , members will aim to:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-navy)] mb-1.5">Always</p>
                <ul className="space-y-1">
                  {a.always.map((b, i) => <li key={i} className="text-sm leading-snug">· {b}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-amber)] mb-1.5">Never</p>
                <ul className="space-y-1">
                  {a.never.map((b, i) => <li key={i} className="text-sm leading-snug">· {b}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* §6.2 — What to do next (verbatim script) */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">What to do next</h2>
          <div className="rounded-2xl border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/4 px-6 py-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[var(--color-purple)]">Otis</p>
            {p4.what_to_do_next.split("\n\n").map((para, i) => (
              <p key={i} className="text-base leading-relaxed">{para}</p>
            ))}
          </div>
        </section>

        {/* §6.3 — Roadmap infographic */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">Your 30-day roadmap</h2>
          <RoadmapInfographic />
        </section>

        {/* §6.4 — Downloads */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-grey)]">Your guides</h2>
          <div className="grid grid-cols-1 gap-3">
            <DownloadCard href="/me/results/game-plan" title="Your 30-Day Game Plan"
              blurb="Fill this in together during your meeting. Editable — print or save when you're done." />
            <DownloadCard href="/me/results/meeting-agenda" title="Team Meeting Agenda"
              blurb="How to run the one meeting that finalises your agreement and builds the game plan." />
            <DownloadCard href="/me/results/check-in" title="Weekly Check-In Protocol"
              blurb="The recurring 10–15 minute check-in. Same questions, same order, every time." />
          </div>
        </section>

        {/* §6.5 — Closing note */}
        <p className="text-sm text-[var(--color-grey)] italic pt-2">{p4.closing_note}</p>

        <Link href="/me" className="inline-block text-sm text-[var(--color-grey)] underline">← Back to your profile</Link>
      </div>
    </main>
  );
}

function DownloadCard({ href, title, blurb }: { href: string; title: string; blurb: string }) {
  return (
    <Link href={href} className="card flex items-center justify-between gap-4 hover:border-[var(--color-navy)]/40 transition-colors"
      style={{ padding: "16px 20px" }}>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-[var(--color-grey)] mt-0.5">{blurb}</p>
      </div>
      <span className="text-[var(--color-navy)] text-sm whitespace-nowrap flex-shrink-0">Open →</span>
    </Link>
  );
}
