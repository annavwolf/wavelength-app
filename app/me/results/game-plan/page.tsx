"use client";

// Phase 4 self-serve §7.2 — the Game Plan as an in-app EDITABLE form (the
// confirmed format decision). Wording is the locked template (Game_Plan_Template.md);
// §1 is pre-filled from the team's agreement, sections 2–5 are blank with no
// pre-ticked boxes. Fill on screen during the meeting, then Print / Save as PDF.
// Client-side only — nothing is persisted (spec §8 forbids uploading revisions back).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Phase4SelfServeJson } from "@/types/database";
import MemberNav from "@/components/member/MemberNav";

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

export default function GamePlanPage() {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "not_ready" | "ready">("loading");

  useEffect(() => {
    fetch("/api/member/me")
      .then(async (res) => {
        if (res.status === 401) { router.push("/member-login"); return; }
        const d = await res.json();
        const p4 = d.phase4 as Phase4SelfServeJson | null;
        if (!p4?.released_at) { setState("not_ready"); return; }
        const released = new Date(p4.released_at);
        const review = new Date(released);
        review.setDate(review.getDate() + 30);
        setData({
          teamName: d.team?.team_name ?? "",
          agreedDate: fmt(released),
          reviewDate: fmt(review),
          psItem: p4.agreement.ps_item,
          situations: p4.agreement.situations,
          always: p4.agreement.always,
          never: p4.agreement.never,
        });
        setState("ready");
      })
      .catch(() => setState("not_ready"));
  }, [router]);

  if (state === "loading") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center text-[var(--color-grey)]">
        <p>Loading…</p>
        <Link href="/me" className="text-sm underline mt-6">Back to your profile</Link>
      </main>
    );
  }
  if (state === "not_ready" || !data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-[var(--color-grey)]">Your game plan isn&apos;t available yet.</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 text-sm">
          <Link href="/me/results" className="underline">Back to your results</Link>
          <Link href="/me" className="underline">Back to your profile</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="w-full max-w-2xl mx-auto px-6 pt-8 pb-20">
        <MemberNav />
        <div className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <Link href="/me/results" className="text-sm text-[var(--color-grey)] underline">← Back to your results</Link>
          <button type="button" onClick={() => window.print()} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "13px" }}>
            Print / Save as PDF
          </button>
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

          {/* 1. Agreement (pre-filled) */}
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
            <p className="text-xs text-[var(--color-grey)]">
              <strong>Check before you move on:</strong> does the situation above match where this actually shows up for your team? If the real problem is somewhere else (a chat channel, handovers, one-to-ones), change it now. Everything else depends on getting this right.
            </p>
          </section>

          <hr className="border-black/10" />

          {/* 2. NEVER response */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. How we&apos;ll respond to a NEVER behaviour</h2>
            <p className="text-xs text-[var(--color-grey)] italic">Pick 2 to 4. Tweak the wording. Or write your own.</p>
            <Check label={<><strong>Assume positive intent.</strong> We remind ourselves the team won&apos;t be perfect right away, and slip-ups are chances for kind correction and mutual learning.</>} />
            <Check label={<><strong>Say &ldquo;oops.&rdquo;</strong> If I catch myself doing a NEVER behaviour, I say <em>&ldquo;oops, that&apos;s a never behaviour.&rdquo;</em> Leaders going first here matters most.</>} />
            <Check label={<><strong>Say &ldquo;ouch.&rdquo;</strong> If I notice someone else doing one, I say <em>&ldquo;ouch, that feels like a NEVER behaviour. I&apos;m mentioning it because I value our work together.&rdquo;</em></>} />
            <Check label={<><strong>Silent signal.</strong> We use an agreed hand sign or emoji (✋ 🚫) to flag it without stopping the flow, in meetings or in chat.</>} />
            <CheckOwn />
            <p className="text-xs text-[var(--color-grey)]">
              <strong>Comfort check before you commit:</strong> ask everyone <em>&ldquo;how comfortable would you be actually using this?&rdquo;</em> Hold up 1 to 5 fingers. Anyone under 3 says what would make it easier. Adjust until people can genuinely use it.
            </p>
          </section>

          <hr className="border-black/10" />

          {/* 3. ALWAYS response */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. How we&apos;ll respond to an ALWAYS behaviour</h2>
            <p className="text-xs text-[var(--color-grey)] italic">Pick 2 to 4.</p>
            <Check label={<><strong>Name it specifically.</strong> <em>&ldquo;That was an ALWAYS behaviour, [name] just [specific action].&rdquo;</em> Specific beats generic; &ldquo;great job&rdquo; does nothing.</>} />
            <Check label={<><strong>Signal it lightly.</strong> An agreed emoji (🌟) in chat, or a thumbs-up in person. No interruption needed.</>} />
            <Check label={<><strong>Pass it forward.</strong> When someone models an ALWAYS behaviour toward me, I do the same for someone else this week.</>} />
            <Check label={<><strong>Bank it for the check-in.</strong> If the moment passes, note it and raise it in the appreciation round.</>} />
            <CheckOwn />
          </section>

          <hr className="border-black/10" />

          {/* 4. Check-in */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">4. Our team check-in</h2>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">How often will we check in?</p>
              <Check label="Weekly" /><Check label="Every two weeks" />
              <div className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--color-navy)]" /> Other: <Fill w={140} /></div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">When and where?</p>
              <div className="flex items-start gap-2 text-sm"><input type="checkbox" className="accent-[var(--color-navy)] mt-1" /> <span>Added to an existing meeting: <Fill w={200} /> <em className="text-[var(--color-grey)]">(recommended, it&apos;s far more likely to survive)</em></span></div>
              <div className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--color-navy)]" /> A new dedicated time: <Fill w={200} /></div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">How will we run it?</p>
              <Check label="Everyone together, live" />
              <Check label="Live, with a way to include anyone who misses it" />
              <Check label="Two smaller meetings that get aligned afterward" />
              <Check label="Fully asynchronous" />
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Who facilitates?</p>
              <Check label={<>We rotate each time <em className="text-[var(--color-grey)]">(recommended)</em></>} />
              <div className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--color-navy)]" /> Fixed person: <Fill w={140} /></div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Will we collect observations privately before the check-in?</p>
              <Check label="Yes" /><Check label="No" />
              <p className="text-xs text-[var(--color-grey)] italic">
                This one matters more than it looks. Members privately submit anything unresolved, it gets pooled with names removed, and the facilitator reads the patterns aloud to open that part of the check-in. It means nobody has to be the first brave person, absent members still contribute, and it works even if your team can&apos;t all meet.
              </p>
            </div>
          </section>

          <hr className="border-black/10" />

          {/* 5. Commitment */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Our commitment</h2>
            <p className="text-sm">We commit to this for <strong>30 days</strong>, then review.</p>
            <p className="text-xs text-[var(--color-grey)] italic">
              Go around: hold up 1 to 5 fingers for how easy this will be to follow. Anyone under 3, what would help?
            </p>
            <p className="text-sm">Adjustments made: <Fill w={320} /></p>
            <p className="text-sm">Who&apos;s keeping this document? <Fill w={200} /></p>
            <p className="text-sm">Where does it live so we all see it? <Fill w={200} /> <em className="text-[var(--color-grey)]">(pin it in your chat channel or shared workspace)</em></p>
          </section>

          <hr className="border-black/10" />

          {/* 6. After 30 days */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. What happens after 30 days</h2>
            <p className="text-sm">
              Your team will check back in with Otis to see whether the effort moved anything, and where there&apos;s still room to grow. Put the date in the calendar now: <Fill defaultValue={data.reviewDate} w={160} />
            </p>
          </section>

          <p className="text-xs text-[var(--color-grey)] italic pt-2">
            Everything in this document is your team&apos;s decision. Otis drafted the agreement, but you own it.
          </p>
        </article>
      </div>
    </main>
  );
}

// A writable underline field. Uncontrolled so it prints with whatever's typed.
function Fill({ defaultValue = "", w = 160 }: { defaultValue?: string; w?: number }) {
  return (
    <input
      type="text"
      defaultValue={defaultValue}
      style={{ width: w, maxWidth: "100%" }}
      className="border-b border-black/30 focus:border-[var(--color-navy)] outline-none bg-transparent px-1 text-[var(--color-ink)]"
    />
  );
}

function NumberedFills({ prefill, count }: { prefill: string[]; count: number }) {
  return (
    <ol className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-grey)]">{i + 1}.</span>
          <Fill defaultValue={prefill[i] ?? ""} w={360} />
          {i === count - 1 && <em className="text-xs text-[var(--color-grey)]">(optional)</em>}
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

function CheckOwn() {
  return (
    <div className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="accent-[var(--color-navy)] mt-1 flex-shrink-0" />
      <span className="leading-snug"><strong>Our own approach:</strong> <Fill w={300} /></span>
    </div>
  );
}
