/**
 * Validates a `?next=` redirect target. Only same-site absolute paths are
 * allowed — anything else (protocol-relative "//evil.com", a full URL) would
 * let the auth pages be used as an open redirect.
 */
export function safeNextPath(next: string | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
