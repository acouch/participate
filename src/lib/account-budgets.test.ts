import { describe, expect, it } from "vitest";
import {
  budgetHref,
  sortBudgets,
  summarizeBudget,
  UNTITLED,
  type BudgetSummary,
  type StoredBudget,
} from "./account-budgets";

function stored(overrides: Partial<StoredBudget> = {}): StoredBudget {
  return {
    id: "abc12",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    data: {},
    ...overrides,
  };
}

function summary(overrides: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    id: "abc12",
    name: "A budget",
    tagline: "",
    submitted: false,
    submittedAt: null,
    changeCount: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("summarizeBudget", () => {
  it("reads the saved name and tagline", () => {
    const s = summarizeBudget(
      stored({ data: { name: "Mayor Ada", tagline: "Safer streets" } }),
    );
    expect(s.name).toBe("Mayor Ada");
    expect(s.tagline).toBe("Safer streets");
  });

  it("falls back to a placeholder when no name was set", () => {
    // /start creates the budget before the welcome flow collects a name, so a
    // nameless row is normal, not corrupt.
    expect(summarizeBudget(stored({ data: {} })).name).toBe(UNTITLED);
    expect(summarizeBudget(stored({ data: { name: "   " } })).name).toBe(
      UNTITLED,
    );
  });

  it("tolerates a missing or legacy data blob", () => {
    expect(summarizeBudget(stored({ data: null })).name).toBe(UNTITLED);
    expect(summarizeBudget(stored({ data: null })).changeCount).toBe(0);
    expect(summarizeBudget(stored({ data: undefined })).tagline).toBe("");
  });

  it("counts the departments the user changed", () => {
    const s = summarizeBudget(
      stored({ data: { allocations: { Police: 1, Fire: 2, Parks: 3 } } }),
    );
    expect(s.changeCount).toBe(3);
  });

  it("marks a budget submitted only once it has a timestamp", () => {
    expect(summarizeBudget(stored({ data: {} })).submitted).toBe(false);
    const done = summarizeBudget(
      stored({ data: { submittedAt: "2026-02-01T12:00:00Z" } }),
    );
    expect(done.submitted).toBe(true);
    expect(done.submittedAt).toBe("2026-02-01T12:00:00Z");
  });

  it("trims whitespace around the name and tagline", () => {
    const s = summarizeBudget(
      stored({ data: { name: "  Mayor Ada  ", tagline: "  Vision  " } }),
    );
    expect(s.name).toBe("Mayor Ada");
    expect(s.tagline).toBe("Vision");
  });
});

describe("sortBudgets", () => {
  it("puts drafts before submitted budgets", () => {
    // Drafts are the ones still waiting on the user, so they lead the list.
    const rows = [
      summary({ id: "done", submitted: true }),
      summary({ id: "draft", submitted: false }),
    ];
    expect(sortBudgets(rows).map((b) => b.id)).toEqual(["draft", "done"]);
  });

  it("orders most recently updated first within a group", () => {
    const rows = [
      summary({ id: "old", updatedAt: new Date("2026-01-01T00:00:00Z") }),
      summary({ id: "new", updatedAt: new Date("2026-03-01T00:00:00Z") }),
      summary({ id: "mid", updatedAt: new Date("2026-02-01T00:00:00Z") }),
    ];
    expect(sortBudgets(rows).map((b) => b.id)).toEqual(["new", "mid", "old"]);
  });

  it("applies recency within each group, not across them", () => {
    const rows = [
      summary({
        id: "recent-submitted",
        submitted: true,
        updatedAt: new Date("2026-05-01T00:00:00Z"),
      }),
      summary({
        id: "stale-draft",
        submitted: false,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ];
    expect(sortBudgets(rows).map((b) => b.id)).toEqual([
      "stale-draft",
      "recent-submitted",
    ]);
  });

  it("does not mutate the array it was given", () => {
    const rows = [
      summary({ id: "a", submitted: true }),
      summary({ id: "b", submitted: false }),
    ];
    sortBudgets(rows);
    expect(rows.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("handles an empty list", () => {
    expect(sortBudgets([])).toEqual([]);
  });
});

describe("budgetHref", () => {
  it("sends a draft to the editor", () => {
    expect(budgetHref(summary({ id: "abc12", submitted: false }))).toBe(
      "/budget/abc12/edit",
    );
  });

  it("sends a submitted budget to its final view", () => {
    // The editor redirects submitted budgets away, so linking there would
    // bounce the user through an extra hop.
    expect(budgetHref(summary({ id: "abc12", submitted: true }))).toBe(
      "/budget/abc12",
    );
  });
});
