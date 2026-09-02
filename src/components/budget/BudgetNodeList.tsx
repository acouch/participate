"use client";

import type { TreemapDatum } from "@/src/components/Treemap";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const signedPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

const pctTextColor = (pct: number | null | undefined) =>
  pct == null ? "#666" : pct > 0 ? "#16a34a" : pct < 0 ? "#dc2626" : "#666";

interface BudgetNodeListProps {
  /** The nodes currently shown in the treemap (the active drill level). */
  nodes: TreemapDatum[];
  /** Label for the level, e.g. "funds", "departments", "categories". */
  noun: string;
  /** Resolves a fill color for a node (matches the treemap tiles). */
  colorFor: (node: TreemapDatum) => string;
  /** Clicking a node drills into it (only if it has children). */
  onSelect: (node: TreemapDatum) => void;
}

/**
 * A read-only list mirroring the treemap's current level: one row per visible
 * node, sorted by value (largest first), matching the tiles above.
 */
export default function BudgetNodeList({
  nodes,
  noun,
  colorFor,
  onSelect,
}: BudgetNodeListProps) {
  if (nodes.length === 0) return null;

  const sorted = [...nodes].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <section style={{ marginTop: "2rem", textAlign: "left" }}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
        {sorted.length} {noun}
      </h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          border: "1px solid #e5e5e5",
          borderRadius: "0.5rem",
          overflow: "hidden",
        }}
      >
        {sorted.map((node, i) => {
          const drillable = Boolean(node.children && node.children.length > 0);
          const pct = node.percentChange;
          const row = (
            <>
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: colorFor(node),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                {node.name}
              </span>
              <span
                style={{
                  width: "5rem",
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
                {dollars.format(node.value ?? 0)}
              </span>
            </>
          );

          const baseStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            width: "100%",
            padding: "0.6rem 0.75rem",
            background: i % 2 === 1 ? "#fafafa" : "#fff",
            textAlign: "left",
            font: "inherit",
          };

          return (
            <li
              key={node.name}
              style={{ borderTop: i === 0 ? "none" : "1px solid #f0f0f0" }}
            >
              {drillable ? (
                <button
                  type="button"
                  onClick={() => onSelect(node)}
                  title={`Explore ${node.name}`}
                  style={{ ...baseStyle, border: "none", cursor: "pointer" }}
                >
                  {row}
                </button>
              ) : (
                <div style={baseStyle}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
