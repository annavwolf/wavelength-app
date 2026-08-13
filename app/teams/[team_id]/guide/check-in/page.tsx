"use client";

// Consultant preview of the Weekly Check-In Protocol.
// Loads from the analysis table (no member session required).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Phase4SelfServeJson } from "@/types/database";
import Markdown from "@/components/phase4/Markdown";

export default function ConsultantCheckInPage() {
  const { team_id: teamId } = useParams<{ team_id: string }>();
  const [content, setContent] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "not_ready" | "ready">("loading");

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/teams/${teamId}/dashboard`);
      const data = await response.json().catch(() => ({}));
      const p4 = (data.analysis?.phase4_selfserve_json ?? null) as Phase4SelfServeJson | null;
      const art = p4?.artifacts?.find((x) => x.slug === "check_in");
      if (art?.content) { setContent(art.content); setState("ready"); }
      else setState("not_ready");
    })();
  }, [teamId]);

  if (state === "loading") {
    return <main className="flex-1 flex items-center justify-center py-24 text-[var(--color-grey)]">Loading…</main>;
  }
  if (state === "not_ready" || !content) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-[var(--color-grey)]">The check-in protocol hasn&apos;t been generated yet for this team.</p>
        <p className="text-xs text-[var(--color-grey)] mt-2 max-w-sm">
          Artifacts are generated as part of the release. Release the agreement to members to produce this guide.
        </p>
        <Link href={`/teams/${teamId}`} className="text-sm underline mt-4">← Back to dashboard</Link>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Link href={`/teams/${teamId}`} className="inline-flex min-h-11 items-center self-start text-sm text-[var(--color-grey)] underline">← Back to dashboard</Link>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Consultant preview</span>
            <button type="button" onClick={() => window.print()} className="btn-secondary min-h-11 flex-1 sm:flex-none" style={{ padding: "8px 16px", fontSize: "13px" }}>
              Print / Save as PDF
            </button>
          </div>
        </div>
        <article className="card p-5 sm:p-8">
          <Markdown content={content} />
        </article>
      </div>
    </main>
  );
}
