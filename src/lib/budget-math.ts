/**
 * Pure budget arithmetic, kept free of React and data loading so it can be
 * unit tested directly.
 *
 * Two different comparisons matter and are easy to confuse:
 *
 * - **vs. prior year** (`percentChange`): how an allocation compares to the
 *   FY2026 budget. An untouched department still shows the baseline raise
 *   (+1.8%), because that raise is part of the starting proposal.
 * - **vs. baseline** (`delta`): how far the user moved a department off the
 *   starting allocation it was given. This is zero for anything untouched, so
 *   it is what identifies a deliberate funding change.
 */

/** A department's amounts within one proposed budget. */
export interface DepartmentAmounts {
  /** Prior fiscal year (FY2026) budget. */
  priorAmount: number;
  /** The editor's starting allocation (prior year + baseline raise). */
  baselineAmount: number;
  /** The allocation in this budget. */
  amount: number;
}

/** Applies the uniform baseline raise, rounded to whole dollars. */
export function baselineFor(
  priorAmount: number,
  baselineRaise: number,
): number {
  return Math.round(priorAmount * (1 + baselineRaise));
}

/**
 * Percent change against the prior year. Null when there is no prior-year
 * budget to compare against (a new department), since the change is undefined
 * rather than infinite.
 */
export function percentChangeVsPrior(
  amount: number,
  priorAmount: number,
): number | null {
  if (priorAmount <= 0) return null;
  return ((amount - priorAmount) / priorAmount) * 100;
}

/** Dollars the user moved a department off its starting allocation. */
export function deltaVsBaseline(d: DepartmentAmounts): number {
  return d.amount - d.baselineAmount;
}

/** True when the user actually changed this department's funding. */
export function isChanged(d: DepartmentAmounts): boolean {
  return d.amount !== d.baselineAmount;
}

/** Total allocated across departments. */
export function totalAllocated(amounts: { amount: number }[]): number {
  return amounts.reduce((sum, d) => sum + d.amount, 0);
}

/**
 * Unallocated funds: positive when money is left to spend, negative when the
 * budget is over. Reported as a signed number so callers can distinguish the
 * two cases rather than losing the sign to Math.abs.
 */
export function remainingToAllocate(
  totalToSpend: number,
  amounts: { amount: number }[],
): number {
  return totalToSpend - totalAllocated(amounts);
}

/**
 * Keeps only the allocations that differ from the baseline. Persisting the
 * whole map would record every untouched department as a deliberate choice,
 * and the report could no longer tell an edit from a default.
 */
export function changedAllocationsOnly(
  allocations: Record<string, number>,
  baseline: Record<string, number>,
): Record<string, number> {
  const changed: Record<string, number> = {};
  for (const [dept, value] of Object.entries(allocations)) {
    if (value !== baseline[dept]) changed[dept] = value;
  }
  return changed;
}

/** A department line item as rendered by the budget report. */
export interface LineItem {
  name: string;
  category: string;
  priorAmount: number;
  baselineAmount: number;
  amount: number;
  percentChange: number | null;
}

/** The department fields the report needs from the fund data. */
export interface FundDepartment {
  name: string;
  category: string;
  priorAmount: number;
  baselineAmount: number;
}

/**
 * Builds the report's department line items: the saved allocation where the
 * user set one, otherwise the starting baseline. Shared by the review and
 * final-budget pages so the two cannot drift apart.
 */
export function buildLineItems(
  departments: FundDepartment[],
  allocations: Record<string, number>,
): LineItem[] {
  return departments.map((d) => {
    const amount = allocations[d.name] ?? d.baselineAmount;
    return {
      name: d.name,
      category: d.category,
      priorAmount: d.priorAmount,
      baselineAmount: d.baselineAmount,
      amount,
      percentChange: percentChangeVsPrior(amount, d.priorAmount),
    };
  });
}

/**
 * Compact dollars for inline chips: $1.2B, $45M, $900K. Formatted by hand
 * rather than with Intl's `notation: "compact"`, whose trailing-zero handling
 * differs between Node and browser ICU and caused a hydration mismatch.
 */
export function compactDollars(value: number): string {
  let n = Math.abs(value);
  // Rounding can push a value past its own threshold (999,999 would render as
  // "$1000K"), so promote it to the next unit up before choosing one.
  if (n >= 999_500 && n < 1e6) n = 1e6;
  else if (n >= 999_500_000 && n < 1e9) n = 1e9;

  const [divisor, suffix] =
    n >= 1e9
      ? [1e9, "B"]
      : n >= 1e6
        ? [1e6, "M"]
        : n >= 1e3
          ? [1e3, "K"]
          : [1, ""];
  const scaled = n / divisor;
  // One decimal below 100 (e.g. $1.2B, $45.3M), none above (e.g. $124M).
  const text =
    scaled < 100 && divisor > 1
      ? scaled.toFixed(1)
      : Math.round(scaled).toString();
  return `$${text.replace(/\.0$/, "")}${suffix}`;
}
