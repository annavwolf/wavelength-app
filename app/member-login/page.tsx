"use client";

import { useState, useEffect, type FormEvent } from "react";

const ERROR_COPY: Record<string, string> = {
  missing: "That sign-in link was incomplete. Please request a new one below.",
  invalid: "That sign-in link isn't valid. Please request a new one below.",
  used: "That sign-in link has already been used. Please request a new one below.",
  expired: "That sign-in link has expired. Please request a new one below.",
  nomember: "We couldn't find your team membership. Please contact your consultant.",
  server: "Something went wrong signing you in. Please try again.",
};

export default function MemberLoginPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Read a ?error=… left by the verify redirect (avoids needing a Suspense
  // boundary around useSearchParams during the static build).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setLinkError(ERROR_COPY[code] ?? ERROR_COPY.server);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setLinkError(null);
    try {
      await fetch("/api/member/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show the same confirmation, regardless of whether the email
      // matched a member (no membership enumeration).
      setSent(true);
    } catch {
      setLinkError(ERROR_COPY.server);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <img src="/octopus-logo.png" alt="" className="h-24 w-auto mx-auto mb-6" />

      <h1
        className="text-4xl font-serif mb-3 text-center"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        Welcome back to <span className="purple">Otis</span>
      </h1>

      <p className="accent text-lg text-center mb-8">
        Sign in to your team member profile.
      </p>

      <div className="card w-full max-w-sm">
        {sent ? (
          <div className="space-y-3 text-center">
            <p className="text-lg" style={{ fontFamily: "Playfair Display, serif" }}>
              Check your email
            </p>
            <p className="text-sm text-[var(--color-grey)] leading-relaxed">
              If <strong>{email}</strong> is on a team, we&apos;ve sent a secure
              sign-in link. It expires in 30 minutes.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-[var(--color-grey)] underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-[var(--color-grey)] leading-relaxed mb-2">
              Enter the email your consultant used to invite you. We&apos;ll send
              you a secure link — no password needed.
            </p>

            {linkError && (
              <p className="text-sm text-[var(--color-safety-red)]">{linkError}</p>
            )}

            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-6"
            >
              {submitting ? "Sending link..." : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
