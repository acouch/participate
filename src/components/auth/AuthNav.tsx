// "use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/src/lib/auth-client";

export interface AuthNavUser {
  name: string;
  email: string;
  /** Admins get a link to the all-budgets page. */
  isAdmin?: boolean;
}

const linkStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#1a3cb9",
};

/** Sign in / sign up links, or the current user's name and a sign-out button. */
export default function AuthNav({ user }: { user: AuthNavUser | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <Link style={linkStyle} href="/featured-budgets">
        Featured budgets
      </Link>
      {user ? (
        <>
          {user.isAdmin && (
            <Link href="/admin" style={linkStyle}>
              Admin
            </Link>
          )}
          <Link href="/account" style={linkStyle}>
            {user.name}
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              ...linkStyle,
              background: "none",
              border: "none",
              padding: 0,
              cursor: signingOut ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </>
      ) : (
        <>
          <Link href="/sign-in" style={linkStyle}>
            Sign in
          </Link>
          <Link href="/sign-up" style={linkStyle}>
            Create account
          </Link>
        </>
      )}
    </div>
  );
}
