import type { BudgetData } from "@/src/app/budget/[uuid]/actions";

/** A budget row as stored, before it is summarized for the account page. */
export interface StoredBudget {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  data: unknown;
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
