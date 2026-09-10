import { describe, expect, it } from "vitest";
import { shortId } from "./id";

/** The unambiguous alphabet shortId draws from (no 0/O/1/I/l). */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

describe("shortId", () => {
  it("returns 5 characters by default", () => {
    expect(shortId()).toHaveLength(5);
  });

  it("honours an explicit length", () => {
    expect(shortId(1)).toHaveLength(1);
    expect(shortId(12)).toHaveLength(12);
  });

  it("returns an empty string for a zero length", () => {
    expect(shortId(0)).toBe("");
  });

  it("uses only unambiguous characters", () => {
    // These ids go in URLs people read aloud and retype, so the lookalike
    // characters 0/O/1/I/l must never appear.
    for (let i = 0; i < 200; i++) {
      for (const ch of shortId()) {
        expect(ALPHABET).toContain(ch);
      }
    }
  });

  it("never emits a lookalike character", () => {
    const ids = Array.from({ length: 500 }, () => shortId(8)).join("");
    expect(ids).not.toMatch(/[0O1Il]/);
  });

  it("is random enough to avoid frequent collisions", () => {
    // Not a uniqueness guarantee — /start retries on the rare collision — but
    // a constant or barely-varying id would be a real bug.
    const ids = new Set(Array.from({ length: 1000 }, () => shortId()));
    expect(ids.size).toBeGreaterThan(990);
  });

  it("uses a wide spread of the alphabet", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => shortId(8)).join(""),
    );
    expect(seen.size).toBeGreaterThan(ALPHABET.length * 0.8);
  });
});
