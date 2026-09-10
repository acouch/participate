import { describe, expect, it } from "vitest";
import {
  budgetHref,
  matchesChanged,
  matchesOwner,
  matchesStatus,
  DEFAULT_SORT_DIRECTION,
  sortBudgets,
  sortBudgetsBy,
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
    featured: false,
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

  it("reports whether an admin featured the budget", () => {
    expect(summarizeBudget(stored({ featuredAt: null })).featured).toBe(false);
    expect(summarizeBudget(stored({})).featured).toBe(false);
    expect(
      summarizeBudget(stored({ featuredAt: new Date("2026-04-01") })).featured,
    ).toBe(true);
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

describe("sortBudgetsBy", () => {
  const rows: BudgetSummary[] = [
    summary({
      id: "beta",
      name: "Beta plan",
      submitted: false,
      changeCount: 5,
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    }),
    summary({
      id: "alpha",
      name: "alpha plan",
      submitted: true,
      changeCount: 12,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }),
    summary({
      id: "gamma",
      name: "Gamma plan",
      submitted: false,
      changeCount: 0,
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    }),
  ];

  it("sorts by name, ignoring case", () => {
    // "alpha" is lowercase; a case-sensitive sort would push it after the
    // capitalized names instead of first.
    expect(sortBudgetsBy(rows, "name", "asc").map((b) => b.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(sortBudgetsBy(rows, "name", "desc").map((b) => b.id)).toEqual([
      "gamma",
      "beta",
      "alpha",
    ]);
  });

  it("sorts by status with drafts first when ascending", () => {
    const ids = sortBudgetsBy(rows, "status", "asc").map((b) => b.id);
    expect(ids[ids.length - 1]).toBe("alpha");
    expect(sortBudgetsBy(rows, "status", "desc").map((b) => b.id)[0]).toBe(
      "alpha",
    );
  });

  it("sorts by number of departments changed", () => {
    expect(sortBudgetsBy(rows, "changed", "desc").map((b) => b.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(sortBudgetsBy(rows, "changed", "asc").map((b) => b.id)).toEqual([
      "gamma",
      "beta",
      "alpha",
    ]);
  });

  it("sorts by last updated", () => {
    expect(sortBudgetsBy(rows, "updated", "desc").map((b) => b.id)).toEqual([
      "gamma",
      "beta",
      "alpha",
    ]);
    expect(sortBudgetsBy(rows, "updated", "asc").map((b) => b.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("breaks ties by most recently updated", () => {
    // Every row has the same change count, so only the tiebreak decides.
    const tied = [
      summary({ id: "old", changeCount: 3, updatedAt: new Date("2026-01-01") }),
      summary({ id: "new", changeCount: 3, updatedAt: new Date("2026-05-01") }),
      summary({ id: "mid", changeCount: 3, updatedAt: new Date("2026-03-01") }),
    ];
    expect(sortBudgetsBy(tied, "changed", "asc").map((b) => b.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("does not mutate the input array", () => {
    const before = rows.map((b) => b.id);
    sortBudgetsBy(rows, "name", "asc");
    expect(rows.map((b) => b.id)).toEqual(before);
  });

  it("handles an empty list", () => {
    expect(sortBudgetsBy([], "updated", "desc")).toEqual([]);
  });

  it("starts text ascending and numeric columns descending", () => {
    // Clicking "Changed" should show the busiest budgets first, not the empty
    // ones; clicking "Budget" should read A-Z.
    expect(DEFAULT_SORT_DIRECTION.name).toBe("asc");
    expect(DEFAULT_SORT_DIRECTION.status).toBe("asc");
    expect(DEFAULT_SORT_DIRECTION.changed).toBe("desc");
    expect(DEFAULT_SORT_DIRECTION.updated).toBe("desc");
  });
});

describe("matchesStatus", () => {
  const draft = summary({ submitted: false });
  const done = summary({ submitted: true });

  it("passes everything when set to all", () => {
    expect(matchesStatus(draft, "all")).toBe(true);
    expect(matchesStatus(done, "all")).toBe(true);
  });

  it("selects only drafts", () => {
    expect(matchesStatus(draft, "draft")).toBe(true);
    expect(matchesStatus(done, "draft")).toBe(false);
  });

  it("selects only submitted budgets", () => {
    expect(matchesStatus(done, "submitted")).toBe(true);
    expect(matchesStatus(draft, "submitted")).toBe(false);
  });
});

describe("matchesChanged", () => {
  const untouched = summary({ changeCount: 0 });
  const edited = summary({ changeCount: 4 });

  it("passes everything when set to all", () => {
    expect(matchesChanged(untouched, "all")).toBe(true);
    expect(matchesChanged(edited, "all")).toBe(true);
  });

  it("selects budgets with no changes", () => {
    expect(matchesChanged(untouched, "none")).toBe(true);
    expect(matchesChanged(edited, "none")).toBe(false);
  });

  it("selects budgets with at least one change", () => {
    // The useful admin view: budgets someone actually worked on.
    expect(matchesChanged(edited, "some")).toBe(true);
    expect(matchesChanged(untouched, "some")).toBe(false);
  });
});

describe("matchesOwner", () => {
  it("passes everything when set to all", () => {
    expect(matchesOwner("a@x.com", "all")).toBe(true);
    expect(matchesOwner(null, "all")).toBe(true);
  });

  it("selects unowned budgets with the anonymous filter", () => {
    expect(matchesOwner(null, "anonymous")).toBe(true);
    expect(matchesOwner("a@x.com", "anonymous")).toBe(false);
  });

  it("matches an exact owner email, ignoring case", () => {
    expect(matchesOwner("A@X.com", "a@x.com")).toBe(true);
    expect(matchesOwner("a@x.com", "b@y.com")).toBe(false);
  });

  it("does not match an unowned budget against a real address", () => {
    expect(matchesOwner(null, "a@x.com")).toBe(false);
  });
});
