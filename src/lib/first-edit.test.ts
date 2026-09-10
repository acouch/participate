import { describe, expect, it } from "vitest";
import { isFirstMeaningfulEdit } from "./first-edit";

describe("isFirstMeaningfulEdit", () => {
  it("fires when money is first moved", () => {
    expect(
      isFirstMeaningfulEdit({
        allocations: { Police: 1 },
        alreadyNotified: false,
      }),
    ).toBe(true);
  });

  it("does not fire for an empty budget", () => {
    // Every /start visit saves an empty budget; notifying on those was the
    // noise this replaces.
    expect(
      isFirstMeaningfulEdit({ allocations: {}, alreadyNotified: false }),
    ).toBe(false);
  });

  it("never fires twice for the same budget", () => {
    // Allocations are saved on every adjustment, so without this guard an
    // admin would get an email per slider nudge.
    expect(
      isFirstMeaningfulEdit({
        allocations: { Police: 1, Fire: 2 },
        alreadyNotified: true,
      }),
    ).toBe(false);
  });

  it("stays quiet when a budget is emptied back out", () => {
    expect(
      isFirstMeaningfulEdit({ allocations: {}, alreadyNotified: true }),
    ).toBe(false);
  });
});
