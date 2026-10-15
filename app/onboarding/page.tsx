import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MailOpen } from "lucide-react";
import { getOnboardingState, type PendingInvite } from "@/lib/data/queries/invitations";
import { BrandTile } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { WorkspaceWizard } from "@/components/onboarding/workspace-wizard";

export const metadata: Metadata = {
  title: "Create your workspace",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const state = await getOnboardingState();
  return (
    <div className="mx-auto max-w-[760px]">
      <div className="text-center">
        <p className="text-sm font-medium text-cyan-300">Welcome, {state.user.firstName}</p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">Set up your workspace</h1>
        <p className="mx-auto mt-3 max-w-lg text-pretty text-ink-muted">
          This takes three steps. Your team runs projects in the workspace, and each client gets a portal inside it.
        </p>
      </div>

      {state.pendingInvites.length > 0 && <PendingInvites invites={state.pendingInvites} />}

      <div className="mt-8">
        <WorkspaceWizard defaultTimezone={state.user.timezone} ownEmail={state.user.email} />
      </div>

      {state.existing && (
        <p className="mt-6 text-center text-sm text-ink-muted">
          Not now?{" "}
          <Link href={state.existing.href} className="font-medium text-cyan-300 hover:text-cyan-200">
            Back to {state.existing.name}
          </Link>
        </p>
      )}
    </div>
  );
}

function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  return (
    <section aria-labelledby="pending-title" className="mt-8 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-5">
      <h2 id="pending-title" className="flex items-center gap-2 font-semibold text-ink">
        <MailOpen size={18} className="text-cyan-300" aria-hidden="true" />
        {invites.length === 1 ? "You have an invitation waiting" : `You have ${invites.length} invitations waiting`}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">If you were invited to join a team or a client portal, accept that instead of creating a new workspace.</p>
      <ul className="mt-4 space-y-2">
        {invites.map((invite) => (
          <li key={invite.token} className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#0b1722]/80 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <BrandTile name={invite.orgName} hue={invite.orgHue} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {invite.orgName}
                  <span className="font-normal text-ink-faint"> · {invite.kind === "client" ? "Client portal" : "Team"}</span>
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {invite.roleLabel} · invited by {invite.inviterName} · expires {invite.expiresRelative}
                </p>
              </div>
            </div>
            <Link href={`/invite/${encodeURIComponent(invite.token)}`} className={buttonClasses({ size: "sm", className: "w-full sm:w-auto" })}>
              Review invitation <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OnboardingSkeleton() {
  return (
    <div className="mx-auto max-w-[760px]" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="card mt-8 overflow-hidden">
        <div className="flex gap-4 border-b border-line px-8 py-5">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-8 flex-1" />
          ))}
        </div>
        <div className="space-y-5 p-8">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-[70px]" />
          <Skeleton className="h-[70px]" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-[70px]" />
            <Skeleton className="h-[70px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
