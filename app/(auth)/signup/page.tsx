import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { NextField } from "@/components/auth/next-field";
import { safeNext } from "@/lib/auth/safe-next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { FormMessage } from "@/components/ui/form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create an Atrium account and set up a workspace for your agency. Free on the Starter plan.",
};

export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell
      title="Create your account"
      description="Start on the free Starter plan. You'll set up your workspace next, and invite clients whenever you're ready."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <InviteNotice searchParams={searchParams} />
      </Suspense>
      <SignUpForm
        nextField={
          <Suspense fallback={null}>
            <NextField searchParams={searchParams} />
          </Suspense>
        }
      />
    </AuthShell>
  );
}

async function InviteNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  if (!next?.startsWith("/invite/")) return null;
  return (
    <FormMessage tone="success" className="mb-5">
      Use the email address your invitation was sent to. After creating your account you&apos;ll see the invitation waiting for you.
    </FormMessage>
  );
}
