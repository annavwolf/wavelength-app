"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    router.push("/");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <img
        src="/octopus-logo.png"
        alt=""
        className="h-24 w-auto mx-auto mb-6"
      />

      <div className="card w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-2">Set a new password</h2>
        <p className="text-sm text-[var(--color-grey)] mb-6">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Confirm new password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full mt-6"
          >
            {submitting ? "Saving..." : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
