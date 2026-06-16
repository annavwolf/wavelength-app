"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(
          "Something went wrong. Check your email and password."
        );
        setSubmitting(false);
        return;
      }

      router.push("/");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Something went wrong. Check your email and password.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setErrorMessage("Something went wrong. Check your email and password.");
      setSubmitting(false);
      return;
    }

    setInfoMessage("Check your email to confirm your account.");
    setSubmitting(false);
  }

  function toggleMode() {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setErrorMessage(null);
    setInfoMessage(null);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <img
        src="/logo-octopus.png"
        alt=""
        className="h-20 w-auto mx-auto mb-8"
      />

      <h1
        className="text-4xl font-serif mb-2 text-center"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        Hello, I&apos;m <span className="purple">Wavelength.</span>
      </h1>

      <p className="accent text-lg text-center mb-8">
        Sign in to continue with your teams.
      </p>

      <div className="card w-full max-w-sm">
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

          {errorMessage && (
            <p className="text-sm text-[var(--color-grey)]">
              {errorMessage}
            </p>
          )}

          {infoMessage && (
            <p className="text-sm text-[var(--color-grey)]">{infoMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full mt-6"
          >
            {submitting
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={toggleMode}
          className="mt-6 text-sm text-[var(--color-grey)] underline w-full text-center"
        >
          {mode === "signin"
            ? "First time? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
