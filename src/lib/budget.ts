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
  name.replace(/\s*-\s*/g, "-").trim().toLowerCase();

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
