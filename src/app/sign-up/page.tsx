import { Suspense } from "react";
import { redirect } from "next/navigation";
import SignUpForm from "@/src/components/auth/SignUpForm";
import { cardStyle } from "@/src/components/auth/form-styles";
import { getCurrentUser } from "@/src/lib/session";
import { safeNextPath } from "@/src/lib/next-path";

export const metadata = { title: "Create an account" };

interface SignUpPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNextPath(next));

  return (
    <main style={cardStyle}>
      <h1>Create an account</h1>
      <Suspense>
        <SignUpForm />
      </Suspense>
    </main>
  );
}
