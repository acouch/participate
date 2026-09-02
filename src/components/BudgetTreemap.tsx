"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Treemap, { shadeOf, type TreemapDatum } from "@/src/components/Treemap";
import BudgetNodeList from "@/src/components/budget/BudgetNodeList";
import FundSankey from "@/src/components/budget/FundSankey";
import { ordinalColorScale } from "@/src/lib/colors";
import type { BudgetView, FundFlows } from "@/src/lib/budget";

// Fallback category for departments not tagged in tagging.yml (mirrors
// DEFAULT_CATEGORY in budget.ts, kept here to avoid importing the server-only
// budget module into this client component).
const DEFAULT_CATEGORY = "Government Operations";

interface BudgetTreemapProps {
  category: TreemapDatum[];
  fund: TreemapDatum[];
  flows: FundFlows;
}

// UI tabs: "overview" shows the Sankey; the other two select a treemap dataset.
type TabKey = "overview" | BudgetView;

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "fund", label: "By fund" },
  { key: "category", label: "By category" },
];

const isTab = (v: string | null): v is TabKey =>
  v === "overview" || v === "fund" || v === "category";

export default function BudgetTreemap({
  category,
  fund,
  flows,
}: BudgetTreemapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the source of truth: ?view= selects the tab (default "fund")
  // and ?path= holds the treemap drill-down path (slash-separated names).
  const param = searchParams.get("view");
  const tab: TabKey = isTab(param) ? param : "fund";
  const isOverview = tab === "overview";
  // For treemap logic, "overview" has no dataset; fall back to "fund".
  const view: BudgetView = tab === "category" ? "category" : "fund";
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

  // The nodes currently displayed in the treemap: walk the drill path down
  // the dataset and take that level's children (mirrors Treemap's own walk).
  const currentData = useMemo(() => {
    let level = data;
    for (const name of drillPath) {
      const next = level.find((d) => d.name === name)?.children;
      if (!next) break;
      level = next;
    }
    return level;
  }, [data, drillPath]);

  // Ordinal color fallback seeded from every node name across the tree (stable
  // depth-first order), matching how the treemap colors non-category tiles.
  const nodeColor = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    const walk = (nodes: TreemapDatum[]) => {
      for (const d of nodes) {
        if (!seen.has(d.name)) {
          seen.add(d.name);
          names.push(d.name);
        }
        if (d.children) walk(d.children);
      }
    };
    walk(data);
    return ordinalColorScale(names);
  }, [data]);

  // The depth at which tiles are colored by category — must match the value
  // passed to <Treemap> below (fund view colors departments at depth 1).
  const colorByCategoryFromDepth = view === "fund" ? 1 : undefined;

  // Treemap's base per-name color scale: the category view passes
  // nameColor={categoryColor}, so names resolve through categoryColor there;
  // the fund view uses the ordinal scale.
  const baseColor = view === "category" ? categoryColor : nodeColor;

  // The color the treemap gives the node we've drilled into (the last path
  // segment): its category color if it sits at the category-coloring depth,
  // else its ordinal color. Deeper levels are shaded from this. Mirrors
  // Treemap's parentColor.
  const parentColor = useMemo(() => {
    if (drillPath.length === 0) return null;
    let level = data;
    let parent: TreemapDatum | undefined;
    for (const name of drillPath) {
      parent = level.find((d) => d.name === name);
      if (!parent?.children) break;
      level = parent.children;
    }
    if (!parent) return null;
    const parentDepth = drillPath.length - 1;
    if (
      colorByCategoryFromDepth != null &&
      parentDepth === colorByCategoryFromDepth &&
      parent.category
    ) {
      return categoryColor(parent.category);
    }
    return baseColor(parent.name);
  }, [data, drillPath, categoryColor, baseColor, colorByCategoryFromDepth]);

  // Match each list row's swatch to its treemap tile (mirrors Treemap.fillFor).
  const useCategoryColor =
    colorByCategoryFromDepth != null &&
    drillPath.length === colorByCategoryFromDepth;

  const colorForNode = (node: TreemapDatum) => {
    // Top level of the category view is colored per-name by category.
    if (view === "category" && drillPath.length === 0) {
      return categoryColor(node.name);
    }
    if (useCategoryColor && node.category) {
      return categoryColor(node.category);
    }
    // Deeper levels: shade the parent's color light→dark across the sorted
    // level (currentData is already sorted largest-first, as in the treemap).
    if (parentColor) {
      const sorted = [...currentData].sort(
        (a, b) => (b.value ?? 0) - (a.value ?? 0),
      );
      const i = sorted.findIndex((d) => d.name === node.name);
      return shadeOf(parentColor, i < 0 ? 0 : i, sorted.length);
    }
    return baseColor(node.name);
  };

  // What the current level represents, for the list heading.
  const listNoun =
    drillPath.length === 0
      ? view === "fund"
        ? "funds"
        : "categories"
      : drillPath.length === 1
        ? "departments"
        : "expenditure type";

  const drillInto = (node: TreemapDatum) => {
    if (!node.children || node.children.length === 0) return;
    setDrillPath([...drillPath, node.name]);
  };

  const selectTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    // A path from one dataset (or the Sankey) is meaningless in another, reset.
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

  // Clicking a category in the fund-view key jumps to the "By category" view,
  // drilled into that category.
  const openCategory = (name: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "category");
    params.set("path", encodeURIComponent(name));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const fundHelp = (
    <>
      <span>
        The city is funded through over a dozen funding sources, Philadelphia’s{" "}
        <strong>General Fund</strong> being the main operating budget, supported
        primarily by local taxes like the wage and real estate taxes, while
        other funds—such as Enterprise Funds, the Grants Fund, and
        Capital/Special Funds—operate as separate, self-supporting or restricted
        accounts for specific services. Click on a fund below to explore where
        the money goes.
      </span>
    </>
  );
  const catHelp = (
    <>
      <span>
        Click on a category below to explore what departments are funded by
        which funds.
      </span>
    </>
  );
  const help = view === "category" ? catHelp : fundHelp;

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
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => selectTab(t.key)}
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
              {t.label}
            </button>
          );
        })}
      </div>

      {isOverview ? (
        <>
          <div className="mb-4 flex items-start rounded-md px-2 py-2 text-left text-sm text-gray-400 outline-2 outline-[#1a3cb914]">
            <svg
              className="mr-1 h-4 w-4 flex-shrink-0"
              aria-hidden="true"
              fill="#b3b3b3"
              xmlns="http://w3.org"
              viewBox="0 0 20 20"
            >
              <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
            </svg>
            <div>
              This chart shows how each fund flows to the departments it pays
              for. Each fund shows its largest departments individually; smaller
              ones are grouped into an “Other” band. Hover a flow for its
              amount.
            </div>
          </div>
          <FundSankey flows={flows} />
        </>
      ) : (
        <>
          <Treemap
            key={view}
            help={help}
            view={view}
            data={data}
            valuePrefix="$"
            path={drillPath}
            onPathChange={setDrillPath}
            categoryColor={categoryColor}
            colorByCategoryFromDepth={view === "fund" ? 1 : undefined}
            nameColor={view === "category" ? categoryColor : undefined}
            onKeySegmentClick={openCategory}
          />

          <BudgetNodeList
            nodes={currentData}
            noun={listNoun}
            colorFor={colorForNode}
            onSelect={drillInto}
          />
        </>
      )}
    </div>
  );
}
