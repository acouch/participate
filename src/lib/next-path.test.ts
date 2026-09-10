import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps a same-site path", () => {
    expect(safeNextPath("/budget/abc12/edit")).toBe("/budget/abc12/edit");
    expect(safeNextPath("/")).toBe("/");
  });

  it("falls back when there is no target", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("honours a custom fallback", () => {
    expect(safeNextPath(undefined, "/sign-in")).toBe("/sign-in");
    expect(safeNextPath("https://evil.example.com", "/sign-in")).toBe(
      "/sign-in",
    );
  });

  it("rejects absolute URLs", () => {
    // The whole point of the helper: ?next= comes from the query string, so an
    // attacker-supplied URL must never become a redirect target.
    expect(safeNextPath("https://evil.example.com/pwn")).toBe("/");
    expect(safeNextPath("http://evil.example.com")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    // "//evil.com" is a valid absolute URL to the browser despite the leading
    // slash — the case a naive startsWith("/") check would let through.
    expect(safeNextPath("//evil.example.com")).toBe("/");
    expect(safeNextPath("//evil.example.com/path")).toBe("/");
  });

  it("rejects targets that are not rooted paths", () => {
    expect(safeNextPath("budget/abc12/edit")).toBe("/");
    expect(safeNextPath("../admin")).toBe("/");
  });

  it("rejects non-http schemes", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("data:text/html,<script>alert(1)</script>")).toBe("/");
  });

  it("preserves query strings and fragments on an allowed path", () => {
    expect(safeNextPath("/budget/abc12/edit?step=2")).toBe(
      "/budget/abc12/edit?step=2",
    );
    expect(safeNextPath("/sign-in?reset=1#top")).toBe("/sign-in?reset=1#top");
  });
});
