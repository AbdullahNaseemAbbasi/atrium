import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Atrium account.",
};

const footer = (
  <>
    Changed your mind?{" "}
    <Link href="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
      Back to sign in
    </Link>
  </>
);

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <Suspense
      fallback={
        <AuthShell title="Choose a new password" footer={footer}>
          <div className="space-y-5" aria-busy="true">
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[70px]" />
            <Skeleton className="h-12" />
          </div>
        </AuthShell>
      }
    >
      <ResetPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPassword({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const raw = Array.isArray(query.token) ? query.token[0] : query.token;
  const token = raw?.trim();

  if (!token || token.length > 200) {
    return (
      <AuthShell
        title="This reset link isn't valid"
        description="The link is incomplete or has already been used. Reset links work once and expire after 30 minutes."
        footer={footer}
      >
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
            <LinkIcon size={24} aria-hidden="true" />
          </span>
          <p className="mt-5 text-sm leading-relaxed text-ink-muted">
            Request a new link and open it from the most recent email. If you copied the link by hand, check that nothing was cut off.
          </p>
          <Link href="/forgot-password" className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}>
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Pick something you don't use anywhere else. You'll sign in with it next." footer={footer}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
