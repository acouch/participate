"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/src/app/feedback/actions";

type Status = "idle" | "sending" | "sent" | "error";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  fontSize: "0.9rem",
  border: "1px solid #d4d4d4",
  borderRadius: "0.5rem",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: "0.8rem",
  margin: "0.85rem 0 0.35rem",
};

/**
 * A floating "Feedback" button that opens a modal form letting users share
 * their experience and flag anything confusing. Name and email are optional;
 * feedback text is required. Submissions are stored via a server action.
 */
export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setMessage("");
    setStatus("idle");
    setError(null);
  }

  function close() {
    setOpen(false);
    // Give the closing transition a moment before clearing state.
    setTimeout(reset, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    const result = await submitFeedback({
      name,
      email,
      message,
      path: pathname,
    });
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="no-print"
          style={{
            position: "fixed",
            right: "1.25rem",
            bottom: "1.25rem",
            zIndex: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.6rem 1rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "#fff",
            background: "var(--color-blue-800)",
            border: "none",
            borderRadius: "999px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            cursor: "pointer",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            />
          </svg>
          Feedback
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "1.25rem",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "24rem",
              background: "#fff",
              borderRadius: "0.75rem",
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
              padding: "1.25rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <h2 id="feedback-title" style={{ fontSize: "1.1rem" }}>
                Share your feedback
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close feedback form"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.4rem",
                  lineHeight: 1,
                  color: "#888",
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>

            {status === "sent" ? (
              <div style={{ padding: "1rem 0" }}>
                <p style={{ fontSize: "0.95rem", color: "#111" }}>
                  Thanks for your feedback! We appreciate you taking the time.
                </p>
                <button
                  type="button"
                  onClick={close}
                  style={{
                    marginTop: "1rem",
                    padding: "0.55rem 1rem",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#fff",
                    background: "#1d4ed8",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p
                  className="lede"
                  style={{ marginTop: "0.35rem", marginBottom: "0.25rem" }}
                >
                  Tell us about your experience, or let us know if anything was
                  confusing.
                </p>

                <label htmlFor="feedback-name" style={labelStyle}>
                  Name <span style={{ color: "#888", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                />

                <label htmlFor="feedback-email" style={labelStyle}>
                  Email <span style={{ color: "#888", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />

                <label htmlFor="feedback-message" style={labelStyle}>
                  Feedback
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  autoFocus
                  placeholder="What's on your mind?"
                  style={{ ...inputStyle, resize: "vertical" }}
                />

                {error && (
                  <p
                    role="alert"
                    style={{
                      margin: "0.6rem 0 0",
                      fontSize: "0.8rem",
                      color: "#b91c1c",
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending" || !message.trim()}
                  style={{
                    marginTop: "1rem",
                    width: "100%",
                    padding: "0.6rem 1rem",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#fff",
                    background:
                      status === "sending" || !message.trim()
                        ? "#93b0f0"
                        : "#1d4ed8",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor:
                      status === "sending" || !message.trim()
                        ? "default"
                        : "pointer",
                  }}
                >
                  {status === "sending" ? "Sending…" : "Send feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
