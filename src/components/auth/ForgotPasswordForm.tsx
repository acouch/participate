"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/src/lib/auth-client";
import {
  buttonStyle,
  errorStyle,
  inputStyle,
  labelStyle,
  noticeStyle,
} from "@/src/components/auth/form-styles";

/** Requests a password reset link, delivered by email. */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = email.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !ready) return;
    setSubmitting(true);
    setError(null);

    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });

    setSubmitting(false);
    // Report success either way — revealing which emails have accounts would
    // let anyone enumerate our users.
    if (error && error.status !== 404) {
      setError(error.message ?? "Could not send the reset email.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <>
        <p style={noticeStyle}>
          If an account exists for that email, a reset link is on its way. The
          link expires in one hour.
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: "0.9rem", color: "#444" }}>
        Enter your email and we&rsquo;ll send you a link to set a new password.
      </p>

      <label htmlFor="forgot-email" style={labelStyle}>
        Email
      </label>
      <input
        id="forgot-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
        required
      />

      {error && <p style={errorStyle}>{error}</p>}

      <button
        type="submit"
        disabled={!ready || submitting}
        style={buttonStyle(ready && !submitting)}
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>

      <p
        style={{ fontSize: "0.85rem", marginTop: "1rem", textAlign: "center" }}
      >
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
