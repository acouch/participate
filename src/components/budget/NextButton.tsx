"use client";

interface NextButtonProps {
  onClick: () => void;
  enabled: boolean;
}

/** The shared "Next" button used throughout the welcome flow. */
export default function NextButton({ onClick, enabled }: NextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      style={{
        padding: "0.6rem 1.25rem",
        fontSize: "1rem",
        fontWeight: 600,
        border: "none",
        borderRadius: "0.5rem",
        background: "#1a3cb9",
        color: "#fff",
        cursor: enabled ? "pointer" : "not-allowed",
        opacity: enabled ? 1 : 0.5,
      }}
    >
      Next
    </button>
  );
}
