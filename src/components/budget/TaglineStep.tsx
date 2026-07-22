"use client";

import NextButton from "@/src/components/budget/NextButton";

interface TaglineStepProps {
  name: string;
  taglineDraft: string;
  onTaglineDraftChange: (value: string) => void;
  onSubmit: () => void;
}

/** Welcome step 2: collect the budget's tagline / what it delivers. */
export default function TaglineStep({
  name,
  taglineDraft,
  onTaglineDraftChange,
  onSubmit,
}: TaglineStepProps) {
  return (
    <>
      <h1>{name}</h1>
      <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
        Philly&rsquo;s budget is a moral document, a fiscal opus, a call to
        arms, and a promise to our future selves.
      </p>

      <label
        htmlFor="budget-tagline"
        style={{
          display: "block",
          fontWeight: 600,
          fontSize: "0.9rem",
          margin: "1.5rem 0 0.4rem",
        }}
      >
        What does your budget deliver?
      </label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          id="budget-tagline"
          type="text"
          value={taglineDraft}
          autoFocus
          placeholder="e.g. Clean & Green"
          onChange={(e) => onTaglineDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          style={{
            flex: 1,
            padding: "0.6rem 0.75rem",
            fontSize: "1rem",
            border: "1px solid #d4d4d4",
            borderRadius: "0.5rem",
          }}
        />
        <NextButton onClick={onSubmit} enabled={Boolean(taglineDraft.trim())} />
      </div>
      <p
        style={{
          fontSize: "0.8rem",
          color: "#888",
          lineHeight: 1.6,
          marginTop: "0.75rem",
        }}
      >
        Parker had &ldquo;Clean &amp; Green&rdquo; and &ldquo;One Philly,&rdquo;
        Roosevelt had &ldquo;A chicken in every pot and prosperity,&rdquo; Rizzo
        had &ldquo;I&rsquo;m an awful person.&rdquo;
      </p>
    </>
  );
}
