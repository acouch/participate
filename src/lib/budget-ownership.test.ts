import { describe, expect, it, vi } from "vitest";
import {
  canEditBudget,
  claimBudgetForUser,
  type BudgetClaimStore,
} from "./budget-ownership";

/** A budget delegate that reports how many rows a guarded update matched. */
function store(matched: number): BudgetClaimStore & {
  updateMany: ReturnType<typeof vi.fn>;
} {
  return { updateMany: vi.fn().mockResolvedValue({ count: matched }) };
}

describe("claimBudgetForUser", () => {
  it("claims an unowned budget for the signed-in user", async () => {
    const budgets = store(1);
    const claimed = await claimBudgetForUser(budgets, {
      budgetId: "abc12",
      currentUserId: "user-1",
      ownerId: null,
    });

    expect(claimed).toBe(true);
    expect(budgets.updateMany).toHaveBeenCalledWith({
      where: { id: "abc12", userId: null },
      data: { userId: "user-1" },
    });
  });

  it("does nothing for a signed-out visitor", async () => {
    const budgets = store(1);
    const claimed = await claimBudgetForUser(budgets, {
      budgetId: "abc12",
      currentUserId: null,
      ownerId: null,
    });

    expect(claimed).toBe(false);
    expect(budgets.updateMany).not.toHaveBeenCalled();
  });

  it("never transfers a budget that someone else already owns", async () => {
    // Budget URLs are short and shareable, so opening someone else's link
    // while signed in must not take their budget.
    const budgets = store(1);
    const claimed = await claimBudgetForUser(budgets, {
      budgetId: "abc12",
      currentUserId: "user-2",
      ownerId: "user-1",
    });

    expect(claimed).toBe(false);
    expect(budgets.updateMany).not.toHaveBeenCalled();
  });

  it("is a no-op when the user already owns the budget", async () => {
    const budgets = store(1);
    const claimed = await claimBudgetForUser(budgets, {
      budgetId: "abc12",
      currentUserId: "user-1",
      ownerId: "user-1",
    });

    expect(claimed).toBe(false);
    expect(budgets.updateMany).not.toHaveBeenCalled();
  });

  it("guards the update on userId so a concurrent claim cannot be overwritten", async () => {
    // The stale read is the whole hazard: two requests both see ownerId null,
    // and only the where-clause guard stops the loser from reassigning it.
    const budgets = store(0);
    await claimBudgetForUser(budgets, {
      budgetId: "abc12",
      currentUserId: "user-2",
      ownerId: null,
    });

    expect(budgets.updateMany.mock.calls[0][0].where).toEqual({
      id: "abc12",
      userId: null,
    });
  });

  it("reports no claim when a concurrent request won the race", async () => {
    // updateMany matching zero rows is the expected outcome here, not an
    // error — a plain update() would throw P2025 and 500 the page.
    const budgets = store(0);
    const claimed = await claimBudgetForUser(budgets, {
      budgetId: "abc12",
      currentUserId: "user-2",
      ownerId: null,
    });

    expect(claimed).toBe(false);
  });

  it("does not swallow real database failures", async () => {
    const budgets: BudgetClaimStore = {
      updateMany: vi.fn().mockRejectedValue(new Error("connection lost")),
    };

    await expect(
      claimBudgetForUser(budgets, {
        budgetId: "abc12",
        currentUserId: "user-1",
        ownerId: null,
      }),
    ).rejects.toThrow("connection lost");
  });
});

describe("canEditBudget", () => {
  it("lets the owner edit their own budget", () => {
    expect(canEditBudget({ currentUserId: "user-1", ownerId: "user-1" })).toBe(
      true,
    );
  });

  it("blocks a different signed-in user", () => {
    // The rule this whole module exists for: budget URLs are short and
    // shareable, so opening someone else's link must not allow edits.
    expect(canEditBudget({ currentUserId: "user-2", ownerId: "user-1" })).toBe(
      false,
    );
  });

  it("blocks a signed-out visitor on an owned budget", () => {
    expect(canEditBudget({ currentUserId: null, ownerId: "user-1" })).toBe(
      false,
    );
  });

  it("leaves unowned budgets open to anyone", () => {
    // Anonymous /start budgets and every budget made before accounts existed
    // have no owner; locking those would strand them.
    expect(canEditBudget({ currentUserId: null, ownerId: null })).toBe(true);
    expect(canEditBudget({ currentUserId: "user-1", ownerId: null })).toBe(
      true,
    );
  });
});

describe("canEditBudget for admins", () => {
  it("lets an admin edit a budget owned by someone else", () => {
    expect(
      canEditBudget({
        currentUserId: "admin-1",
        ownerId: "user-1",
        isAdmin: true,
      }),
    ).toBe(true);
  });

  it("lets an admin edit an unowned budget", () => {
    expect(
      canEditBudget({ currentUserId: "admin-1", ownerId: null, isAdmin: true }),
    ).toBe(true);
  });

  it("still denies a non-admin on someone else's budget", () => {
    // Guards against the flag defaulting to true or leaking across callers.
    expect(
      canEditBudget({
        currentUserId: "user-2",
        ownerId: "user-1",
        isAdmin: false,
      }),
    ).toBe(false);
  });

  it("denies when the flag is omitted entirely", () => {
    expect(canEditBudget({ currentUserId: "user-2", ownerId: "user-1" })).toBe(
      false,
    );
  });
});
