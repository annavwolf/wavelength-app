"use client";

// Consultant preview of the 30-Day Game Plan guide.
// Loads directly from the analysis table (no member session required).
// Identical rendering to /me/results/game-plan — just different data source.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import type { Phase4SelfServeJson } from "@/types/database";

type Loaded = {
  teamName: string;
  agreedDate: string;
  reviewDate: string;
  psItem: string;
  situations: string[];
  always: string[];
  never: string[];
};

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function ConsultantGamePlanPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const [supabase] = useState(() => createBrowserClient());
  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "not_ready" | "ready">("loading");

  useEffect(() => {
    void (async () => {
      const { data: row } = await supabase
        .from("analysis")
        .select("phase4_selfserve_json")
        .eq("team_id", teamId)
        .maybeSingle();
      const p4 = row?.phase4_selfserve_json as Phase4SelfServeJson | null;
      if (!p4?.agreement) { setState("not_ready"); return; }
      const released = p4.released_at ? new Date(p4.released_at) : new Date();
      const review = new Date(released);
      review.setDate(review.getDate() + 30);
      const { data: team } = await supabase.from("teams").select("team_name").eq("team_id", teamId).maybeSingle();
      setData({
        teamName: team?.team_name ?? "",
        agreedDate: fmt(released),
        reviewDate: fmt(review),
        psItem: p4.agreement.ps_item,
        situations: p4.agreement.situations,
        always: p4.agreement.always,
        never: p4.agreement.never,
      });
      setState("ready");
    })();
  }, [teamId, supabase]);

  if (state === "loading") {
    return <main className="flex-1 flex items-center justify-center py-24 text-[var(--color-grey)]">Loading…</main>;
  }
  if (state === "not_ready" || !data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-[var(--color-grey)]">Generate insights first to preview this guide.</p>
        <Link href={`/teams/${teamId}`} className="text-sm underline mt-4">← Back to dashboard</Link>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="w-full max-w-2xl mx-auto px-6 pt-8 pb-20">
        <div className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <Link href={`/teams/${teamId}`} className="text-sm text-[var(--color-grey)] underline">← Back to dashboard</Link>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Consultant preview</span>
            <button type="button" onClick={() => window.print()} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "13px" }}>
              Print / Save as PDF
            </button>
          </div>
        </div>

        <article className="card space-y-6" style={{ padding: "32px" }}>
          <header>
            <h1 className="text-2xl" style={{ fontFamily: "Playfair Display, serif" }}>Your Team&apos;s 30-Day Game Plan</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-grey)] mt-2">
              <span>Team: <Fill defaultValue={data.teamName} w={160} /></span>
              <span>Date agreed: <Fill defaultValue={data.agreedDate} w={140} /></span>
              <span>Review date (30 days): <Fill defaultValue={data.reviewDate} w={140} /></span>
            </div>
          </header>

          <p className="text-sm text-[var(--color-grey)]">
            Fill this in together during your team meeting. Everything here is a decision your team makes, not something Otis decides for you.
          </p>

          <hr className="border-black/10" />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Our Team Behaviour Agreement</h2>
            <p className="text-xs text-[var(--color-grey)] italic">
              Otis drafted this from what your team told us. Change anything that doesn&apos;t sound like you.
            </p>
            <div className="rounded-xl border border-[var(--color-navy)]/20 bg-[var(--color-navy)]/4 px-5 py-4 space-y-3 text-sm">
              <p>In order to make this team a place where <Fill defaultValue={data.psItem} w={320} />,</p>
              <p>especially during <Fill defaultValue={data.situations[0] ?? ""} w={200} /> and <Fill defaultValue={data.situations[1] ?? ""} w={200} />,</p>
              <p>members will aim to:</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-navy)] mb-1">Always</p>
                <NumberedFills prefill={data.always} count={3} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-amber)] mb-1">Never</p>
                <NumberedFills prefill={data.never} count={3} />
              </div>
            </div>
          </section>

          <hr className="border-black/10" />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. How we&apos;ll respond to a NEVER behaviour</h2>
            <p className="text-xs text-[var(--color-grey)] italic">Pick 2 to 4.</p>
            <Check label={<><strong>Assume positive intent.</strong> We remind ourselves the team won&apos;t be perfect right away, and slip-ups are chances for kind correction and mutual learning.</>} />
            <Check label={<><strong>Say &ldquo;oops.&rdquo;</strong> If I catch myself doing a NEVER behaviour, I say <em>&ldquo;oops, that&apos;s a never behaviour.&rdquo;</em></>} />
            <Check label={<><strong>Say &ldquo;ouch.&rdquo;</strong> If I notice someone else doing one, I say <em>&ldquo;ouch, that feels like a NEVER behaviour.&rdquo;</em></>} />
            <Check label={<><strong>Silent signal.</strong> We use an agreed hand sign or emoji to flag it without stopping the flow.</>} />
          </section>

          <hr className="border-black/10" />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. How we&apos;ll respond to an ALWAYS behaviour</h2>
            <p className="text-xs text-[var(--color-grey)] italic">Pick 2 to 4.</p>
            <Check label={<><strong>Name it specifically.</strong> <em>&ldquo;That was an ALWAYS behaviour, [name] just [specific action].&rdquo;</em></>} />
            <Check label={<><strong>Signal it lightly.</strong> An agreed emoji (🌟) in chat, or a thumbs-up in person.</>} />
            <Check label={<><strong>Pass it forward.</strong> When someone models an ALWAYS towards me, I do the same for someone else this week.</>} />
            <Check label={<><strong>Bank it for the check-in.</strong> If the moment passes, note it and raise it in the appreciation round.</>} />
          </section>

          <hr className="border-black/10" />

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">4. Our team check-in</h2>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">How often will we check in?</p>
              <Check label="Weekly" /><Check label="Every two weeks" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">When and where?</p>
              <Check label={<span>Added to an existing meeting: <Fill w={200} /></span>} />
              <Check label={<span>A new dedicated time: <Fill w={200} /></span>} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Who facilitates?</p>
              <Check label="We rotate each time (recommended)" />
              <Check label={<span>Fixed person: <Fill w={140} /></span>} />
            </div>
          </section>

          <hr className="border-black/10" />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Our commitment</h2>
            <p className="text-sm">We commit to this for <strong>30 days</strong>, then review.</p>
            <p className="text-sm">Review date in the calendar: <Fill defaultValue={data.reviewDate} w={160} /></p>
          </section>
        </article>
      </div>
    </main>
  );
}

function Fill({ defaultValue = "", w = 160 }: { defaultValue?: string; w?: number }) {
  return (
    <input type="text" defaultValue={defaultValue} style={{ width: w, maxWidth: "100%" }}
      className="border-b border-black/30 focus:border-[var(--color-navy)] outline-none bg-transparent px-1 text-[var(--color-ink)]" />
  );
}

function NumberedFills({ prefill, count }: { prefill: string[]; count: number }) {
  return (
    <ol className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-grey)]">{i + 1}.</span>
          <Fill defaultValue={prefill[i] ?? ""} w={360} />
        </li>
      ))}
    </ol>
  );
}

function Check({ label }: { label: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="accent-[var(--color-navy)] mt-1 flex-shrink-0" />
      <span className="leading-snug">{label}</span>
    </label>
  );
}
