"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import {
  buttonStyle,
  errorStyle,
  inputStyle,
  labelStyle,
} from "@/src/components/auth/form-styles";

/**
 * Sets a new password using the token from the emailed reset link.
 * Better Auth redirects here with either ?token=... or ?error=INVALID_TOKEN.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const tokenError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = password !== "" && confirm !== "";

  if (!token || tokenError) {
    return (
      <>
        <p style={errorStyle}>This reset link is invalid or has expired.</p>
        <p
          style={{
            fontSize: "0.85rem",
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !ready) return;
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });

    if (error) {
      setError(error.message ?? "Could not reset your password.");
      setSubmitting(false);
      return;
    }
    router.push("/sign-in?reset=1");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="reset-password" style={labelStyle}>
        New password
      </label>
      <input
        id="reset-password"
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

      <label htmlFor="reset-confirm" style={labelStyle}>
        Confirm new password
      </label>
      <input
        id="reset-confirm"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        style={inputStyle}
        required
      />

      {error && <p style={errorStyle}>{error}</p>}

      <button
        type="submit"
        disabled={!ready || submitting}
        style={buttonStyle(ready && !submitting)}
      >
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
