import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TreemapDatum } from "@/src/components/Treemap";

/** A node in the Open Budget hierarchy (data/data.json). */
export interface BudgetNode {
  id: number;
  name: string;
  gross_cost?: {
    accounts?: Record<string, number>;
  };
  children?: BudgetNode[];
}

/** Fiscal year used to size the treemap (meta.js `value`). */
export const FISCAL_YEAR = "2027";
/** Prior fiscal year, used to compute percent change (meta.js `value2`). */
export const PRIOR_FISCAL_YEAR = "2026";

/** Departments not listed in tagging.yml fall back to this category. */
export const DEFAULT_CATEGORY = "Government Operations";

/** Normalizes a department name for matching (collapses spaces around hyphens). */
const normalizeName = (name: string) =>
  name
    .replace(/\s*-\s*/g, "-")
    .trim()
    .toLowerCase();

/**
 * Parses data/tagging.yml into a normalized {department -> category} map.
 * The file is a simple `peoples_budget: { Category: [Dept, ...] }` structure,
 * parsed directly to avoid a YAML dependency.
 */
function parseTagging(yml: string): Map<string, string> {
  const map = new Map<string, string>();
  let category: string | null = null;
  for (const line of yml.split("\n")) {
    if (/^\s*#/.test(line) || line.trim() === "") continue;
    const catMatch = line.match(/^ {2}([^ ].*?):\s*(\[\])?\s*$/);
    const itemMatch = line.match(/^ {4}- (.+?)\s*$/);
    if (catMatch) {
      category = catMatch[1];
    } else if (itemMatch && category) {
      map.set(normalizeName(itemMatch[1]), category);
    }
  }
  return map;
}

let taggingCache: Map<string, string> | null = null;
async function getTagging(): Promise<Map<string, string>> {
  if (!taggingCache) {
    const file = path.join(process.cwd(), "data", "tagging.yml");
    taggingCache = parseTagging(await readFile(file, "utf8"));
  }
  return taggingCache;
}

/** Converts a raw budget node into a TreemapDatum, recursing into children. */
function toDatum(node: BudgetNode, tagging: Map<string, string>): TreemapDatum {
  const accounts = node.gross_cost?.accounts ?? {};
  const value = accounts[FISCAL_YEAR] ?? 0;
  const prior = accounts[PRIOR_FISCAL_YEAR];
  const percentChange =
    prior && prior > 0 ? ((value - prior) / prior) * 100 : null;

  const children = node.children
    ?.map((child) => toDatum(child, tagging))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    name: node.name,
    value,
    percentChange,
    category: tagging.get(normalizeName(node.name)) ?? DEFAULT_CATEGORY,
    ...(children && children.length > 0 ? { children } : {}),
  };
}

/** The datasets available to the treemap, keyed by how the budget is grouped. */
export type BudgetView = "category" | "fund";

const DATA_FILES: Record<BudgetView, string> = {
  category: "category.json",
  fund: "fund.json",
};

/**
 * Reads a budget dataset (grouped by category or by fund) and returns the top
 * level of the tree as {name, value, percentChange, children} data suitable
 * for the Treemap component. Children are nested so the treemap can drill down
 * on click.
 */
export async function getBudget(
  view: BudgetView = "category",
): Promise<TreemapDatum[]> {
  const file = path.join(process.cwd(), "data", DATA_FILES[view]);
  const [raw, tagging] = await Promise.all([
    readFile(file, "utf8"),
    getTagging(),
  ]);
  const nodes = JSON.parse(raw) as BudgetNode[];

  return nodes.map((node) => toDatum(node, tagging)).filter((d) => d.value > 0);
}

/** Fund used for the "make your own budget" editor. */
export const EDITABLE_FUND = "General Fund";
/** Uniform raise applied to each department's prior-year budget as the baseline. */
export const BASELINE_RAISE = 0.018;

/** A department in the editable budget: its category and prior-year amount. */
export interface EditableDepartment {
  name: string;
  category: string;
  /** Prior fiscal year (2026) budget — the comparison baseline. */
  priorAmount: number;
}

export interface EditableFund {
  /** Total available to spend (the fund's current-year total). */
  totalToSpend: number;
  departments: EditableDepartment[];
}

