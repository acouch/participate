import ForgotPasswordForm from "@/src/components/auth/ForgotPasswordForm";
import { cardStyle } from "@/src/components/auth/form-styles";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <main style={cardStyle}>
      <h1>Reset your password</h1>
      <ForgotPasswordForm />
    </main>
  );
}
