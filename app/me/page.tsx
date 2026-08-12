"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PsStatement,
  PsResponse,
  PurposeResponse,
  CoordinationRating,
} from "@/types/database";
import { psColorGroup, PS_LABEL_WORD, type PsColor } from "@/lib/psLabels";
import MemberNav from "@/components/member/MemberNav";

type MeResponse = {
  member: {
    member_id: string;
    display_name: string;
    email: string | null;
    role: string | null;
    status: string;
    share_name_with_team: boolean;
    share_verbatim_with_team: boolean;
  };
  team: { team_id: string; team_name: string } | null;
  phase3_released: boolean;
  phase3_complete: boolean;
  phase4_released: boolean;
  statements: PsStatement[];
  ps_responses: PsResponse[];
  purpose_response: PurposeResponse | null;
  coordination_ratings: CoordinationRating[];
  privacy_acknowledgement: { acknowledged_at: string } | null;
};

const COLOR_VAR: Record<PsColor, string> = {
  red: "var(--color-safety-red)",
  yellow: "var(--color-safety-yellow)",
  green: "var(--color-safety-green)",
};

const FREQUENCY_WORD: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  occasionally: "Occasionally",
  rarely: "Rarely",
};

export default function MemberProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/api/member/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/member-login");
          return;
        }
        if (!res.ok) {
          setLoadError(true);
          return;
        }
        setData(await res.json());
      })
      .catch(() => setLoadError(true));
  }, [router]);

  async function logout() {
    await fetch("/api/member/auth/logout", { method: "POST" });
    router.push("/member-login");
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-[var(--color-grey)]">
          We couldn&apos;t load your profile.{" "}
          <button onClick={() => window.location.reload()} className="underline">
            Try again
          </button>
          .
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-[var(--color-grey)]">Loading your profile…</p>
      </div>
    );
  }

  const { member, team, statements, ps_responses } = data;
  const firstName = member.display_name.split(" ")[0];

  // statement_id → the member's response, for the diagnostic list.
  const responseByStatement = new Map(ps_responses.map((r) => [r.statement_id, r]));

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Team hub — the team name is the H1 below, so only surface "My Teams" here. */}
      <MemberNav showTeamLink={false} />
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-serif"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Hello, {firstName}
          </h1>
          {team && (
            <p className="accent text-lg mt-1">{team.team_name}</p>
          )}
        </div>
        <button onClick={logout} className="text-sm text-[var(--color-grey)] underline">
          Sign out
        </button>
      </div>

      <p className="text-[var(--color-grey)] leading-relaxed">
        This is your private space. Below are the responses you shared in your
        interview. Your team&apos;s report and workshop will appear here when
        they&apos;re ready.
      </p>

      <section className="card border border-[var(--color-purple)]/20 bg-[var(--color-purple)]/5">
        <h2 className="text-xl mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
          Privacy &amp; support
        </h2>
        <p className="text-sm text-[var(--color-grey)] leading-relaxed">
          Review how Otis handles beta participant information, your exact-word and voice-input choices, and how to request withdrawal.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <a href="/privacy" className="underline text-[var(--color-purple)]">Read the privacy notice</a>
          <a href="mailto:contact@wavelength.team?subject=Otis%20member%20support" className="underline text-[var(--color-purple)]">Email Wavelength support</a>
        </div>
      </section>

      {!data.privacy_acknowledgement?.acknowledged_at && (
        <section className="card border border-[var(--color-purple)]/30 bg-[var(--color-purple)]/5">
          <h2 className="text-lg mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
            Read the beta privacy information
          </h2>
          <p className="text-sm text-[var(--color-grey)] leading-relaxed mb-4">
            Before Otis can collect or analyse any further beta information, please review and acknowledge the participant privacy notice.
          </p>
          <a href={`/interview/${member.member_id}`} className="btn-primary inline-block text-center" style={{ padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}>
            Read privacy information
          </a>
        </section>
      )}

      {/* ── Assessment CTA (hidden once complete) ─────────────────────── */}
      {member.status !== "complete" && (
        <section className="card" style={{ padding: "20px 24px" }}>
          <h2 className="text-lg mb-1" style={{ fontFamily: "Playfair Display, serif" }}>
            {member.status === "in_progress"
              ? "Your assessment is in progress"
              : "Start your assessment"}
          </h2>
          <p className="text-sm text-[var(--color-grey)] mb-4 leading-relaxed">
            {member.status === "in_progress"
              ? "Pick up where you left off — your answers so far are saved."
              : "Otis is ready for you. The assessment takes around 20–30 minutes and you can pause and return at any time."}
          </p>
          <a
            href={`/interview/${member.member_id}`}
            className="btn-primary inline-block text-center"
            style={{ padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}
          >
            {member.status === "in_progress" ? "Continue →" : "Begin →"}
          </a>
        </section>
      )}

      {/* ── Your Phase 1 responses ─────────────────────────────────────── */}
      <section className="card space-y-5">
        <h2 className="text-xl" style={{ fontFamily: "Playfair Display, serif" }}>
          Your responses
        </h2>

        {/* Diagnostic ratings */}
        <div className="space-y-3">
          <p className="form-label" style={{ marginBottom: 2 }}>
            How you rated your team
          </p>
          {ps_responses.length === 0 ? (
            <p className="text-sm text-[var(--color-grey)]">
              You haven&apos;t completed the ratings yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {statements.map((s) => {
                const r = responseByStatement.get(s.statement_id);
                if (!r) return null;
                const color = psColorGroup(s, r.label);
                return (
                  <li
                    key={s.statement_id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span
                      aria-hidden
                      style={{
                        marginTop: 5,
                        flex: "0 0 auto",
                        width: 10,
                        height: 10,
                        borderRadius: 9999,
                        background: COLOR_VAR[color],
                      }}
                    />
                    <span className="flex-1">
                      {s.statement_text}
                      <span className="block text-[var(--color-grey)]">
                        Your answer: {PS_LABEL_WORD[r.label]}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Purpose */}
        {data.purpose_response?.purpose_text && (
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>
              Your team&apos;s purpose, in your words
            </p>
            <p className="text-sm text-[var(--color-grey)]">
              {data.purpose_response.purpose_text}
            </p>
          </div>
        )}

        {/* Coordination */}
        {data.coordination_ratings.length > 0 && (
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>
              How often you work with teammates
            </p>
            <ul className="space-y-1 text-sm text-[var(--color-grey)]">
              {data.coordination_ratings.map((c) => (
                <li key={c.id} className="flex justify-between gap-4">
                  <span>{c.target_member_name}</span>
                  <span>{FREQUENCY_WORD[c.frequency] ?? c.frequency}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Phase 3 / workshop (unlocks when consultant releases, locks after completion) ── */}
      {data.phase3_complete ? (
        <section className="card" style={{ padding: "20px 24px" }}>
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="text-green-600">✓</span>
            <h2 className="text-lg" style={{ fontFamily: "Playfair Display, serif" }}>Results &amp; Team Agreement Activity</h2>
          </div>
          <p className="text-sm text-[var(--color-grey)] leading-relaxed">
            You&apos;ve completed this activity. Your consultant will be in touch with the next steps.
          </p>
        </section>
      ) : data.phase3_released ? (
        <section className="card" style={{ padding: "20px 24px" }}>
          <h2 className="text-lg mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
            Results &amp; Team Agreement Activity
          </h2>
          <p className="text-sm text-[var(--color-grey)] mb-4 leading-relaxed">
            Your consultant has released this activity. Otis wants to hear a short story from
            you before the session — it takes around 10 minutes.
          </p>
          <a
            href="/me/phase3"
            className="btn-primary inline-block text-center"
            style={{ padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}
          >
            Start my activity →
          </a>
        </section>
      ) : (
        <LockedSection
          title="Results &amp; Team Agreement Activity"
          body="Available once your consultant releases it. You'll do a short activity with Otis here."
        />
      )}
      <LockedSection
        title="Workshop room"
        body="Opens when your facilitator starts your live session."
      />
      {/* ── Team results (unlocks when consultant releases Phase 4) ────── */}
      {data.phase4_released ? (
        <section className="card" style={{ padding: "20px 24px" }}>
          <h2 className="text-lg mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
            Your team&apos;s results
          </h2>
          <p className="text-sm text-[var(--color-grey)] mb-4 leading-relaxed">
            Otis has drawn up your Team Behaviour Agreement and a 30-day game plan. Your agreement,
            what to do next, and your guides are all here.
          </p>
          <a
            href="/me/results"
            className="btn-primary inline-block text-center"
            style={{ padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}
          >
            View my team&apos;s results →
          </a>
        </section>
      ) : (
        <LockedSection
          title="Your Team Agreement"
          body="Appears here once your consultant releases your team's results, so you can always come back to it."
        />
      )}
    </div>
  );
}

function LockedSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="card" style={{ opacity: 0.7 }}>
      <div className="flex items-center gap-2">
        <span aria-hidden>🔒</span>
        <h2 className="text-lg" style={{ fontFamily: "Playfair Display, serif" }}>
          {title}
        </h2>
      </div>
      <p className="text-sm text-[var(--color-grey)] mt-1">{body}</p>
    </section>
  );
}
