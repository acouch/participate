"use server";

import { prisma } from "@/src/lib/prisma";

export interface FeedbackResult {
  ok: boolean;
  error?: string;
}

/**
 * Stores a piece of site feedback. Name and email are optional; the message
 * is required. `path` records where on the site the feedback was left.
 */
export async function submitFeedback(fields: {
  name?: string;
  email?: string;
  message: string;
  path?: string;
}): Promise<FeedbackResult> {
  const message = fields.message?.trim() ?? "";
  if (!message) {
    return { ok: false, error: "Please enter your feedback before sending." };
  }
  if (message.length > 5000) {
    return { ok: false, error: "Feedback is too long (5000 characters max)." };
  }

  const email = fields.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }

  const name = fields.name?.trim() || null;
  const path = fields.path?.trim() || null;

  try {
    await prisma.feedback.create({
      data: { name, email, message, path },
    });
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
