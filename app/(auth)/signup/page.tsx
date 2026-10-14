import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { FormMessage } from "@/components/ui/form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create an Atrium account and set up a workspace for your agency. Free on the Starter plan.",
};

/** Only same-site relative paths are passed through as `next`. */
function safeNext(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

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
      <Suspense fallback={<SignUpForm />}>
        <SignUpWithContext searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignUpWithContext({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeNext(query.next);
  const fromInvite = next?.startsWith("/invite/");
  return (
    <>
      {fromInvite && (
        <FormMessage tone="success" className="mb-5">
          Use the email address your invitation was sent to. After creating your account you&apos;ll see the invitation waiting for you.
        </FormMessage>
      )}
      <SignUpForm next={next} />
    </>
  );
}
