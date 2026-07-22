"use client";

import NextButton from "@/src/components/budget/NextButton";
import { dollars } from "@/src/lib/budget-format";

interface NameStepProps {
  totalToSpend: number;
  nameDraft: string;
  onNameDraftChange: (value: string) => void;
  onSubmit: () => void;
}

/** Welcome step 1: introduce the tool and collect the mayoral / project name. */
export default function NameStep({
  totalToSpend,
  nameDraft,
  onNameDraftChange,
  onSubmit,
}: NameStepProps) {
  return (
    <>
      <h1>Welcome</h1>
      <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
        This is your chance to propose Philly&rsquo;s budget. This tool
        imagines you have the power of the mayor to propose how Philly will
        spend the General Fund, the discretionary part of Philly&rsquo;s money.
      </p>
      <p
        className="lede"
        style={{
          fontSize: "1rem",
          lineHeight: 1.6,
          marginTop: "0.75rem",
        }}
      >
        You have <strong>{dollars.format(totalToSpend)}</strong> for fiscal
        year 2027, which started July 1, 2026.
      </p>

      <label
        htmlFor="mayoral-name"
        style={{
          display: "block",
          fontWeight: 600,
          fontSize: "0.9rem",
          margin: "1.5rem 0 0.4rem",
        }}
      >
        What is your mayoral or project name?
      </label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          id="mayoral-name"
          type="text"
          value={nameDraft}
          autoFocus
          placeholder="e.g. Mayor Smith's Plan"
          onChange={(e) => onNameDraftChange(e.target.value)}
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
        <NextButton onClick={onSubmit} enabled={Boolean(nameDraft.trim())} />
      </div>
    </>
  );
}
