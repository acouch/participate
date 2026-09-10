"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/src/lib/auth-client";
import { safeNextPath } from "@/src/lib/next-path";
import {
  buttonStyle,
  errorStyle,
  inputStyle,
  labelStyle,
} from "@/src/components/auth/form-styles";

/** Signs an existing user in with email and password. */
export default function SignInForm() {
  const router = useRouter();
  // Set by the save-progress prompt so people land back on their budget.
  const next = safeNextPath(useSearchParams().get("next") ?? undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = email.trim() !== "" && password !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !ready) return;
    setSubmitting(true);
    setError(null);

    const { error } = await signIn.email({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message ?? "Could not sign you in.");
      setSubmitting(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="signin-email" style={labelStyle}>
        Email
      </label>
      <input
        id="signin-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
        required
      />

      <label htmlFor="signin-password" style={labelStyle}>
        Password
      </label>
      <input
        id="signin-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
        required
      />

      {error && <p style={errorStyle}>{error}</p>}

      <button
        type="submit"
        disabled={!ready || submitting}
        style={buttonStyle(ready && !submitting)}
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <p
        style={{ fontSize: "0.85rem", marginTop: "1rem", textAlign: "center" }}
      >
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
      <p
        style={{
          fontSize: "0.85rem",
          marginTop: "0.5rem",
          textAlign: "center",
        }}
      >
        No account?{" "}
        <Link href={`/sign-up?next=${encodeURIComponent(next)}`}>
          Create one
        </Link>
      </p>
    </form>
  );
}
