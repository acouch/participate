import { describe, expect, it } from "vitest";
import { dollars, pctTextColor, signedPct } from "./budget-format";

describe("dollars", () => {
  it("formats whole dollars with no cents", () => {
    expect(dollars.format(6_967_811_000)).toBe("$6,967,811,000");
    expect(dollars.format(675_805_473)).toBe("$675,805,473");
    expect(dollars.format(0)).toBe("$0");
  });

  it("rounds away fractional cents rather than showing them", () => {
    expect(dollars.format(1234.56)).toBe("$1,235");
  });

  it("keeps negatives readable", () => {
    expect(dollars.format(-432_687_784)).toBe("-$432,687,784");
  });
});

describe("signedPct", () => {
  it("prefixes a plus on increases", () => {
    expect(signedPct(1.8)).toBe("+1.8%");
    expect(signedPct(40.75)).toBe("+40.8%");
  });

  it("keeps the minus on decreases", () => {
    expect(signedPct(-22.6)).toBe("-22.6%");
  });

  it("shows zero as +0.0%, not -0.0%", () => {
    expect(signedPct(0)).toBe("+0.0%");
    // -0 is a real JS value and must not leak a stray minus into the UI.
    expect(signedPct(-0)).toBe("+0.0%");
  });

  it("always shows exactly one decimal place", () => {
    expect(signedPct(5)).toBe("+5.0%");
    expect(signedPct(1.849)).toBe("+1.8%");
    expect(signedPct(1.851)).toBe("+1.9%");
  });

  it("handles a department cut to nothing", () => {
    expect(signedPct(-100)).toBe("-100.0%");
  });
});

describe("pctTextColor", () => {
  it("is green for an increase and red for a cut", () => {
    expect(pctTextColor(1.8)).toBe("#16a34a");
    expect(pctTextColor(-22.6)).toBe("#dc2626");
  });

  it("is neutral for no change", () => {
    expect(pctTextColor(0)).toBe("#666");
  });

  it("is neutral when the change is unknown", () => {
    // A department with no prior-year budget must not read as a cut.
    expect(pctTextColor(null)).toBe("#666");
  });
});
