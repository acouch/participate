"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

const DISMISS_KEY = "hide-save-progress-prompt";

/** Notifies subscribers when this browser dismisses the prompt. */
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Private mode or blocked storage — show the prompt rather than fail.
    return false;
  }
}

/**
 * Shown on the editor to signed-out users: their budget lives at this URL, and
 * making an account keeps it reachable without saving the link. Dismissal is
 * remembered per browser so it doesn't nag on every edit.
 */
export default function SaveProgressPrompt({ uuid }: { uuid: string }) {
  // Server renders nothing; the client shows it unless previously dismissed.
  const show = useSyncExternalStore(
    subscribe,
    () => !isDismissed(),
    () => false,
  );

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Not remembering the dismissal is fine.
    }
    listeners.forEach((fn) => fn());
  }, []);

  if (!show) return null;

  // Bring people back to this budget after they authenticate.
  const next = encodeURIComponent(`/budget/${uuid}/edit`);

  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "1rem",
        margin: "0 0 1.5rem",
        padding: "0.85rem 1rem",
        borderRadius: "0.5rem",
        border: "1px solid #c7d2f0",
        background: "#eef2fb",
      }}
    >
      <div style={{ flex: 1, fontSize: "0.9rem", lineHeight: 1.5 }}>
        <strong>Save your progress.</strong> Your budget is saved at this link,
        so bookmark it to come back.{" "}
        <Link href={`/sign-up?next=${next}`} style={{ fontWeight: 600 }}>
          Create an account
        </Link>{" "}
        to keep it with you, or{" "}
        <Link href={`/sign-in?next=${next}`} style={{ fontWeight: 600 }}>
          sign in
        </Link>
        .
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          padding: "0 0.25rem",
          fontSize: "1.1rem",
          lineHeight: 1,
          color: "#5b6b8c",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
