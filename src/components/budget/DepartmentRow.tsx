"use client";

import { dollars, signedPct, pctTextColor } from "@/src/lib/budget-format";

interface DepartmentRowProps {
  name: string;
  category: string;
  color: string;
  value: number;
  pct: number | null;
  zebra: boolean;
  outcomeCount: number;
  onOpen: () => void;
}

/** A department row: clicking anywhere opens the edit dialog. */
export default function DepartmentRow({
  name,
  category,
  color,
  value,
  pct,
  zebra,
  outcomeCount,
  onOpen,
}: DepartmentRowProps) {
  return (
    <li style={{ borderTop: "1px solid #f0f0f0" }}>
      <button
        type="button"
        onClick={onOpen}
        title={`Edit ${name}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%",
          padding: "0.6rem 0.75rem",
          background: zebra ? "#fafafa" : "#fff",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{name}</span>
          <span
            style={{ color: "#999", fontSize: "0.75rem", marginLeft: "0.5rem" }}
          >
            {category}
          </span>
          {outcomeCount > 0 && (
            <span
              title={`${outcomeCount} outcome${outcomeCount === 1 ? "" : "s"}`}
              style={{
                marginLeft: "0.5rem",
                padding: "0.05rem 0.4rem",
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "#2563eb",
                background: "#eff6ff",
                borderRadius: "999px",
                verticalAlign: "middle",
              }}
            >
              {outcomeCount} outcome{outcomeCount === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <span
          style={{
            width: "4.5rem",
            textAlign: "right",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: pctTextColor(pct),
          }}
        >
          {pct == null ? "—" : signedPct(pct)}
        </span>
        <span
          style={{
            width: "9rem",
            textAlign: "right",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {dollars.format(value)}
        </span>
      </button>
    </li>
  );
}
