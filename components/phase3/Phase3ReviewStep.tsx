"use client";

import { useEffect, useState } from "react";
import type { BehaviorBucket, MemberBehavior, MemberStory, Phase3ContextResponse } from "@/types/database";
import type { Phase3Step } from "@/components/phase3/Phase3ProgressBar";
import ChatBubble from "@/components/interview/ChatBubble";

type WithdrawScope = "stories" | "behaviors" | "everything";
type WithdrawalStage = "idle" | "choose" | "confirm";
const BUCKET_LABEL: Record<BehaviorBucket, string> = { always: "ALWAYS", sometimes: "SOMETIMES", never: "NEVER" };
const BUCKET_COLOR: Record<BehaviorBucket, string> = { always: "#2D7A4F", sometimes: "#C4860A", never: "#B94040" };

const WITHDRAWAL_COPY: Record<WithdrawScope, { label: string; detail: string }> = {
  stories: {
    label: "Withdraw my stories",
    detail: "This removes your stories, their conversation, and the related impact and frequency reflection. Your Team Agreement answers stay here.",
  },
  behaviors: {
    label: "Withdraw my behaviours",
    detail: "This removes the behaviours you added to the Team Agreement activity. Your other answers stay here.",
  },
  everything: {
    label: "Withdraw my entire contribution",
    detail: "This removes all of your stories, behaviours, commitments, and other activity responses, and removes you from this activity.",
  },
};

type Props = {
  memberId: string;
  teamId: string;
  memberName: string;
  storyVerbatim: boolean;
  behaviorVerbatim: boolean;
  readAloud?: boolean;
  includeStories?: boolean;
  onEditStep: (step: Phase3Step) => void;
  onConsentChange: (fields: { phase3_story_verbatim?: boolean; phase3_behavior_verbatim?: boolean }) => void;
  onSubmit: () => Promise<boolean>;
  onWithdrawn: () => void;
};

function Section({ title, children, onEdit }: { title: string; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="text-sm uppercase tracking-widest text-[var(--color-grey)]">{title}</h2>
        {onEdit && <button type="button" onClick={onEdit} className="text-sm text-[var(--color-purple)] hover:underline">Edit</button>}
      </div>
      {children}
    </section>
  );
}

