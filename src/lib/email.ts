import { Resend } from "resend";

// Instantiated lazily so a missing key only fails when mail is actually sent.
let client: Resend | null = null;
function resend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  client ??= new Resend(apiKey);
  return client;
}

/** Verified sender; resend.dev works for testing before a domain is set up. */
const FROM = process.env.EMAIL_FROM ?? "Philly Budget <onboarding@resend.dev>";

/**
 * Sends the password reset link produced by Better Auth. In development
 * without a Resend key the link is logged instead, so the flow stays testable.
 */
export async function sendPasswordResetEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    console.log(`[dev] Password reset link for ${to}: ${url}`);
    return;
  }

  const { error } = await resend().emails.send({
    from: FROM,
    to,
    subject: "Reset your password",
    html: `
      <p>Someone requested a password reset for your Philly Budget account.</p>
      <p><a href="${url}">Reset your password</a></p>
      <p>This link expires in one hour. If you didn't ask for it, you can ignore this email.</p>
    `,
    text: `Reset your password: ${url}\n\nThis link expires in one hour. If you didn't ask for it, you can ignore this email.`,
  });

  // The SDK returns errors rather than throwing.
  if (error) throw new Error(`Failed to send reset email: ${error.message}`);
}

/** Absolute base URL for links in notification emails. */
function baseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

/**
 * Sends one notification to every configured admin.
 *
 * Notifications are best-effort: a mail failure must never break the action
 * that triggered it, so this resolves rather than throwing, and logs instead
 * of sending when no Resend key is configured.
 */
async function notifyAdmins({
  subject,
  html,
  text,
}: {
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const { parseAdminEmails } = await import("@/src/lib/admin");
  const to = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (to.length === 0) return;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev] Admin notification to ${to.join(", ")}: ${subject}`);
    return;
  }

  try {
    const { error } = await resend().emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error(`Admin notification failed: ${error.message}`);
    }
  } catch (err) {
    console.error("Admin notification failed:", err);
  }
}

/**
 * Notifies admins the first time someone actually moves money in a budget.
 * Visiting /start creates an empty budget and most are abandoned, so the
 * first allocation — not creation — is the signal worth an email.
 */
export async function notifyBudgetStarted({
  budgetId,
  name,
  changeCount,
}: {
  budgetId: string;
  name?: string;
  changeCount: number;
}): Promise<void> {
  const url = `${baseUrl()}/budget/${budgetId}/edit`;
  const title = name?.trim() || "Untitled budget";
  const depts = `${changeCount} department${changeCount === 1 ? "" : "s"} changed`;
  await notifyAdmins({
    subject: `Budget started: ${title} (${budgetId})`,
    html: `
      <p>Someone started working on <strong>${title}</strong>.</p>
      <p>${depts} so far.</p>
      <p><a href="${url}">${url}</a></p>
    `,
    text: `Someone started working on ${title}.\n${depts} so far.\n\n${url}`,
  });
}

/** Notifies admins that a budget was submitted, with a little context. */
export async function notifyBudgetSubmitted({
  budgetId,
  name,
  tagline,
  changeCount,
}: {
  budgetId: string;
  name?: string;
  tagline?: string;
  changeCount: number;
}): Promise<void> {
  const url = `${baseUrl()}/budget/${budgetId}`;
  const title = name?.trim() || "Untitled budget";
  const depts = `${changeCount} department${changeCount === 1 ? "" : "s"} changed`;
  await notifyAdmins({
    subject: `Budget submitted: ${title} (${budgetId})`,
    html: `
      <p><strong>${title}</strong> was submitted.</p>
      ${tagline?.trim() ? `<p><em>${tagline.trim()}</em></p>` : ""}
      <p>${depts}</p>
      <p><a href="${url}">${url}</a></p>
    `,
    text: `${title} was submitted.\n${tagline?.trim() ? tagline.trim() + "\n" : ""}${depts}\n\n${url}`,
  });
}

/**
 * Escapes text for interpolation into an HTML email body. Feedback is
 * arbitrary text from anonymous visitors, so it must never be trusted as
 * markup in an admin's inbox.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Notifies admins that someone left site feedback. */
export async function notifyFeedbackPosted({
  name,
  email,
  message,
  path,
}: {
  name?: string | null;
  email?: string | null;
  message: string;
  path?: string | null;
}): Promise<void> {
  const from = name?.trim() || "Someone";
  const contact = email?.trim();
  const where = path?.trim();

  await notifyAdmins({
    subject: `New feedback from ${from}`,
    html: `
      <p><strong>${escapeHtml(from)}</strong>${contact ? ` (${escapeHtml(contact)})` : ""} left feedback${where ? ` on <code>${escapeHtml(where)}</code>` : ""}:</p>
      <blockquote style="border-left:3px solid #ccc;margin:0;padding-left:1em;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
      ${contact ? `<p><a href="mailto:${encodeURIComponent(contact)}">Reply to ${escapeHtml(contact)}</a></p>` : "<p>No email address was given, so there is no way to reply.</p>"}
    `,
    text: `${from}${contact ? ` (${contact})` : ""} left feedback${where ? ` on ${where}` : ""}:\n\n${message}\n`,
  });
}
