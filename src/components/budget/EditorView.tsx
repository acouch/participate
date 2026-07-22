"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import Treemap, { type TreemapDatum } from "@/src/components/Treemap";
import DepartmentList from "@/src/components/budget/DepartmentList";
import OutcomesList from "@/src/components/budget/OutcomesList";
import {
  dollars,
  type EditorDepartment,
  type OutcomeItem,
} from "@/src/lib/budget-format";

interface EditorViewProps {
  uuid: string;
  tagline: string;
  totalToSpend: number;
  totalSpent: number;
  remaining: number;
  help: ReactElement;
  data: TreemapDatum[];
  name: string;
  categoryColor: (category: string) => string;
  onTileClick: (name: string) => void;

  departments: EditorDepartment[];
  visibleDepartments: EditorDepartment[];
  categories: string[];
  allocations: Record<string, number>;
  baseline: Record<string, number>;
  outcomeCountByDept: (name: string) => number;
  listOpen: boolean;
  onToggleList: () => void;
  categoryFilter: string | null;
  onFilterChange: (category: string | null) => void;
  onOpenDept: (name: string) => void;

  outcomes: OutcomeItem[];
  priorByName: Record<string, number>;
  onDeleteOutcome: (id: string) => void;
}

/** The main editor view shown once the welcome flow is complete. */
export default function EditorView({
  uuid,
  tagline,
  totalToSpend,
  totalSpent,
  name,
  remaining,
  help,
  data,
  categoryColor,
  onTileClick,
  departments,
  visibleDepartments,
  categories,
  allocations,
  baseline,
  outcomeCountByDept,
  listOpen,
  onToggleList,
  categoryFilter,
  onFilterChange,
  onOpenDept,
  outcomes,
  priorByName,
  onDeleteOutcome,
}: EditorViewProps) {
  return (
    <div>
      <div className="hero" style={{ marginBottom: "1.5rem" }}>
        <h1>{name}</h1>
        {tagline && (<h2 className="text-2xl text-gray-400 italic py-4">{tagline}</h2>)}
        <p className="lede" style={{ fontSize: "1.2rem"}}>
          You have <strong>{dollars.format(totalToSpend)}</strong> to spend through the General
          Fund.
        </p>
        <p
          className="lede"
          style={{
            fontWeight: 600,
            color:
              remaining < 0 ? "#dc2626" : remaining > 0 ? "#2563eb" : "#16a34a",
          }}
        >
          {remaining === 0
            ? "Balanced — every dollar allocated."
            : remaining > 0
              ? `${dollars.format(remaining)} remaining to allocate.`
              : `${dollars.format(-remaining)} over budget.`}{" "}
          <span style={{ color: "#888", fontWeight: 400 }}>
            (allocated {dollars.format(totalSpent)})
          </span>
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "0.75rem",
        }}
      >
        <Link
          href={`/budget/${uuid}/review`}
          style={{
            padding: "0.55rem 1.1rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            borderRadius: "0.5rem",
            background: "#2563eb",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Review &amp; submit →
        </Link>
      </div>

      <Treemap
        help={help}
        data={data}
        view={"fund"}
        valuePrefix="$"
        categoryColor={categoryColor}
        forceColorMode="change"
        hideKey
        onTileClick={(datum) => onTileClick(datum.name)}
      />

      <DepartmentList
        departments={departments}
        visibleDepartments={visibleDepartments}
        categories={categories}
        allocations={allocations}
        baseline={baseline}
        categoryColor={categoryColor}
        outcomeCountByDept={outcomeCountByDept}
        listOpen={listOpen}
        onToggle={onToggleList}
        categoryFilter={categoryFilter}
        onFilterChange={onFilterChange}
        onOpenDept={onOpenDept}
      />

      <OutcomesList
        outcomes={outcomes}
        departments={departments}
        priorByName={priorByName}
        categoryColor={categoryColor}
        onDelete={onDeleteOutcome}
      />
    </div>
  );
}
