import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "./admin";

describe("parseAdminEmails", () => {
  it("parses a comma-separated list", () => {
    expect(parseAdminEmails("a@x.com,b@y.com")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("tolerates spaces and newlines around entries", () => {
    expect(parseAdminEmails(" a@x.com , b@y.com \n c@z.com ")).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
  });

  it("lowercases addresses so a case mismatch cannot deny an admin", () => {
    expect(parseAdminEmails("Admin@Example.COM")).toEqual([
      "admin@example.com",
    ]);
  });

  it("returns nothing when unset or empty", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails("   ")).toEqual([]);
    expect(parseAdminEmails(",, ,")).toEqual([]);
  });
});

describe("isAdminEmail", () => {
  const LIST = "admin@example.com, second@example.com";

  it("recognizes a listed address", () => {
    expect(isAdminEmail("admin@example.com", LIST)).toBe(true);
    expect(isAdminEmail("second@example.com", LIST)).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isAdminEmail("ADMIN@Example.com", LIST)).toBe(true);
    expect(isAdminEmail("  admin@example.com  ", LIST)).toBe(true);
  });

  it("rejects an address that is not listed", () => {
    expect(isAdminEmail("someone@example.com", LIST)).toBe(false);
  });

  it("rejects when there is no signed-in email", () => {
    expect(isAdminEmail(null, LIST)).toBe(false);
    expect(isAdminEmail(undefined, LIST)).toBe(false);
    expect(isAdminEmail("", LIST)).toBe(false);
  });

  it("grants nobody admin when the list is unset", () => {
    // The default posture must be "no admins" — a missing env var in a new
    // environment must never open every budget up.
    expect(isAdminEmail("admin@example.com", undefined)).toBe(false);
    expect(isAdminEmail("admin@example.com", "")).toBe(false);
  });

  it("does not treat a substring match as membership", () => {
    // "vil@example.com" must not match because it is a substring of the
    // listed address, which a naive includes() on the raw string would allow.
    expect(isAdminEmail("min@example.com", LIST)).toBe(false);
    expect(isAdminEmail("admin@example.com.evil.com", LIST)).toBe(false);
  });
});
