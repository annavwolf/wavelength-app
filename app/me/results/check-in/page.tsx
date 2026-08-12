"use client";

// Phase 4 self-serve §7 — read-only Weekly Check-In Protocol, filled for this team.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Phase4SelfServeJson } from "@/types/database";
import Markdown from "@/components/phase4/Markdown";
import MemberNav from "@/components/member/MemberNav";

export default function CheckInPage() {
  const router = useRouter();
  const [content, setContent] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "not_ready" | "ready">("loading");

  useEffect(() => {
    fetch("/api/member/me")
      .then(async (res) => {
        if (res.status === 401) { router.push("/member-login"); return; }
        const d = await res.json();
        const p4 = d.phase4 as Phase4SelfServeJson | null;
        const art = p4?.artifacts?.find((x) => x.slug === "check_in");
        if (p4?.released_at && art) { setContent(art.content); setState("ready"); }
        else setState("not_ready");
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
  if (state === "not_ready" || !content) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-[var(--color-grey)]">This guide isn&apos;t available yet.</p>
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
        <article className="card" style={{ padding: "32px" }}>
          <Markdown content={content} />
        </article>
      </div>
    </main>
  );
}
