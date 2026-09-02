import { describe, expect, it } from "vitest";
import {
  baselineFor,
  buildLineItems,
  changedAllocationsOnly,
  compactDollars,
  deltaVsBaseline,
  isChanged,
  percentChangeVsPrior,
  remainingToAllocate,
  totalAllocated,
  type FundDepartment,
} from "./budget-math";

/** The real FY2026 → FY2027 baseline raise used by the editor. */
const RAISE = 0.018;

// Real figures from data/fund.json, so the expected values below are the ones
// that actually appear in the app rather than invented round numbers.
const POLICE_FY26 = 873_494_820;
const FIRE_FY26 = 444_221_835;
const GENERAL_FUND_FY27 = 6_967_811_000;

describe("baselineFor", () => {
  it("applies the uniform raise to the prior year", () => {
    expect(baselineFor(POLICE_FY26, RAISE)).toBe(889_217_727);
    expect(baselineFor(FIRE_FY26, RAISE)).toBe(452_217_828);
  });

  it("rounds to whole dollars rather than leaving fractional cents", () => {
    // 1000 * 1.018 = 1018 exactly; 1001 * 1.018 = 1019.018 -> 1019.
    expect(baselineFor(1000, RAISE)).toBe(1018);
    expect(baselineFor(1001, RAISE)).toBe(1019);
    expect(Number.isInteger(baselineFor(333_333_333, RAISE))).toBe(true);
  });

  it("leaves a zero budget at zero", () => {
    expect(baselineFor(0, RAISE)).toBe(0);
  });

  it("supports a zero raise (baseline equals prior year)", () => {
    expect(baselineFor(POLICE_FY26, 0)).toBe(POLICE_FY26);
  });
});

describe("percentChangeVsPrior", () => {
  it("reports the baseline raise for an untouched department", () => {
    // This is the regression that mattered: an unedited department must read
    // +1.8% against the prior year, not 0%.
    const baseline = baselineFor(POLICE_FY26, RAISE);
    expect(percentChangeVsPrior(baseline, POLICE_FY26)).toBeCloseTo(1.8, 1);
    expect(
      percentChangeVsPrior(baselineFor(FIRE_FY26, RAISE), FIRE_FY26),
    ).toBeCloseTo(1.8, 1);
  });

  it("computes a real cut against the prior year", () => {
    // Police cut to $675,805,473 reads -22.6% vs FY2026.
    expect(percentChangeVsPrior(675_805_473, POLICE_FY26)).toBeCloseTo(
      -22.6,
      1,
    );
  });

  it("is zero when the amount matches the prior year", () => {
    expect(percentChangeVsPrior(POLICE_FY26, POLICE_FY26)).toBe(0);
  });

  it("returns null when there is no prior-year budget to compare against", () => {
    expect(percentChangeVsPrior(1_000_000, 0)).toBeNull();
    expect(percentChangeVsPrior(1_000_000, -5)).toBeNull();
  });

  it("handles a department cut to nothing", () => {
    expect(percentChangeVsPrior(0, POLICE_FY26)).toBe(-100);
  });
});

describe("deltaVsBaseline / isChanged", () => {
  const police = {
    priorAmount: POLICE_FY26,
    baselineAmount: baselineFor(POLICE_FY26, RAISE),
    amount: 675_805_473,
  };

  it("measures the money the user actually moved", () => {
    // 889,217,727 - 675,805,473 = 213,412,254
    expect(deltaVsBaseline(police)).toBe(-213_412_254);
  });

  it("is exactly zero for a department left at its baseline", () => {
    const fire = {
      priorAmount: FIRE_FY26,
      baselineAmount: baselineFor(FIRE_FY26, RAISE),
      amount: baselineFor(FIRE_FY26, RAISE),
    };
    expect(deltaVsBaseline(fire)).toBe(0);
    expect(isChanged(fire)).toBe(false);
  });

  it("treats any deviation from baseline as a change", () => {
    expect(isChanged(police)).toBe(true);
    const nudged = { ...police, amount: police.baselineAmount + 1 };
    expect(isChanged(nudged)).toBe(true);
  });
});

describe("totalAllocated / remainingToAllocate", () => {
  it("sums allocations", () => {
    expect(
      totalAllocated([{ amount: 100 }, { amount: 250 }, { amount: 1 }]),
    ).toBe(351);
  });

  it("is zero for an empty budget", () => {
    expect(totalAllocated([])).toBe(0);
  });

  it("reports the leftover pool the baseline raise leaves behind", () => {
    // The whole point of the flat raise: it does not consume the entire fund,
    // leaving $2,085,938 for the user to direct.
    const spent = GENERAL_FUND_FY27 - 2_085_938;
    expect(remainingToAllocate(GENERAL_FUND_FY27, [{ amount: spent }])).toBe(
      2_085_938,
    );
  });

  it("goes negative when the budget is over", () => {
    const over = remainingToAllocate(GENERAL_FUND_FY27, [
      { amount: GENERAL_FUND_FY27 + 432_687_784 },
    ]);
    expect(over).toBe(-432_687_784);
    expect(over).toBeLessThan(0);
  });

  it("is zero when every dollar is allocated", () => {
    expect(
      remainingToAllocate(GENERAL_FUND_FY27, [{ amount: GENERAL_FUND_FY27 }]),
    ).toBe(0);
  });
});

