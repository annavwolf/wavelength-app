"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PsStatement,
  PsResponse,
  PsInterviewResponse,
  PurposeResponse,
  CoordinationRating,
} from "@/types/database";
import { psColorGroup, PS_LABEL_WORD, type PsColor } from "@/lib/psLabels";

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
  statements: PsStatement[];
  ps_responses: PsResponse[];
  interview_responses: PsInterviewResponse[];
  purpose_response: PurposeResponse | null;
  coordination_ratings: CoordinationRating[];
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

  const { member, team, statements, ps_responses, interview_responses } = data;
  const firstName = member.display_name.split(" ")[0];

  // statement_id → the member's response, for the diagnostic list.
  const responseByStatement = new Map(ps_responses.map((r) => [r.statement_id, r]));
  const probedStatements = new Map(statements.map((s) => [s.statement_id, s]));

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
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

        {/* Interview stories */}
        {interview_responses.length > 0 && (
          <div className="space-y-4">
            <p className="form-label" style={{ marginBottom: 2 }}>
              What you shared
            </p>
            {interview_responses.map((iv) => {
              const s = probedStatements.get(iv.statement_id);
              return (
                <div
                  key={iv.id}
                  className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.5)" }}
                >
                  {s && (
                    <p className="text-sm font-medium mb-2">{s.statement_text}</p>
                  )}
                  <dl className="space-y-2 text-sm text-[var(--color-grey)]">
                    {iv.situation_text && (
                      <StoryRow label="The situation" value={iv.situation_text} />
                    )}
                    {iv.out_behavior_text && (
                      <StoryRow label="What people did" value={iv.out_behavior_text} />
                    )}
                    {iv.outcome_text && (
                      <StoryRow label="The effect" value={iv.outcome_text} />
                    )}
                    {iv.in_behavior_text && (
                      <StoryRow
                        label="What could be different"
                        value={iv.in_behavior_text}
                      />
                    )}
                  </dl>
                </div>
              );
            })}
          </div>
        )}

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

      {/* ── Coming soon (Phases 3 & 4) ─────────────────────────────────── */}
      <LockedSection
        title="Your team report"
        body="Available once your consultant releases it. You'll do a short pre-workshop activity here."
      />
      <LockedSection
        title="Workshop room"
        body="Opens when your facilitator starts your live session."
      />
      <LockedSection
        title="Your Team Agreement"
        body="Appears here after your workshop, so you can always come back to it."
      />
    </div>
  );
}

function StoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-[var(--color-ink)]">{value}</dd>
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
