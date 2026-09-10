import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";

/**
 * Reads the signed-in user in a server component or server action.
 * Returns null when nobody is signed in — nothing is gated on this yet.
 */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
