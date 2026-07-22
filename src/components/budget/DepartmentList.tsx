"use client";

import DepartmentRow from "@/src/components/budget/DepartmentRow";
import {
  categoryChipStyle,
  type EditorDepartment,
} from "@/src/lib/budget-format";

interface DepartmentListProps {
  departments: EditorDepartment[];
  visibleDepartments: EditorDepartment[];
  categories: string[];
  allocations: Record<string, number>;
  baseline: Record<string, number>;
  categoryColor: (category: string) => string;
  outcomeCountByDept: (name: string) => number;
  listOpen: boolean;
  onToggle: () => void;
  categoryFilter: string | null;
  onFilterChange: (category: string | null) => void;
  onOpenDept: (name: string) => void;
}

/** Collapsible "All departments" accordion: category key + editable rows. */
export default function DepartmentList({
  departments,
  visibleDepartments,
  categories,
  allocations,
  baseline,
  categoryColor,
  outcomeCountByDept,
  listOpen,
  onToggle,
  categoryFilter,
  onFilterChange,
  onOpenDept,
}: DepartmentListProps) {
  return (
    <section style={{ marginTop: "2rem" }}>
      {/* The whole section is an accordion, closed by default. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={listOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          padding: "0.5rem 0",
          background: "none",
          border: "none",
          borderBottom: "1px solid #e5e5e5",
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden
          style={{
            transform: listOpen ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
            color: "#999",
            fontSize: "0.8rem",
          }}
        >
          ▶
        </span>
        <span style={{ fontSize: "1rem", fontWeight: 600 }}>
          All departments
        </span>
        <span style={{ color: "#999", fontSize: "0.8rem" }}>
          ({departments.length})
        </span>
      </button>

      {listOpen && (
        <div style={{ marginTop: "0.75rem" }}>
          {/* Category key — click to filter the list (chart is unaffected). */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
              marginBottom: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => onFilterChange(null)}
              aria-pressed={categoryFilter === null}
              style={categoryChipStyle(categoryFilter === null)}
            >
              All ({departments.length})
            </button>
            {categories.map((cat) => {
              const count = departments.filter(
                (d) => d.category === cat,
              ).length;
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onFilterChange(active ? null : cat)}
                  aria-pressed={active}
                  style={categoryChipStyle(active)}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: categoryColor(cat),
                      display: "inline-block",
                      marginRight: "0.4rem",
                      verticalAlign: "middle",
                    }}
                  />
                  {cat} ({count})
                </button>
              );
            })}
          </div>

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
            {visibleDepartments.map((d, i) => {
              const value = allocations[d.name] ?? baseline[d.name];
              const pct =
                d.priorAmount > 0
                  ? ((value - d.priorAmount) / d.priorAmount) * 100
                  : null;
              return (
                <DepartmentRow
                  key={d.name}
                  name={d.name}
                  category={d.category}
                  color={categoryColor(d.category)}
                  value={value}
                  pct={pct}
                  zebra={i % 2 === 1}
                  outcomeCount={outcomeCountByDept(d.name)}
                  onOpen={() => onOpenDept(d.name)}
                />
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
