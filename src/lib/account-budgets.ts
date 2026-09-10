import type { BudgetData } from "@/src/app/budget/[uuid]/actions";

/** A budget row as stored, before it is summarized for the account page. */
export interface StoredBudget {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  data: unknown;
  /** Set by an admin when the budget is highlighted publicly. */
  featuredAt?: Date | null;
}

/** One row in the account page's budget list. */
export interface BudgetSummary {
  id: string;
  /** The user's mayoral / project name, or a placeholder when unset. */
  name: string;
  tagline: string;
  /** Draft budgets are still editable; submitted ones are final. */
  submitted: boolean;
  submittedAt: string | null;
  /** How many departments the user moved off the baseline. */
  changeCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** Whether an admin has highlighted this budget. */
  featured: boolean;
}

/** Shown in place of a name the user never set. */
export const UNTITLED = "Untitled budget";

/** Narrows the stored JSON blob, tolerating legacy or empty rows. */
function readData(data: unknown): BudgetData {
  const d = (data ?? {}) as BudgetData;
  return {
    allocations: d.allocations ?? {},
    name: d.name,
    tagline: d.tagline,
    additionalInfo: d.additionalInfo,
    submittedAt: d.submittedAt,
  };
}

/** Summarizes one stored budget for display in the account list. */
export function summarizeBudget(budget: StoredBudget): BudgetSummary {
  const data = readData(budget.data);
  const name = data.name?.trim();
  return {
    id: budget.id,
    name: name ? name : UNTITLED,
    tagline: data.tagline?.trim() ?? "",
    submitted: Boolean(data.submittedAt),
    submittedAt: data.submittedAt ?? null,
    changeCount: Object.keys(data.allocations ?? {}).length,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    featured: Boolean(budget.featuredAt),
  };
}

/**
 * Orders budgets for the account page: drafts first, since those are the ones
 * still waiting on the user, then most recently worked on.
 */
export function sortBudgets(budgets: BudgetSummary[]): BudgetSummary[] {
  return [...budgets].sort((a, b) => {
    if (a.submitted !== b.submitted) return a.submitted ? 1 : -1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/** Where a budget's primary link should go, given whether it is final. */
export function budgetHref(summary: BudgetSummary): string {
  return summary.submitted
    ? `/budget/${summary.id}`
    : `/budget/${summary.id}/edit`;
}

/** Columns the admin table can sort by. */
export type SortKey = "name" | "status" | "changed" | "updated";
export type SortDirection = "asc" | "desc";

/** The direction each column starts in when first clicked. */
export const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  // Text reads naturally A→Z; the numeric and date columns are most useful
  // showing the largest or most recent first.
  name: "asc",
  status: "asc",
  changed: "desc",
  updated: "desc",
};

/**
 * Sorts budgets by one column. Ties fall back to most-recently-updated so the
 * order stays stable and predictable when many rows share a value.
 */
export function sortBudgetsBy<T extends BudgetSummary>(
  budgets: T[],
  key: SortKey,
  direction: SortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;

  const compare = (a: T, b: T): number => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      case "status":
        // Drafts before submitted when ascending.
        return Number(a.submitted) - Number(b.submitted);
      case "changed":
        return a.changeCount - b.changeCount;
      case "updated":
        return a.updatedAt.getTime() - b.updatedAt.getTime();
    }
  };

  return [...budgets].sort((a, b) => {
    const primary = compare(a, b);
    if (primary !== 0) return primary * sign;
    // Stable tiebreak, independent of the chosen direction.
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/** Status filter values for the admin list. */
export type StatusFilter = "all" | "draft" | "submitted";
/** "Changed" filter: any, untouched, or edited at least once. */
export type ChangedFilter = "all" | "none" | "some";

/** Whether a budget passes the status filter. */
export function matchesStatus(
  budget: Pick<BudgetSummary, "submitted">,
  filter: StatusFilter,
): boolean {
  if (filter === "all") return true;
  return filter === "submitted" ? budget.submitted : !budget.submitted;
}

/** Whether a budget passes the "departments changed" filter. */
export function matchesChanged(
  budget: Pick<BudgetSummary, "changeCount">,
  filter: ChangedFilter,
): boolean {
  if (filter === "all") return true;
  return filter === "some" ? budget.changeCount > 0 : budget.changeCount === 0;
}

/**
 * Whether a budget passes the owner filter. "all" matches everything and
 * "anonymous" matches budgets with no owner; anything else is an exact email.
 */
export function matchesOwner(
  ownerEmail: string | null,
  filter: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "anonymous") return ownerEmail === null;
  return (ownerEmail ?? "").toLowerCase() === filter.toLowerCase();
}
