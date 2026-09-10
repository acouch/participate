import { describe, expect, it } from "vitest";
import {
  CATEGORICAL_PALETTE,
  distinctColors,
  ordinalColorScale,
} from "./colors";

describe("distinctColors", () => {
  it("returns the requested number of colors", () => {
    expect(distinctColors(1)).toHaveLength(1);
    expect(distinctColors(5)).toHaveLength(5);
    expect(distinctColors(24)).toHaveLength(24);
  });

  it("returns nothing for a non-positive count", () => {
    expect(distinctColors(0)).toEqual([]);
    expect(distinctColors(-3)).toEqual([]);
  });

  it("never repeats a color, even past the hand-picked palette", () => {
    // The point of this helper: ~17 budget categories must all be visually
    // distinguishable, and asking for more must not wrap around to color #1.
    for (const n of [12, 24, 40]) {
      const colors = distinctColors(n);
      expect(new Set(colors).size).toBe(n);
    }
  });

  it("uses the qualitative palette while it lasts", () => {
    expect(distinctColors(6)).toEqual(CATEGORICAL_PALETTE.slice(0, 6));
  });

  it("keeps the palette prefix when falling back to the rainbow", () => {
    const many = distinctColors(30);
    expect(many.slice(0, CATEGORICAL_PALETTE.length)).toEqual(
      CATEGORICAL_PALETTE,
    );
  });

  it("returns only parseable CSS colors", () => {
    for (const c of distinctColors(30)) {
      expect(c).toMatch(/^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\()/i);
    }
  });
});

describe("ordinalColorScale", () => {
  it("maps each name to its own color", () => {
    const scale = ordinalColorScale(["Police", "Fire", "Parks"]);
    const used = ["Police", "Fire", "Parks"].map(scale);
    expect(new Set(used).size).toBe(3);
  });

  it("is stable — the same name always gets the same color", () => {
    const scale = ordinalColorScale(["Police", "Fire"]);
    expect(scale("Police")).toBe(scale("Police"));
  });

  it("gives the same name the same color across two identical scales", () => {
    // Categories keep their color across the fund and category views, which
    // relies on the scale being a pure function of the domain order.
    const a = ordinalColorScale(["Police", "Fire", "Parks"]);
    const b = ordinalColorScale(["Police", "Fire", "Parks"]);
    expect(a("Parks")).toBe(b("Parks"));
  });

  it("depends on domain order, not just membership", () => {
    const a = ordinalColorScale(["Police", "Fire"]);
    const b = ordinalColorScale(["Fire", "Police"]);
    // Documents the contract: callers must build the domain deterministically
    // (the app sorts or walks depth-first) or colors will shift between views.
    expect(a("Police")).toBe(b("Fire"));
  });

  it("handles an empty domain without throwing", () => {
    expect(() => ordinalColorScale([])("Anything")).not.toThrow();
  });
});
