import { Suspense } from "react";
import ResetPasswordForm from "@/src/components/auth/ResetPasswordForm";
import { cardStyle } from "@/src/components/auth/form-styles";

export const metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <main style={cardStyle}>
      <h1>Set a new password</h1>
      {/* ResetPasswordForm reads the ?token= param via useSearchParams. */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
