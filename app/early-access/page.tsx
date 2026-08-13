"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AccessState = "loading" | "signed_out" | "locked" | "granted";

export default function EarlyAccessPage() {
  const router = useRouter();
  const [state, setState] = useState<AccessState>("loading");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/early-access", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (response.status === 401) {
        setState("signed_out");
        return;
      }
      if (!response.ok) {
        setState("locked");
        setMessage(data.error ?? "Unable to check early-access status. Please try again.");
        return;
      }
      setState(data.early_access ? "granted" : "locked");
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  async function redeem(submittedCode: string) {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: submittedCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "Unable to grant early access. Please try again.");
        return;
      }
      setState("granted");
      setCode("");
      setMessage("Early access granted.");
    } catch {
      setMessage("Unable to grant early access. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) {
      setMessage("Enter your early-access code.");
      return;
    }
    void redeem(code);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <section className="card w-full max-w-xl" style={{ padding: "36px 32px" }}>
        <p className="text-xs uppercase tracking-widest text-[var(--color-purple)] mb-3">Wavelength beta</p>
        <h1 className="text-3xl mb-3" style={{ fontFamily: "Playfair Display, serif" }}>Early access</h1>

        {state === "loading" && <p className="text-sm text-[var(--color-grey)]">Checking your access…</p>}

        {state === "signed_out" && (
          <>
            <p className="text-sm leading-relaxed text-[var(--color-grey)] mb-6">
              Sign in to your consultant account first, then enter your early-access code.
            </p>
            <Link href="/login?next=%2Fearly-access" className="btn-primary inline-block">Sign in</Link>
          </>
        )}

        {state === "locked" && (
          <>
            <p className="text-sm leading-relaxed text-[var(--color-grey)] mb-6">
              Your account can still set up teams, invite participants, collect assessments, and view the standard results. An early-access code unlocks the Results &amp; Team Agreement Activity release, Team Agreement, and facilitated workshop.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="early-access-code" className="form-label">Early-access code</label>
                <input
                  id="early-access-code"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="form-input"
                  disabled={submitting}
                />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Checking…" : "Unlock early access"}
              </button>
            </form>
            <p className="text-sm text-[var(--color-grey)] mt-5">
              Need access? <a className="text-[var(--color-purple)] underline" href="mailto:contact@wavelength.team?subject=Early%20access%20for%20Otis">Contact Wavelength</a>.
            </p>
          </>
        )}

        {state === "granted" && (
          <>
            <p className="text-sm leading-relaxed text-[var(--color-grey)] mb-6">
              Your consultant account has early access. You can now release the Results &amp; Team Agreement Activity, generate and release a Team Agreement, and use the facilitated workshop.
            </p>
            <Link href="/" className="btn-primary inline-block">Go to my teams</Link>
          </>
        )}

        {message && <p className={`text-sm mt-5 ${state === "granted" ? "text-green-700" : "text-red-600"}`}>{message}</p>}

        {state !== "signed_out" && state !== "loading" && (
          <button type="button" onClick={() => router.push("/")} className="text-sm text-[var(--color-grey)] hover:text-[var(--color-ink)] mt-6 underline">
            Back to my teams
          </button>
        )}
      </section>
    </main>
  );
}