describe("changedAllocationsOnly", () => {
  const baseline = {
    Police: 889_217_727,
    Fire: 452_217_828,
    Prisons: 315_830_371,
  };

  it("keeps only departments the user moved off baseline", () => {
    const allocations = { ...baseline, Police: 675_805_473 };
    expect(changedAllocationsOnly(allocations, baseline)).toEqual({
      Police: 675_805_473,
    });
  });

  it("drops a department edited and then set back to its default", () => {
    // Regression: persisting the full map recorded untouched departments as
    // deliberate choices, so every one showed up as a funding change.
    const allocations = { ...baseline };
    expect(changedAllocationsOnly(allocations, baseline)).toEqual({});
  });

  it("keeps a change of a single dollar", () => {
    const allocations = { ...baseline, Fire: baseline.Fire + 1 };
    expect(changedAllocationsOnly(allocations, baseline)).toEqual({
      Fire: baseline.Fire + 1,
    });
  });

  it("keeps a department zeroed out entirely", () => {
    const allocations = { ...baseline, Prisons: 0 };
    expect(changedAllocationsOnly(allocations, baseline)).toEqual({
      Prisons: 0,
    });
  });

  it("keeps an allocation with no matching baseline entry", () => {
    // An unknown department is a real value, not a default to discard.
    const allocations = { ...baseline, "New Office": 5_000_000 };
    expect(changedAllocationsOnly(allocations, baseline)).toEqual({
      "New Office": 5_000_000,
    });
  });
});

describe("buildLineItems", () => {
  const departments: FundDepartment[] = [
    {
      name: "Police",
      category: "Police",
      priorAmount: POLICE_FY26,
      baselineAmount: baselineFor(POLICE_FY26, RAISE),
    },
    {
      name: "Fire",
      category: "Emergency Services",
      priorAmount: FIRE_FY26,
      baselineAmount: baselineFor(FIRE_FY26, RAISE),
    },
  ];

  it("falls back to the baseline for departments with no saved allocation", () => {
    const [police, fire] = buildLineItems(departments, {});
    expect(police.amount).toBe(889_217_727);
    expect(fire.amount).toBe(452_217_828);
    // Untouched departments are not funding changes...
    expect(isChanged(police)).toBe(false);
    // ...but they still carry the year-over-year raise.
    expect(police.percentChange).toBeCloseTo(1.8, 1);
  });

  it("uses the saved allocation where the user set one", () => {
    const [police, fire] = buildLineItems(departments, { Police: 675_805_473 });
    expect(police.amount).toBe(675_805_473);
    expect(police.percentChange).toBeCloseTo(-22.6, 1);
    expect(deltaVsBaseline(police)).toBe(-213_412_254);
    // The untouched department is unaffected by its neighbour's edit.
    expect(fire.amount).toBe(452_217_828);
    expect(isChanged(fire)).toBe(false);
  });

  it("honours an explicit zero rather than treating it as missing", () => {
    // `?? baseline` must not swallow a deliberate 0 the way `|| baseline` would.
    const [police] = buildLineItems(departments, { Police: 0 });
    expect(police.amount).toBe(0);
    expect(police.percentChange).toBe(-100);
  });

  it("ignores allocations for departments not in the fund", () => {
    const items = buildLineItems(departments, { "Ghost Agency": 1_000 });
    expect(items).toHaveLength(2);
    expect(items.map((d) => d.name)).toEqual(["Police", "Fire"]);
  });

  it("preserves department order and category", () => {
    const items = buildLineItems(departments, {});
    expect(items.map((d) => d.name)).toEqual(["Police", "Fire"]);
    expect(items[1].category).toBe("Emergency Services");
  });
});

describe("compactDollars", () => {
  it("formats each magnitude", () => {
    expect(compactDollars(1_200_000_000)).toBe("$1.2B");
    expect(compactDollars(52_200_000)).toBe("$52.2M");
    expect(compactDollars(9_500)).toBe("$9.5K");
    expect(compactDollars(250)).toBe("$250");
  });

  it("drops the decimal at or above 100 units", () => {
    expect(compactDollars(124_000_000)).toBe("$124M");
    expect(compactDollars(310_800_000)).toBe("$311M");
  });

  it("drops a trailing .0 rather than printing $1.0B", () => {
    // The Intl compact formatter disagreed between Node and browser ICU here,
    // which produced a hydration mismatch; hand-formatting must be stable.
    expect(compactDollars(1_000_000_000)).toBe("$1B");
    expect(compactDollars(45_000_000)).toBe("$45M");
    expect(compactDollars(1_000)).toBe("$1K");
  });

  it("uses magnitude, not sign — callers render the sign themselves", () => {
    expect(compactDollars(-258_590_299)).toBe("$259M");
    expect(compactDollars(258_590_299)).toBe("$259M");
  });

  it("handles zero", () => {
    expect(compactDollars(0)).toBe("$0");
  });

  it("switches unit exactly at each threshold", () => {
    expect(compactDollars(999)).toBe("$999");
    expect(compactDollars(1_000)).toBe("$1K");
    expect(compactDollars(1_000_000)).toBe("$1M");
    expect(compactDollars(1_000_000_000)).toBe("$1B");
  });

  it("promotes a value that rounds up past its own unit", () => {
    // Naively these render as "$1000K" / "$1000M", which reads as a mistake.
    expect(compactDollars(999_999)).toBe("$1M");
    expect(compactDollars(999_999_999)).toBe("$1B");
  });
});
