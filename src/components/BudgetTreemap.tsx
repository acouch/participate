"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Treemap, { type TreemapDatum } from "@/src/components/Treemap";
import { ordinalColorScale } from "@/src/lib/colors";
import type { BudgetView } from "@/src/lib/budget";

// Fallback category for departments not tagged in tagging.yml (mirrors
// DEFAULT_CATEGORY in budget.ts, kept here to avoid importing the server-only
// budget module into this client component).
const DEFAULT_CATEGORY = "Government Operations";

interface BudgetTreemapProps {
  category: TreemapDatum[];
  fund: TreemapDatum[];
}

const TABS: { key: BudgetView; label: string }[] = [
  { key: "category", label: "By category" },
  { key: "fund", label: "By fund" },
];

const isView = (v: string | null): v is BudgetView =>
  v === "category" || v === "fund";

export default function BudgetTreemap({
  category,
  fund,
}: BudgetTreemapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the source of truth: ?view= selects the dataset (default
  // "category") and ?path= holds the drill-down path (slash-separated names).
  const param = searchParams.get("view");
  const view: BudgetView = isView(param) ? param : "category";
  const data = view === "category" ? category : fund;

  // A stable color per People's Budget category, derived from the top-level
  // category dataset so a category keeps the same color across both views
  // (e.g. departments inside a fund match their category tile's color).
  const categoryColor = useMemo(() => {
    const names = category.map((d) => d.name);
    if (!names.includes(DEFAULT_CATEGORY)) names.push(DEFAULT_CATEGORY);
    return ordinalColorScale(names);
  }, [category]);

  const drillPath = (searchParams.get("path") ?? "")
    .split("/")
    .map(decodeURIComponent)
    .filter(Boolean);

  const selectView = (next: BudgetView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    // A path from one dataset is meaningless in the other, so reset it.
    params.delete("path");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setDrillPath = (next: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) {
      params.set("path", next.map(encodeURIComponent).join("/"));
    } else {
      params.delete("path");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Budget grouping"
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid #e5e5e5",
          marginBottom: "1rem",
        }}
      >
        {TABS.map((tab) => {
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => selectView(tab.key)}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: active ? "#111" : "#888",
                borderBottom: active
                  ? "2px solid #2563eb"
                  : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <Treemap
        key={view}
        data={data}
        valuePrefix="$"
        path={drillPath}
        onPathChange={setDrillPath}
        categoryColor={categoryColor}
        colorByCategoryFromDepth={view === "fund" ? 1 : undefined}
      />
    </div>
  );
}
