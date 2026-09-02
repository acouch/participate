import { describe, expect, it } from "vitest";
import {
  BASELINE_RAISE,
  FISCAL_YEAR,
  PRIOR_FISCAL_YEAR,
  getEditableFund,
} from "./budget";
import {
  baselineFor,
  remainingToAllocate,
  totalAllocated,
} from "./budget-math";

/**
 * These run against the real data/fund.json, so they assert the numbers users
 * actually see. If the source data is refreshed for a new fiscal year the
 * exact-dollar expectations here are the ones to update.
 */
describe("getEditableFund", () => {
  it("reads the General Fund total for the current fiscal year", async () => {
    const fund = await getEditableFund();
    expect(fund.totalToSpend).toBe(6_967_811_000);
  });

  it("returns every funded department", async () => {
    const fund = await getEditableFund();
    expect(fund.departments).toHaveLength(73);
    expect(fund.departments.every((d) => d.priorAmount > 0)).toBe(true);
  });

  it("sorts departments largest first", async () => {
    const fund = await getEditableFund();
    const priors = fund.departments.map((d) => d.priorAmount);
    expect([...priors].sort((a, b) => b - a)).toEqual(priors);
  });

  it("starts every department at the prior year plus the baseline raise", async () => {
    const fund = await getEditableFund();
    for (const d of fund.departments) {
      expect(d.baselineAmount).toBe(baselineFor(d.priorAmount, BASELINE_RAISE));
    }
  });

  it("gives each department the full raise, not a partial one", async () => {
    const fund = await getEditableFund();
    const police = fund.departments.find((d) => d.name === "Police");
    const fire = fund.departments.find((d) => d.name === "Fire");
    expect(police?.priorAmount).toBe(873_494_820);
    expect(police?.baselineAmount).toBe(889_217_727);
    expect(fire?.priorAmount).toBe(444_221_835);
    expect(fire?.baselineAmount).toBe(452_217_828);
  });

  it("leaves exactly $2,085,938 unallocated before the user edits anything", async () => {
    // The flat raise deliberately does not consume the whole fund; this pool is
    // what the onboarding copy promises the user they can direct.
    const fund = await getEditableFund();
    const amounts = fund.departments.map((d) => ({ amount: d.baselineAmount }));
    expect(totalAllocated(amounts)).toBe(6_965_725_062);
    expect(remainingToAllocate(fund.totalToSpend, amounts)).toBe(2_085_938);
  });

  it("leaves a positive pool, never an over-budget start", async () => {
    const fund = await getEditableFund();
    const amounts = fund.departments.map((d) => ({ amount: d.baselineAmount }));
    expect(remainingToAllocate(fund.totalToSpend, amounts)).toBeGreaterThan(0);
  });

  it("assigns every department a category", async () => {
    const fund = await getEditableFund();
    expect(fund.departments.every((d) => d.category.length > 0)).toBe(true);
  });

  it("has no duplicate department names", async () => {
    const fund = await getEditableFund();
    const names = fund.departments.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("fiscal year constants", () => {
  it("uses consecutive years", () => {
    expect(Number(FISCAL_YEAR) - Number(PRIOR_FISCAL_YEAR)).toBe(1);
  });

  it("keeps the baseline raise as a fraction, not a percentage", () => {
    // A value like 1.8 here would raise every department by 180%.
    expect(BASELINE_RAISE).toBeGreaterThan(0);
    expect(BASELINE_RAISE).toBeLessThan(1);
    expect(BASELINE_RAISE).toBe(0.018);
  });
});
