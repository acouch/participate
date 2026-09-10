import { Suspense } from "react";
import { redirect } from "next/navigation";
import SignInForm from "@/src/components/auth/SignInForm";
import { cardStyle, noticeStyle } from "@/src/components/auth/form-styles";
import { getCurrentUser } from "@/src/lib/session";
import { safeNextPath } from "@/src/lib/next-path";

export const metadata = { title: "Sign in" };

interface SignInPageProps {
  searchParams: Promise<{ reset?: string; next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { reset, next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNextPath(next));

  return (
    <main style={cardStyle}>
      <h1>Sign in</h1>
      {reset === "1" && (
        <p style={noticeStyle}>
          Your password has been updated. Sign in with your new password.
        </p>
      )}
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
