import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, CreditCard, Eye, ShieldCheck, User, UserCheck, Users } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { FormMessage } from "@/components/ui/form";
import { signInAsDemo } from "@/lib/actions/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/data/seed";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_ICONS = {
  usr_alex: Briefcase,
  usr_emma: Users,
  usr_liam: User,
  usr_olivia: CreditCard,
  usr_daniel: UserCheck,
  usr_chris: Eye,
  usr_sam: ShieldCheck,
} as const;

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your workspace or client portal."
      footer={
        <>
          New to Atrium?{" "}
          <Link href="/signup" className="font-medium text-cyan-300 hover:text-cyan-200">
            Create a workspace
          </Link>
        </>
      }
    >
      <Suspense fallback={<SignInForm />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>

      <div className="mt-8">
        <div className="flex items-center gap-3 text-xs text-ink-faint">
          <span className="h-px flex-1 bg-line" />
          Explore with a demo account
          <span className="h-px flex-1 bg-line" />
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = DEMO_ICONS[account.userId];
            return (
              <li key={account.userId}>
                <form action={signInAsDemo}>
                  <input type="hidden" name="userId" value={account.userId} />
                  <button
                    type="submit"
                    className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-cyan-400/30 hover:bg-cyan-500/[0.05]"
                  >
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-cyan-500/10 text-cyan-300">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{account.label}</span>
                      <span className="block truncate text-[11px] text-ink-faint">{account.hint}</span>
                    </span>
                    <ArrowRight size={14} className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-center text-[11px] text-ink-faint">
          Or sign in with any demo email and the password <code className="font-mono text-ink-muted">{DEMO_PASSWORD}</code>.
        </p>
      </div>
    </AuthShell>
  );
}

async function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : undefined;
  return (
    <>
      {query.signedOut && (
        <FormMessage tone="success" className="mb-5">
          You&apos;ve been signed out.
        </FormMessage>
      )}
      {query.error === "demo" && <FormMessage className="mb-5">That demo account isn&apos;t available.</FormMessage>}
      <SignInForm next={next} />
    </>
  );
}