export default function Phase3ReviewStep({
  memberId, teamId, memberName, storyVerbatim, behaviorVerbatim,
  readAloud = false, includeStories = true, onEditStep, onConsentChange, onSubmit, onWithdrawn,
}: Props) {
  const [stories, setStories] = useState<MemberStory[]>([]);
  const [behaviors, setBehaviors] = useState<MemberBehavior[]>([]);
  const [context, setContext] = useState<Phase3ContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawalStage, setWithdrawalStage] = useState<WithdrawalStage>("idle");
  const [withdrawScope, setWithdrawScope] = useState<WithdrawScope | null>(null);
  const [withdrawalPhrase, setWithdrawalPhrase] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalNotice, setWithdrawalNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/member/phase3/review");
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok) {
          setStories((data.stories as MemberStory[] | undefined) ?? []);
          setBehaviors((data.behaviors as MemberBehavior[] | undefined) ?? []);
          setContext((data.context as Phase3ContextResponse | null | undefined) ?? null);
        } else {
          setError(data.error ?? "Unable to load your saved contribution.");
        }
      } catch {
        if (!cancelled) setError("Unable to load your saved contribution. Please check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId, teamId]);

  async function updatePrivacy(verbatim: boolean) {
    setError(null);
    try {
      const response = await fetch("/api/member/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verbatim_preference: verbatim ? "verbatim" : "summary_only" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Unable to update your privacy choice.");
        return;
      }
      onConsentChange({ phase3_story_verbatim: verbatim, phase3_behavior_verbatim: verbatim });
    } catch {
      setError("Unable to update your privacy choice. Please check your connection and try again.");
    }
  }

  function beginWithdrawal() {
    setError(null);
    setWithdrawalNotice(null);
    setWithdrawalPhrase("");
    setWithdrawScope(null);
    setWithdrawalStage("choose");
  }

  function chooseWithdrawal(scope: WithdrawScope) {
    setError(null);
    setWithdrawalPhrase("");
    setWithdrawScope(scope);
    setWithdrawalStage("confirm");
  }

  function cancelWithdrawal() {
    setWithdrawScope(null);
    setWithdrawalPhrase("");
    setWithdrawalStage("idle");
  }

  async function confirmWithdrawal() {
    if (!withdrawScope) return;

    setWithdrawing(true);
    setError(null);
    try {
      const response = await fetch("/api/member/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: withdrawScope, confirmation: withdrawalPhrase }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Unable to withdraw the requested data.");
        return;
      }

      if (withdrawScope === "everything") {
        onWithdrawn();
        return;
      }

      if (withdrawScope === "stories") setStories([]);
      if (withdrawScope === "behaviors") setBehaviors([]);
      const reportNote = data.report_was_generated
        ? " A team report may already include earlier analysis; contact Wavelength support if you need help with that."
        : "";
      setWithdrawalNotice(
        (withdrawScope === "stories"
          ? "Your stories and related reflection have been withdrawn. Your Team Agreement answers are still here for you to review."
          : "Your behaviours have been withdrawn. Your other answers are still here for you to review.") + reportNote
      );
      cancelWithdrawal();
    } catch {
      setError("Unable to withdraw the requested data. Please check your connection and try again.");
    } finally {
      setWithdrawing(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const completed = await onSubmit();
      if (!completed) {
        setError("We could not save that you completed this activity. Please try again.");
      }
    } catch {
      setError("We could not save that you completed this activity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadSummary() {
    const text = [
      `My Otis contribution — ${new Date().toLocaleDateString("en-GB")}`,
      "",
      "Privacy choice:",
      storyVerbatim || behaviorVerbatim ? "Short exact excerpts without my name may be used." : "Use summaries and paraphrases only.",
      "",
      "Stories:",
      ...stories.map((story) => `- ${story.story_text}`),
      "",
      "Behaviours:",
      ...behaviors.map((behavior) => `- ${behavior.bucket}: ${behavior.text}`),
      "",
      `30-day commitment: ${context?.commitment ?? "Not provided"}`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-otis-contribution.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="text-center text-[var(--color-grey)] py-12">Loading your responses...</p>;
  const grouped = (bucket: BehaviorBucket) => behaviors.filter((behavior) => behavior.bucket === bucket);
  const verbatim = storyVerbatim || behaviorVerbatim;

  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-6 pb-16 space-y-5">
      <ChatBubble readAloud={readAloud}>Please review your contribution, {memberName}. You can edit it before submitting.</ChatBubble>
      <button type="button" onClick={downloadSummary} className="btn-secondary">Download my contribution</button>

      {includeStories && <Section title="Your stories" onEdit={() => onEditStep("chat")}>
        {stories.length ? <ul className="space-y-2">{stories.map((story) => <li key={story.id}>{story.story_text}</li>)}</ul> : <p className="text-[var(--color-grey)]">No story recorded.</p>}
      </Section>}

      <Section title="How should exact words be handled?">
        <p className="text-sm text-[var(--color-grey)] mb-3">This is one global beta privacy setting. Your name is never attached to an excerpt.</p>
        <div className="space-y-2">
          <button type="button" onClick={() => void updatePrivacy(false)} className={`select-option w-full text-left px-4 py-3 ${!verbatim ? "is-selected" : ""}`}>Use summaries and paraphrases only</button>
          <button type="button" onClick={() => void updatePrivacy(true)} className={`select-option w-full text-left px-4 py-3 ${verbatim ? "is-selected" : ""}`}>Permit short exact excerpts without my name</button>
        </div>
      </Section>

      <Section title="Your behaviours" onEdit={() => onEditStep("board")}>
        {(["always", "sometimes", "never"] as BehaviorBucket[]).map((bucket) => {
          const items = grouped(bucket);
          if (!items.length) return null;
          return <div key={bucket} className="mb-3"><p className="text-sm font-semibold" style={{ color: BUCKET_COLOR[bucket] }}>{BUCKET_LABEL[bucket]}</p><ul>{items.map((item) => <li key={item.id}>• {item.text}</li>)}</ul></div>;
        })}
      </Section>

      {includeStories && <>
        <Section title="Impact on the team&apos;s work" onEdit={() => onEditStep("impact")}><p>{context?.impact_text ?? "Not provided"}</p></Section>
        <Section title="How often this happens" onEdit={() => onEditStep("frequency")}><p>{context?.frequency ?? "Not provided"}</p></Section>
      </>}
      <Section title="30-day commitment" onEdit={() => onEditStep("commit_ask")}><p>{context?.commitment ?? "Not provided"}</p>{context?.commitment_result && <p className="mt-2 text-[var(--color-grey)]">Expected result: {context.commitment_result}</p>}</Section>
      <Section title="Meeting together" onEdit={() => onEditStep("commit_sync")}><p>{context?.synchronicity ?? "Not provided"}</p></Section>

      <section className="card border border-red-200 bg-red-50" aria-labelledby="withdraw-heading">
        <h2 id="withdraw-heading" className="font-medium text-red-900">Withdraw data</h2>

        {withdrawalStage === "idle" && (
          <>
            <p className="text-sm text-red-800 mt-1 leading-relaxed">
              Need to remove something you shared? Withdrawal is separate from submitting and is permanent once confirmed.
            </p>
            <button type="button" onClick={beginWithdrawal} className="btn-secondary mt-4 border-red-300 text-red-800 hover:border-red-500">
              Review withdrawal options
            </button>
          </>
        )}

        {withdrawalStage === "choose" && (
          <div className="mt-4 space-y-3">
            <div>
              <h3 className="font-medium text-red-900">Step 1 of 2: Choose what to remove</h3>
              <p className="text-sm text-red-800 mt-1">Nothing has been deleted yet.</p>
            </div>
            <div className="grid gap-3">
              {(["stories", "behaviors", "everything"] as WithdrawScope[]).map((scope) => {
                const isEverything = scope === "everything";
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => chooseWithdrawal(scope)}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                      isEverything
                        ? "border-red-400 bg-red-100 hover:border-red-600"
                        : "border-red-200 bg-white hover:border-red-400"
                    }`}
                  >
                    <span className={`block font-medium ${isEverything ? "text-red-900" : "text-[var(--color-ink)]"}`}>
                      {WITHDRAWAL_COPY[scope].label}
                    </span>
                    <span className="block text-sm text-[var(--color-grey)] mt-1 leading-relaxed">
                      {WITHDRAWAL_COPY[scope].detail}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={cancelWithdrawal} className="text-sm text-[var(--color-purple)] underline underline-offset-2">
              Cancel
            </button>
          </div>
        )}

        {withdrawalStage === "confirm" && withdrawScope && (
          <div className="mt-4 space-y-4">
            <div className={`rounded-xl border px-4 py-3 ${withdrawScope === "everything" ? "border-red-500 bg-red-100" : "border-red-200 bg-white"}`}>
              <h3 className="font-semibold text-red-900">Step 2 of 2: Confirm permanent removal</h3>
              <p className="text-sm text-red-800 mt-1 leading-relaxed">
                <strong>{WITHDRAWAL_COPY[withdrawScope].label}</strong> will permanently delete this data. This cannot be undone.
              </p>
              {withdrawScope === "everything" && (
                <>
                  <p className="text-sm font-medium text-red-900 mt-3 leading-relaxed">
                    Important: this removes your entire contribution and takes you out of this activity. If a team report has already been generated, <a href="mailto:contact@wavelength.team?subject=Otis%20withdrawal%20support" className="underline">contact Wavelength support</a> about what can still be removed from that report.
                  </p>
                  <label className="block text-sm font-medium text-red-900 mt-4" htmlFor="withdraw-confirmation">
                    Type <span className="font-mono">WITHDRAW</span> to confirm
                  </label>
                  <input
                    id="withdraw-confirmation"
                    value={withdrawalPhrase}
                    onChange={(event) => setWithdrawalPhrase(event.target.value)}
                    autoComplete="off"
                    className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-[var(--color-ink)] focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
              <button type="button" onClick={cancelWithdrawal} disabled={withdrawing} className="btn-secondary">
                Keep my data
              </button>
              <button
                type="button"
                onClick={() => void confirmWithdrawal()}
                disabled={withdrawing || (withdrawScope === "everything" && withdrawalPhrase.trim().toUpperCase() !== "WITHDRAW")}
                className="rounded-full bg-red-700 px-5 py-3 font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {withdrawing ? "Withdrawing..." : withdrawScope === "everything" ? "Permanently withdraw my contribution" : `Permanently withdraw my ${withdrawScope === "stories" ? "stories" : "behaviours"}`}
              </button>
            </div>
          </div>
        )}
      </section>
      {withdrawalNotice && <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{withdrawalNotice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={() => void submit()} disabled={submitting || withdrawalStage !== "idle"} className="btn-primary">
          {submitting ? "Submitting..." : withdrawalStage !== "idle" ? "Complete withdrawal choice first" : "Finish & Submit"}
        </button>
      </div>
    </div>
  );
}
