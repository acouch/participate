import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const getCurrentUser = vi.fn();

vi.mock("@/src/lib/prisma", () => ({
  prisma: { budget: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/src/lib/session", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const { assertCanEditBudget, getBudgetAccess } =
  await import("./budget-access");

beforeEach(() => {
  findUnique.mockReset();
  getCurrentUser.mockReset();
});

/** Sets up a budget with the given owner and the given signed-in user. */
function scenario(ownerId: string | null, currentUserId: string | null) {
  findUnique.mockResolvedValue({ userId: ownerId });
  getCurrentUser.mockResolvedValue(
    currentUserId ? { id: currentUserId } : null,
  );
}

describe("getBudgetAccess", () => {
  it("allows the owner", async () => {
    scenario("user-1", "user-1");
    const access = await getBudgetAccess("abc12");
    expect(access).toMatchObject({ exists: true, canEdit: true });
  });

  it("denies a different signed-in user", async () => {
    scenario("user-1", "user-2");
    expect(await getBudgetAccess("abc12")).toMatchObject({
      exists: true,
      canEdit: false,
    });
  });

  it("denies a signed-out visitor on an owned budget", async () => {
    scenario("user-1", null);
    expect(await getBudgetAccess("abc12")).toMatchObject({ canEdit: false });
  });

  it("leaves an unowned budget open", async () => {
    scenario(null, null);
    expect(await getBudgetAccess("abc12")).toMatchObject({ canEdit: true });
  });

  it("reports a missing budget rather than allowing it", async () => {
    findUnique.mockResolvedValue(null);
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    expect(await getBudgetAccess("nope1")).toMatchObject({
      exists: false,
      canEdit: false,
    });
  });
});

describe("assertCanEditBudget", () => {
  it("resolves for the owner", async () => {
    scenario("user-1", "user-1");
    await expect(assertCanEditBudget("abc12")).resolves.toBeUndefined();
  });

  it("resolves for anyone on an unowned budget", async () => {
    scenario(null, null);
    await expect(assertCanEditBudget("abc12")).resolves.toBeUndefined();
  });

  it("throws for a different user", async () => {
    // This is the real security boundary: server actions are POST endpoints
    // that take a budget id from the caller, so the page check alone is not
    // enough to stop a direct request.
    scenario("user-1", "user-2");
    await expect(assertCanEditBudget("abc12")).rejects.toThrow(
      "belongs to someone else",
    );
  });

  it("throws for a signed-out caller on an owned budget", async () => {
    scenario("user-1", null);
    await expect(assertCanEditBudget("abc12")).rejects.toThrow(
      "belongs to someone else",
    );
  });

  it("throws for a budget that does not exist", async () => {
    findUnique.mockResolvedValue(null);
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    await expect(assertCanEditBudget("nope1")).rejects.toThrow("not found");
  });
});
