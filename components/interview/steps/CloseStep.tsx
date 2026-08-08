"use client";

import { useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";

type OptOutPhase = "idle" | "confirm" | "done";

export default function CloseStep({
  member,
  supabase,
  onSaved,
  onFinish,
}: {
  member: Member;
  supabase: AppSupabaseClient;
  onSaved: (fields: Partial<Member>) => void;
  onFinish: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optOutPhase, setOptOutPhase] = useState<OptOutPhase>("idle");
  const [optOutSaving, setOptOutSaving] = useState(false);

  async function handleFinish() {
    setSaving(true);
    setError(null);

    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("members")
      .update({ status: "complete", completed_at: completedAt })
      .eq("member_id", member.member_id);

    if (updateError) {
      console.error("[interview/close] failed to set status=complete:", {
        message: updateError.message,
        code: updateError.code,
      });
      setError("Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    onSaved({ status: "complete", completed_at: completedAt });
    onFinish();
  }

  async function handleOptOutConfirm() {
    setOptOutSaving(true);

    // Delete all response data for this member.
    await Promise.all([
      supabase.from("ps_responses").delete().eq("member_id", member.member_id),
      supabase.from("purpose_responses").delete().eq("member_id", member.member_id),
      supabase.from("coordination_ratings").delete().eq("member_id", member.member_id),
      supabase
        .from("missing_member_flags")
        .delete()
        .eq("reported_by_member_id", member.member_id),
      supabase.from("member_questions").delete().eq("member_id", member.member_id),
    ]);

    // Mark member as opted out (roster stays intact for the team view).
    await supabase
      .from("members")
      .update({ status: "opted_out" })
      .eq("member_id", member.member_id);

    onSaved({ status: "opted_out" });
    setOptOutSaving(false);
    setOptOutPhase("done");
  }

  if (optOutPhase === "done") {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <img
          src="/octopus-logo.png"
          alt=""
          aria-hidden="true"
          className="h-24 w-auto mx-auto mb-8"
        />
        <h1
          className="text-3xl mb-4"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          You&apos;ve been <span className="purple">removed.</span>
        </h1>
        <p className="text-[var(--color-grey)] max-w-md mx-auto">
          All your responses have been deleted. You won&apos;t appear in the
          team analysis. If you change your mind, reach out to your consultant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-8">
      <img
        src="/octopus-logo.png"
        alt=""
        aria-hidden="true"
        className="otis-float h-32 w-auto mb-10"
      />

      <h1
        className="text-4xl font-serif mb-6"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        Take care,{" "}
        <span className="purple">{member.display_name.split(" ")[0]}.</span>
      </h1>

      {error && (
        <p className="text-sm text-[var(--color-grey)] mb-4">{error}</p>
      )}

      {optOutPhase === "idle" && (
        <>
          <button
            type="button"
            onClick={handleFinish}
            disabled={saving}
            className="btn-primary mb-12"
          >
            {saving ? "Saving..." : "Submit & Finish"}
          </button>

          <button
            type="button"
            onClick={() => setOptOutPhase("confirm")}
            className="text-sm text-[var(--color-grey)] underline underline-offset-2 hover:text-[var(--color-ink)] transition-colors"
          >
            I would like to opt out of this assessment and delete my data
          </button>
        </>
      )}

      {optOutPhase === "confirm" && (
        <div className="w-full max-w-sm space-y-4">
          <div className="card border-2 border-red-200 bg-red-50 text-left">
            <p className="font-medium text-red-800 mb-1">Are you sure?</p>
            <p className="text-sm text-red-700">
              This will permanently delete all your responses. Your name will
              remain on the team roster, but your data will be gone and you
              won&apos;t appear in the analysis.
            </p>
            {member.share_name_with_team === false && (
              <p className="text-sm text-red-700 mt-2">
                Your anonymity is preserved — the deletion is not attributed to
                you by name.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleOptOutConfirm}
              disabled={optOutSaving}
              className="w-full py-3 px-6 rounded-full font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {optOutSaving ? "Deleting..." : "Yes, delete my data"}
            </button>
            <button
              type="button"
              onClick={() => setOptOutPhase("idle")}
              className="btn-secondary w-full"
            >
              Cancel — keep my responses
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
