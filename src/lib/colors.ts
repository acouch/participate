import { scaleOrdinal } from "d3-scale";
import {
  interpolateRainbow,
  schemePaired,
  schemeSet3,
} from "d3-scale-chromatic";

// A 24-color qualitative palette (ColorBrewer Paired + Set3) — hand-designed,
// distinct hues that read well on white. Covers well past the ~17 categories
// before any color repeats.
export const CATEGORICAL_PALETTE: string[] = [...schemePaired, ...schemeSet3];

/**
 * Returns `n` visually distinct colors. Uses the qualitative palette while it
 * lasts, then falls back to sampling the cyclic rainbow interpolator so colors
 * never repeat regardless of `n`.
 */
export function distinctColors(n: number): string[] {
  if (n <= 0) return [];
  if (n <= CATEGORICAL_PALETTE.length) return CATEGORICAL_PALETTE.slice(0, n);
  return Array.from({ length: n }, (_, i) =>
    i < CATEGORICAL_PALETTE.length
      ? CATEGORICAL_PALETTE[i]
      : interpolateRainbow(i / n),
  );
}

/**
 * An ordinal color scale over `domain` with a guaranteed-distinct color per
 * entry (so categories never share a color, even past 10–12 of them).
 */
export function ordinalColorScale(domain: string[]) {
  return scaleOrdinal<string, string>()
    .domain(domain)
    .range(distinctColors(domain.length));
}
