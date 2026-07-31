"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createBrowserClient());

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setMode("signup");
    if (searchParams.get("error") === "auth-callback")
      setErrorMessage("That link has expired. Please try again.");
  }, [searchParams]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setInfoMessage(
          "If that email has an account, you'll receive a password reset link shortly."
        );
      }
      setSubmitting(false);
      return;
    }

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMessage("Incorrect email or password. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push("/");
      return;
    }

    // signup
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match. Please re-enter them.");
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    // When email confirmation is on, Supabase returns success (no error) for
    // duplicate emails but with an empty identities array — it silently sends
    // a magic link to the existing address instead of a confirmation.
    if (data.user?.identities?.length === 0) {
      setErrorMessage(
        "An account with this email already exists. Try signing in, or reset your password."
      );
      setSubmitting(false);
      return;
    }

    setInfoMessage(
      "Check your email for a confirmation link — check your spam folder too."
    );
    setSubmitting(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErrorMessage(null);
    setInfoMessage(null);
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <img
        src="/octopus-logo.png"
        alt=""
        className="h-24 w-auto mx-auto mb-6"
      />

      <h1
        className="text-4xl font-serif mb-3 text-center"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        Hello, I&apos;m <span className="purple">Otis</span>
      </h1>

      <p className="accent text-lg text-center mb-5">
        An AI Specialized in Psychological Safety and Virtual Collaboration.
      </p>

      <p className="text-center text-[var(--color-grey)] max-w-md mb-8 leading-relaxed">
        Remote and hybrid collaborations often suffer from disconnected
        relationships and uncoordinated work. I help teams build Psychological
        Safety — a superpower in working together from anywhere.
      </p>

      <div className="card w-full max-w-sm">
        {mode !== "forgot" && (
          <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] mb-6">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "signin"
                  ? "bg-[var(--color-purple)] text-white"
                  : "text-[var(--color-grey)] hover:text-[var(--color-text)]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-[var(--color-purple)] text-white"
                  : "text-[var(--color-grey)] hover:text-[var(--color-text)]"
              }`}
            >
              Create account
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-sm text-[var(--color-grey)] hover:text-[var(--color-text)] flex items-center gap-1"
            >
              ← Back to sign in
            </button>
            <h2 className="text-lg font-semibold mt-3">Reset your password</h2>
            <p className="text-sm text-[var(--color-grey)] mt-1">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {mode !== "forgot" && (
            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label className="form-label">Confirm password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {mode !== "forgot" && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs text-[var(--color-grey)] underline"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {errorMessage && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}

          {infoMessage && (
            <p className="text-sm text-green-600">{infoMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full mt-6"
          >
            {submitting
              ? mode === "signin"
                ? "Signing in..."
                : mode === "signup"
                  ? "Creating account..."
                  : "Sending link..."
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
}
