import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a link to reset your Atrium password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter the email you sign in with. If it matches an account, we'll send a reset link that works for 30 minutes."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