/**
 * Returns the General Fund's departments with their prior-year budgets, plus
 * the total available to spend, for the budget editor. The editor's starting
 * allocation for each department is priorAmount * (1 + BASELINE_RAISE).
 */
export async function getEditableFund(): Promise<EditableFund> {
  const [raw, tagging] = await Promise.all([
    readFile(path.join(process.cwd(), "data", "fund.json"), "utf8"),
    getTagging(),
  ]);
  const nodes = JSON.parse(raw) as BudgetNode[];
  const fund = nodes.find((n) => n.name === EDITABLE_FUND);
  if (!fund) throw new Error(`Fund "${EDITABLE_FUND}" not found`);

  const departments: EditableDepartment[] = (fund.children ?? [])
    .map((child) => ({
      name: child.name,
      category: tagging.get(normalizeName(child.name)) ?? DEFAULT_CATEGORY,
      priorAmount: child.gross_cost?.accounts?.[PRIOR_FISCAL_YEAR] ?? 0,
    }))
    .filter((d) => d.priorAmount > 0)
    .sort((a, b) => b.priorAmount - a.priorAmount);

  return {
    totalToSpend: fund.gross_cost?.accounts?.[FISCAL_YEAR] ?? 0,
    departments,
  };
}

/** A node in the fund → department flow graph (for the Sankey chart). */
export interface FlowNode {
  /** Stable id (fund name, department name, or `${fund}:__other__`). */
  id: string;
  /** Display label. */
  name: string;
  /** "fund" for left-column nodes, "department" for right-column nodes. */
  kind: "fund" | "department";
  /** People's Budget category (departments only) for coloring. */
  category?: string;
}

/** A weighted flow from a fund to a department. */
export interface FlowLink {
  source: string;
  target: string;
  value: number;
}

export interface FundFlows {
  nodes: FlowNode[];
  links: FlowLink[];
}

/**
 * Builds the fund → department flow graph for the Sankey chart. To keep the
 * right column readable, each fund keeps its `topPerFund` largest departments
 * and rolls the remaining tail into a single per-fund "Other" node. Department
 * nodes are shared by name so a department funded by several funds converges.
 */
export async function getFundFlows(topPerFund = 6): Promise<FundFlows> {
  const [raw, tagging] = await Promise.all([
    readFile(path.join(process.cwd(), "data", "fund.json"), "utf8"),
    getTagging(),
  ]);
  const funds = JSON.parse(raw) as BudgetNode[];

  const nodes = new Map<string, FlowNode>();
  const links: FlowLink[] = [];

  // Largest funds first so the left column reads top-to-bottom by size.
  const sortedFunds = [...funds]
    .map((f) => ({
      node: f,
      total: f.gross_cost?.accounts?.[FISCAL_YEAR] ?? 0,
    }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);

  for (const { node: fund } of sortedFunds) {
    const fundId = fund.name;
    nodes.set(fundId, { id: fundId, name: fund.name, kind: "fund" });

    const depts = (fund.children ?? [])
      .map((c) => ({
        name: c.name,
        value: c.gross_cost?.accounts?.[FISCAL_YEAR] ?? 0,
        category: tagging.get(normalizeName(c.name)) ?? DEFAULT_CATEGORY,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const kept = depts.slice(0, topPerFund);
    const tail = depts.slice(topPerFund);

    for (const d of kept) {
      // Department nodes are shared by name across funds so flows converge.
      if (!nodes.has(d.name)) {
        nodes.set(d.name, {
          id: d.name,
          name: d.name,
          kind: "department",
          category: d.category,
        });
      }
      links.push({ source: fundId, target: d.name, value: d.value });
    }

    if (tail.length > 0) {
      const otherId = `${fundId}:__other__`;
      const otherValue = tail.reduce((s, d) => s + d.value, 0);
      nodes.set(otherId, {
        id: otherId,
        name: `Other (${tail.length} dept${tail.length === 1 ? "" : "s"})`,
        kind: "department",
      });
      links.push({ source: fundId, target: otherId, value: otherValue });
    }
  }

  return { nodes: Array.from(nodes.values()), links };
}
