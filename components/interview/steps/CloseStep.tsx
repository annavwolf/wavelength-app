"use client";

import { useState } from "react";
import type { Member } from "@/types/database";

type OptOutPhase = "idle" | "confirm" | "done";

export default function CloseStep({
  member,
  onSaved,
  onFinish,
}: {
  member: Member;
  onSaved: (fields: Partial<Member>) => void;
  onFinish: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optOutPhase, setOptOutPhase] = useState<OptOutPhase>("idle");
  const [optOutSaving, setOptOutSaving] = useState(false);
  const [reportWasGenerated, setReportWasGenerated] = useState(false);

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: member.member_id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      onSaved({ status: "complete", completed_at: data.completed_at });
      onFinish();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleOptOutConfirm() {
    setOptOutSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: member.member_id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Unable to process withdrawal. Please email contact@wavelength.team for support.");
        return;
      }
      setReportWasGenerated(Boolean(data.report_was_generated));
      onSaved({ status: "opted_out" });
      setOptOutPhase("done");
    } catch {
      setError("Unable to process withdrawal. Please email contact@wavelength.team for support.");
    } finally {
      setOptOutSaving(false);
    }
  }

  if (optOutPhase === "done") {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <img src="/octopus-logo.png" alt="" aria-hidden="true" className="h-24 w-auto mx-auto mb-8" />
        <h1 className="text-3xl mb-4" style={{ fontFamily: "Playfair Display, serif" }}>Your request has been <span className="purple">recorded.</span></h1>
        <p className="text-[var(--color-grey)] max-w-md mx-auto">
          Your live interview responses have been deleted and will not be used in future analysis.
          {reportWasGenerated ? " A team report had already been generated, so material already included in that report may remain; please email contact@wavelength.team for follow-up." : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-8">
      <img src="/octopus-logo.png" alt="" aria-hidden="true" className="otis-float h-32 w-auto mb-10" />
      <h1 className="text-4xl font-serif mb-6" style={{ fontFamily: "Playfair Display, serif" }}>Take care, <span className="purple">{member.display_name.split(" ")[0]}.</span></h1>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {optOutPhase === "idle" && (
        <>
          <button type="button" onClick={handleFinish} disabled={saving} className="btn-primary mb-12">{saving ? "Saving..." : "Submit & Finish"}</button>
          <button type="button" onClick={() => setOptOutPhase("confirm")} className="text-sm text-[var(--color-grey)] underline underline-offset-2 hover:text-[var(--color-ink)] transition-colors">I would like to withdraw and delete my live interview data</button>
        </>
      )}
      {optOutPhase === "confirm" && (
        <div className="w-full max-w-sm space-y-4">
          <div className="card border-2 border-red-200 bg-red-50 text-left">
            <p className="font-medium text-red-800 mb-1">Are you sure?</p>
            <p className="text-sm text-red-700">This deletes your live interview responses and removes them from future analysis. If a team report was already generated, it may retain a summary or excerpt that was already included.</p>
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={handleOptOutConfirm} disabled={optOutSaving} className="w-full py-3 px-6 rounded-full font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">{optOutSaving ? "Deleting..." : "Yes, delete my live data"}</button>
            <button type="button" onClick={() => setOptOutPhase("idle")} className="btn-secondary w-full">Cancel · keep my responses</button>
          </div>
        </div>
      )}
    </div>
  );
}
