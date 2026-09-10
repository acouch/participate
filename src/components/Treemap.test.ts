import { describe, expect, it } from "vitest";
import { readableTextColor, shadeOf, wrapText } from "./Treemap";

/** wrapText estimates 6.8px per character at 12px sans-serif. */
const CHAR_WIDTH = 6.8;
/** Pixel width that fits exactly `n` characters. */
const widthFor = (n: number) => n * CHAR_WIDTH;

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("Police", widthFor(20))).toEqual(["Police"]);
  });

  it("wraps at word boundaries", () => {
    expect(wrapText("Parks and Recreation", widthFor(10))).toEqual([
      "Parks and",
      "Recreation",
    ]);
  });

  it("never exceeds the character budget on any line", () => {
    const maxChars = 12;
    const lines = wrapText(
      "Office of Arts and Culture and the Creative Economy",
      widthFor(maxChars),
    );
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(maxChars);
    }
  });

  it("hard-breaks a single word wider than the line", () => {
    // Tile labels are department names; an unbroken long word must not
    // silently overflow the tile.
    const lines = wrapText("Intergovernmental", widthFor(6));
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(6);
    expect(lines.join("")).toBe("Intergovernmental");
  });

  it("flushes a pending line before hard-breaking", () => {
    const lines = wrapText("of Intergovernmental", widthFor(6));
    expect(lines[0]).toBe("of");
    expect(lines.join("").replace(/of/, "")).toBe("Intergovernmental");
  });

  it("collapses runs of whitespace", () => {
    expect(wrapText("Fire    Department", widthFor(30))).toEqual([
      "Fire Department",
    ]);
  });

  it("returns no lines for empty text", () => {
    expect(wrapText("", widthFor(10))).toEqual([]);
  });

  it("still emits at least one character per line at zero width", () => {
    // Guards the Math.max(1, ...) floor: a zero-width tile must not loop.
    const lines = wrapText("Law", 0);
    expect(lines).toEqual(["L", "a", "w"]);
  });

  it("preserves the original text across the wrap", () => {
    const text = "Office of Homeless Services";
    expect(wrapText(text, widthFor(9)).join(" ")).toBe(text);
  });
});

describe("shadeOf", () => {
  it("returns a hex color", () => {
    expect(shadeOf("#2563eb", 0, 5)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("gets darker as the index increases", () => {
    // Children of a drilled-in tile are shaded light -> dark across the level,
    // so later (smaller) items must be darker than earlier ones.
    const brightness = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    const shades = [0, 1, 2, 3, 4].map((i) => shadeOf("#2563eb", i, 5));
    for (let i = 1; i < shades.length; i++) {
      expect(brightness(shades[i])).toBeLessThan(brightness(shades[i - 1]));
    }
  });

  it("gives distinct shades across a level", () => {
    const shades = [0, 1, 2, 3, 4].map((i) => shadeOf("#2563eb", i, 5));
    expect(new Set(shades).size).toBe(5);
  });

  it("handles a single child without dividing by zero", () => {
    expect(shadeOf("#2563eb", 0, 1)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(shadeOf("#2563eb", 0, 0)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("returns the input unchanged when it is not a parseable color", () => {
    expect(shadeOf("not-a-color", 0, 3)).toBe("not-a-color");
  });
});

describe("readableTextColor", () => {
  it("uses dark text on light fills", () => {
    expect(readableTextColor("#ffffff")).toBe("#1a1a1a");
    expect(readableTextColor("rgb(255,255,230)")).toBe("#1a1a1a");
  });

  it("uses light text on dark fills", () => {
    expect(readableTextColor("#000000")).toBe("#fff");
    expect(readableTextColor("rgb(230,20,20)")).toBe("#fff");
  });

  it("falls back to light text for an unparseable fill", () => {
    expect(readableTextColor("not-a-color")).toBe("#fff");
  });

  it("picks a legible color for every palette entry", () => {
    // Every tile label must resolve to one of the two allowed colors.
    for (const fill of [
      "#a6cee3",
      "#1f78b4",
      "#b2df8a",
      "#33a02c",
      "#fb9a99",
    ]) {
      expect(["#1a1a1a", "#fff"]).toContain(readableTextColor(fill));
    }
  });
});
