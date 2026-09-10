"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/src/lib/auth-client";
import { safeNextPath } from "@/src/lib/next-path";
import {
  buttonStyle,
  errorStyle,
  inputStyle,
  labelStyle,
} from "@/src/components/auth/form-styles";

/** Creates an account with name, email and password, then signs the user in. */
export default function SignUpForm() {
  const router = useRouter();
  // Set by the save-progress prompt so people land back on their budget.
  const next = safeNextPath(useSearchParams().get("next") ?? undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "" && email.trim() !== "" && password !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !ready) return;
    setSubmitting(true);
    setError(null);

    const { error } = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message ?? "Could not create your account.");
      setSubmitting(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="signup-name" style={labelStyle}>
        Name
      </label>
      <input
        id="signup-name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
        required
      />

      <label htmlFor="signup-email" style={labelStyle}>
        Email
      </label>
      <input
        id="signup-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
        required
      />

      <label htmlFor="signup-password" style={labelStyle}>
        Password
      </label>
      <input
        id="signup-password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
        required
      />
      <p style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.35rem" }}>
        At least 8 characters.
      </p>

      {error && <p style={errorStyle}>{error}</p>}

      <button
        type="submit"
        disabled={!ready || submitting}
        style={buttonStyle(ready && !submitting)}
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p
        style={{ fontSize: "0.85rem", marginTop: "1rem", textAlign: "center" }}
      >
        Already have an account?{" "}
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </form>
  );
}
