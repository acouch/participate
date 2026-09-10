/**
 * Admins are configured by environment variable, not stored in the database:
 *
 *   ADMIN_EMAILS="you@example.com, someone@example.com"
 *
 * Keeping the list out of the database means a write to the user table can
 * never promote anyone — changing who is an admin takes a deploy.
 */

/** Parses the ADMIN_EMAILS list into normalized addresses. */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== "");
}

/**
 * Whether an email is on the admin allowlist. Comparison is case-insensitive
 * because email addresses are, and a case mismatch would silently deny.
 */
export function isAdminEmail(
  email: string | null | undefined,
  raw: string | undefined,
): boolean {
  if (!email) return false;
  const allowed = parseAdminEmails(raw);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/** Whether the given email is an admin in this deployment. */
export function isAdmin(email: string | null | undefined): boolean {
  return isAdminEmail(email, process.env.ADMIN_EMAILS);
}
