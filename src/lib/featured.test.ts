import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin";

/**
 * setBudgetFeatured gates on isAdmin, so these pin the rule that curation is
 * admin-only. The action itself needs a request context to run; the admin
 * check is the part that decides who may feature a budget.
 */
describe("featuring is admin-only", () => {
  const LIST = "admin@example.com";

  it("allows a configured admin", () => {
    expect(isAdminEmail("admin@example.com", LIST)).toBe(true);
  });

  it("denies an ordinary signed-in user", () => {
    // A budget's own author must not be able to feature their work.
    expect(isAdminEmail("author@example.com", LIST)).toBe(false);
  });

  it("denies a signed-out visitor", () => {
    expect(isAdminEmail(null, LIST)).toBe(false);
  });

  it("denies everyone when no admins are configured", () => {
    expect(isAdminEmail("admin@example.com", undefined)).toBe(false);
  });
});
