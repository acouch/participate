import { randomInt } from "node:crypto";

// Unambiguous alphabet (no 0/O/1/I/l) for short, human-friendly ids.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

/** Generates a random 5-character short id for budget URLs. */
export function shortId(length = 5): string {
  let id = "";
  for (let i = 0; i < length; i++) {
    id += ALPHABET[randomInt(ALPHABET.length)];
  }
  return id;
}
