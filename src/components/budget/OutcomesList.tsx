"use client";

import type { EditorDepartment, OutcomeItem } from "@/src/lib/budget-format";

interface OutcomesListProps {
  outcomes: OutcomeItem[];
  departments: EditorDepartment[];
  priorByName: Record<string, number>;
  categoryColor: (category: string) => string;
  onDelete: (id: string) => void;
}

/** The standalone "Your outcomes" section shown below the list. */
export default function OutcomesList({
  outcomes,
  departments,
  priorByName,
  categoryColor,
  onDelete,
}: OutcomesListProps) {
  if (outcomes.length === 0) return null;

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>Your outcomes</h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: "0.5rem",
        }}
      >
        {outcomes.map((o) => (
          <li
            key={o.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.625rem 0.75rem",
              border: "1px solid #eee",
              borderRadius: "0.375rem",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                marginTop: 4,
                background: categoryColor(
                  priorByName[o.department] !== undefined
                    ? departments.find((d) => d.name === o.department)
                        ?.category ?? ""
                    : "",
                ),
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                {o.department}
              </span>
              <span
                style={{
                  display: "block",
                  color: "#444",
                  fontSize: "0.85rem",
                  marginTop: "0.15rem",
                }}
              >
                {o.description}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onDelete(o.id)}
              aria-label={`Delete outcome for ${o.department}`}
              style={{
                border: "none",
                background: "none",
                color: "#999",
                cursor: "pointer",
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
