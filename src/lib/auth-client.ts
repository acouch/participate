import { createAuthClient } from "better-auth/react";

// baseURL is inferred from the current origin when unset, which is what we
// want on Vercel preview deployments.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
