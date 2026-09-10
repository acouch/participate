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
