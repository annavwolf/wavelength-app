"use client";

// Finish — Phase-1-style review before submitting. Every part is editable
// (each "Edit" jumps back to the owning step). Both Phase 3 confidentiality
// choices sit directly under the box they govern and can be changed here.
//
// Withdrawal: ONE entry point (bottom-left). Click → "are you sure" → choose
// one of three scopes (stories only / behaviours only / everything) → the
// choice is STAGED, not executed, with an Undo. Nothing is deleted until the
// member hits "Finish & Submit", so the decision is fully reversible.

import { useEffect, useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type {
  BehaviorBucket,
  MemberBehavior,
  MemberStory,
  Phase3ContextResponse,
} from "@/types/database";
import type { Phase3Step } from "@/components/phase3/Phase3ProgressBar";
import ChatBubble from "@/components/interview/ChatBubble";

const BUCKET_LABEL: Record<BehaviorBucket, string> = { always: "ALWAYS", sometimes: "SOMETIMES", never: "NEVER" };
const BUCKET_COLOR: Record<BehaviorBucket, string> = { always: "#2D7A4F", sometimes: "#C4860A", never: "#B94040" };

type WithdrawScope = "stories" | "behaviors" | "everything";
type WithdrawPhase = "idle" | "confirm" | "choose" | "staged";

const WITHDRAW_LABEL: Record<WithdrawScope, string> = {
  stories: "Only my stories",
  behaviors: "Only my behaviours",
  everything: "Everything I shared in this activity",
};

type Props = {
  memberId: string;
  teamId: string;
  memberName: string;
  supabase: AppSupabaseClient;
  storyVerbatim: boolean;
  behaviorVerbatim: boolean;
  readAloud?: boolean;
  // When the Team Stories section was excluded from this release, hide the
  // story / impact / frequency parts of the review.
  includeStories?: boolean;
  onEditStep: (step: Phase3Step) => void;
  onConsentChange: (fields: { phase3_story_verbatim?: boolean; phase3_behavior_verbatim?: boolean }) => void;
  onSubmit: () => void;
  onWithdrawn: () => void;
};

function Section({ title, onEdit, children }: { title: React.ReactNode; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm uppercase tracking-widest text-[var(--color-grey)]">{title}</p>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-sm text-[var(--color-purple)] hover:underline">
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function ConsentToggle({
  value, onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2.5">
      {[
        { v: true, label: "Share my exact words, along with my name" },
        { v: false, label: "Keep me anonymous — paraphrase, don't attach my name" },
      ].map((opt) => (
        <button
          key={String(opt.v)}
          type="button"
          onClick={() => onChange(opt.v)}
          className={`select-option w-full text-left px-4 py-3 text-base ${value === opt.v ? "is-selected" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Phase3ReviewStep({
  memberId, teamId, memberName, supabase,
  storyVerbatim, behaviorVerbatim, readAloud = false,
  includeStories = true,
  onEditStep, onConsentChange, onSubmit, onWithdrawn,
}: Props) {
  const [stories, setStories] = useState<MemberStory[]>([]);
  const [behaviors, setBehaviors] = useState<MemberBehavior[]>([]);
  const [context, setContext] = useState<Phase3ContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Staged, reversible withdrawal.
  const [withdrawPhase, setWithdrawPhase] = useState<WithdrawPhase>("idle");
  const [withdrawScope, setWithdrawScope] = useState<WithdrawScope | null>(null);
  const [pendingScope, setPendingScope] = useState<WithdrawScope>("everything");

  useEffect(() => {
    void (async () => {
      const [{ data: st }, { data: bh }, { data: ctx }] = await Promise.all([
        supabase.from("member_stories").select("*").eq("member_id", memberId).eq("team_id", teamId).order("story_order", { ascending: true }),
        supabase.from("member_behaviors").select("*").eq("member_id", memberId).eq("team_id", teamId).order("created_at", { ascending: true }),
        supabase.from("phase3_context_responses").select("*").eq("member_id", memberId).eq("team_id", teamId).maybeSingle(),
      ]);
      setStories((st as MemberStory[]) ?? []);
      setBehaviors((bh as MemberBehavior[]) ?? []);
      setContext((ctx as Phase3ContextResponse) ?? null);
      setLoading(false);
    })();
  }, [memberId, teamId, supabase]);

  async function saveConsent(fields: { phase3_story_verbatim?: boolean; phase3_behavior_verbatim?: boolean }) {
    onConsentChange(fields);
    await supabase.from("members").update(fields).eq("member_id", memberId);
  }

  async function applyWithdrawal(scope: WithdrawScope) {
    const jobs: PromiseLike<unknown>[] = [];
    if (scope === "stories" || scope === "everything") {
      jobs.push(supabase.from("member_stories").delete().eq("member_id", memberId).eq("team_id", teamId));
      jobs.push(supabase.from("phase3_conversation_messages").delete().eq("member_id", memberId).eq("team_id", teamId).eq("kind", "story"));
    }
    if (scope === "behaviors" || scope === "everything") {
      jobs.push(supabase.from("member_behaviors").delete().eq("member_id", memberId).eq("team_id", teamId));
    }
    if (scope === "everything") {
      jobs.push(supabase.from("phase3_context_responses").delete().eq("member_id", memberId).eq("team_id", teamId));
      jobs.push(supabase.from("phase3_conversation_messages").delete().eq("member_id", memberId).eq("team_id", teamId).eq("kind", "impact"));
    }
    await Promise.all(jobs);
  }

  function buildReportHTML(): string {
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const list = (items: string[]) =>
      items.length ? `<ul style="margin:4px 0 0 18px;padding:0">${items.map((i) => `<li style="margin:2px 0">${esc(i)}</li>`).join("")}</ul>` : "<p style='color:#777'>—</p>";
    const section = (title: string, body: string) =>
      `<h2 style="font-size:15px;margin:18px 0 4px;color:#1F1F1F">${title}</h2>${body}`;
    const behaviourBlock = (["always", "sometimes", "never"] as BehaviorBucket[])
      .map((b) => {
        const items = byBucket(b).map((x) => x.text);
        return items.length ? `<p style="margin:6px 0 0"><strong style="color:${BUCKET_COLOR[b]}">${BUCKET_LABEL[b]}</strong></p>${list(items)}` : "";
      })
      .join("");
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>My Team Agreement contribution</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1F1F1F;max-width:680px;margin:0 auto;padding:32px;line-height:1.5}h1{font-size:22px}p{font-size:14px;margin:2px 0}li{font-size:14px}@media print{body{padding:16px}h2{page-break-after:avoid}}</style>
</head><body>
<h1>${esc(memberName)} — Team Agreement contribution</h1>
<p style="color:#777">${date}</p>
${section("Your stories", stories.length ? list(stories.map((s) => s.story_text)) : "<p style='color:#777'>—</p>")}
${section("Consent — stories", `<p>${storyVerbatim ? "Share my exact words, along with my name." : "Keep me anonymous — paraphrase, no name."}</p>`)}
${section("Impact on the team's work", `<p>${context?.impact_text ? esc(context.impact_text) : "—"}</p>`)}
${section("How often this happens", `<p>${context?.frequency ? esc(context.frequency) : "—"}</p>`)}
${section("Your behaviours", behaviourBlock || "<p style='color:#777'>—</p>")}
${section("Consent — behaviours", `<p>${behaviorVerbatim ? "Share my exact words, along with my name." : "Keep me anonymous — paraphrase, no name."}</p>`)}
${section("30-day commitment", `<p>${context?.commitment ? esc(context.commitment) : "—"}${context?.commitment_result ? ` — expected result: ${esc(context.commitment_result)}` : ""}</p>`)}
${section("Meeting together", `<p>${context?.synchronicity ? esc(context.synchronicity) : "—"}</p>`)}
</body></html>`;
  }

  function handleDownload() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildReportHTML());
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  async function handleSubmit() {
    setSubmitting(true);
    if (withdrawScope) {
      await applyWithdrawal(withdrawScope);
      if (withdrawScope === "everything") { onWithdrawn(); return; }
    }
    onSubmit();
  }

  if (loading) return <p className="text-center text-[var(--color-grey)] py-12">Loading your responses…</p>;

  const byBucket = (bucket: BehaviorBucket) => behaviors.filter((b) => b.bucket === bucket);

  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-6 pb-16 space-y-5">
      <ChatBubble readAloud={readAloud}>
        Please take a moment to review everything below, {memberName}. You can change anything before submitting. You can
        also download the information as a report.
      </ChatBubble>

      <button type="button" onClick={handleDownload} className="btn-secondary" style={{ padding: "10px 22px", fontSize: "15px" }}>
        ↓ Download as report
      </button>

      {includeStories && (
        <>
          <Section title="Your stories" onEdit={() => onEditStep("chat")}>
            {stories.length > 0 ? (
              <ul className="space-y-2">
                {stories.map((s) => <li key={s.id} className="text-base leading-relaxed text-[var(--color-ink)]">{s.story_text}</li>)}
              </ul>
            ) : (
              <p className="text-base text-[var(--color-grey)]">No story recorded.</p>
            )}
          </Section>

          {/* Consent check for the stories, directly under the stories box */}
          <Section title={<><strong>Consent Check:</strong> Sharing your stories</>}>
            <ConsentToggle value={storyVerbatim} onChange={(v) => void saveConsent({ phase3_story_verbatim: v })} />
          </Section>

          <Section title="Impact on the team's work" onEdit={() => onEditStep("impact")}>
            <p className="text-base leading-relaxed">{context?.impact_text || <span className="text-[var(--color-grey)]">—</span>}</p>
          </Section>

          <Section title="How often this happens" onEdit={() => onEditStep("frequency")}>
            <p className="text-base">{context?.frequency || <span className="text-[var(--color-grey)]">—</span>}</p>
          </Section>
        </>
      )}

      <Section title="Your behaviours" onEdit={() => onEditStep("board")}>
        <div className="space-y-3">
          {(["always", "sometimes", "never"] as BehaviorBucket[]).map((bucket) => {
            const items = byBucket(bucket);
            if (items.length === 0) return null;
            return (
              <div key={bucket}>
                <p className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: BUCKET_COLOR[bucket] }}>{BUCKET_LABEL[bucket]}</p>
                <ul className="space-y-1">
                  {items.map((b) => <li key={b.id} className="text-base leading-relaxed">· {b.text}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Consent check for the behaviours, directly under the behaviours box */}
      <Section title={<><strong>Consent Check:</strong> Sharing your behaviours</>}>
        <ConsentToggle value={behaviorVerbatim} onChange={(v) => void saveConsent({ phase3_behavior_verbatim: v })} />
      </Section>

      <Section title="30-day commitment" onEdit={() => onEditStep("commit_ask")}>
        <p className="text-base">{context?.commitment || <span className="text-[var(--color-grey)]">—</span>}</p>
        {context?.commitment_result && <p className="text-base text-[var(--color-grey)] mt-1">Expected result: {context.commitment_result}</p>}
      </Section>

      <Section title="Meeting together" onEdit={() => onEditStep("commit_sync")}>
        <p className="text-base">{context?.synchronicity || <span className="text-[var(--color-grey)]">—</span>}</p>
      </Section>

      {/* Withdrawal flow */}
      {withdrawPhase === "confirm" && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <img src="/octopus-logo.png" alt="" className="h-10 w-10 rounded flex-shrink-0 object-cover" />
            <p className="text-base text-red-800">
              Withdrawing removes what you shared from your team&apos;s results. Are you sure you want to choose what to withdraw?
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => setWithdrawPhase("choose")} className="flex-1 py-3 px-6 rounded-full font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
              Yes, I&apos;m sure
            </button>
            <button type="button" onClick={() => setWithdrawPhase("idle")} className="btn-secondary flex-1">Cancel</button>
          </div>
        </div>
      )}

      {withdrawPhase === "choose" && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 space-y-3">
          <p className="text-base font-medium text-red-800">What would you like to withdraw?</p>
          <div className="space-y-2">
            {(["stories", "behaviors", "everything"] as WithdrawScope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPendingScope(s)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 text-base transition-colors ${
                  pendingScope === s ? "border-red-500 bg-red-100 font-medium" : "border-red-200 bg-white hover:border-red-400"
                }`}
              >
                {WITHDRAW_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => { setWithdrawScope(pendingScope); setWithdrawPhase("staged"); }} className="flex-1 py-3 px-6 rounded-full font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
              Confirm this choice
            </button>
            <button type="button" onClick={() => setWithdrawPhase("idle")} className="btn-secondary flex-1">Cancel</button>
          </div>
          <p className="text-sm text-red-700">Nothing is deleted yet — this only takes effect when you finish and submit, and you can undo it.</p>
        </div>
      )}

      {withdrawPhase === "staged" && withdrawScope && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-medium" style={{ color: "#8A5B06" }}>
              Staged to withdraw: {WITHDRAW_LABEL[withdrawScope].toLowerCase()}.
            </p>
            <p className="text-sm text-[var(--color-grey)] mt-0.5">This will only happen when you submit below.</p>
          </div>
          <button
            type="button"
            onClick={() => { setWithdrawScope(null); setWithdrawPhase("idle"); }}
            className="text-sm font-medium text-[var(--color-purple)] underline underline-offset-2 flex-shrink-0"
          >
            Undo
          </button>
        </div>
      )}

      {/* Bottom bar: single withdraw entry (left) + submit (right) */}
      <div className="flex items-center justify-between pt-4 border-t border-black/10">
        {withdrawPhase === "idle" && !withdrawScope ? (
          <button
            type="button"
            onClick={() => setWithdrawPhase("confirm")}
            className="text-sm text-[var(--color-grey)] underline underline-offset-2 hover:text-red-600 transition-colors"
          >
            Withdraw my data
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="btn-primary">
          {submitting ? "Submitting…" : "Finish & Submit"}
        </button>
      </div>
    </div>
  );
}
