import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Ban, CalendarX2, CheckCircle2, MailQuestion, SearchX, type LucideIcon } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { getInvitationPreview, type InvitationPreview } from "@/lib/data/queries/invitations";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { BrandTile } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense
      fallback={
        <AuthShell title="Checking your invitation…">
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-12" />
          </div>
        </AuthShell>
      }
    >
      <Invitation params={params} />
    </Suspense>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInvitationPreview(token);

  if (!invite) {
    return (
      <AuthShell
        title="Invitation not found"
        description="This link doesn't match an invitation. It may have been copied incompletely, or the invitation was deleted."
        footer={<HomeLink />}
      >
        <StateIcon icon={SearchX} tone="slate" />
        <p className="mt-5 text-center text-sm leading-relaxed text-ink-muted">
          Open the link straight from your invitation email, or ask the person who invited you to send a new one.
        </p>
        <Link href="/login" className={buttonClasses({ variant: "outline", size: "lg", className: "mt-6 w-full" })}>
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  const invitePath = `/invite/${encodeURIComponent(invite.token)}`;

  if (invite.state === "expired") {
    return (
      <AuthShell
        title="This invitation has expired"
        description={`Invitations stay open for 7 days. Ask ${invite.inviterName} at ${invite.orgName} to send you a new one.`}
        footer={<HomeLink />}
      >
        <InviteSummary invite={invite} />
        <p className="mt-5 flex items-center justify-center gap-2 text-sm text-ink-muted">
          <CalendarX2 size={16} className="text-ink-faint" aria-hidden="true" />
          Expired on {formatDate(invite.expiresAt)}
        </p>
      </AuthShell>
    );
  }

  if (invite.state === "revoked") {
    return (
      <AuthShell
        title="This invitation was withdrawn"
        description={`${invite.orgName} cancelled this invitation, so it can't be used. If you think that's a mistake, contact ${invite.inviterName}.`}
        footer={<HomeLink />}
      >
        <StateIcon icon={Ban} tone="red" />
        <InviteSummary invite={invite} className="mt-6" />
      </AuthShell>
    );
  }

  if (invite.state === "accepted") {
    return (
      <AuthShell
        title="This invitation has already been used"
        description={
          invite.viewer?.memberHome
            ? `You already have access to ${invite.orgName}, so there's nothing left to do here.`
            : `Someone has already accepted this invitation to ${invite.orgName}. If that was you, sign in to continue.`
        }
        footer={<HomeLink />}
      >
        <StateIcon icon={CheckCircle2} tone="emerald" />
        {invite.viewer?.memberHome ? (
          <Link href={invite.viewer.memberHome} className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}>
            Open {invite.orgName}
          </Link>
        ) : (
          <Link href="/login" className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}>
            Sign in
          </Link>
        )}
      </AuthShell>
    );
  }

  const where = invite.kind === "client" ? `the ${invite.orgName} client portal` : invite.orgName;

  return (
    <AuthShell
      title={invite.kind === "client" ? `Review work with ${invite.orgName}` : `Join ${invite.orgName}`}
      description={`${invite.inviterName} invited you to ${where} as ${/^[aeiou]/i.test(invite.roleLabel) ? "an" : "a"} ${invite.roleLabel.toLowerCase()}.`}
      footer={<HomeLink />}
    >
      <InviteSummary invite={invite} showExpiry />
      <div className="mt-6">
        {!invite.viewer ? (
          <>
            <p className="text-sm leading-relaxed text-ink-muted">
              To accept, sign in or create an account with the email address this invitation was sent to.
            </p>
            <div className="mt-5 grid gap-3">
              <Link href={`/login?next=${encodeURIComponent(invitePath)}`} className={buttonClasses({ size: "lg" })}>
                Sign in to accept
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(invitePath)}`} className={buttonClasses({ variant: "outline", size: "lg" })}>
                Create an account
              </Link>
            </div>
          </>
        ) : invite.viewer.memberHome ? (
          <>
            <p className="text-sm leading-relaxed text-ink-muted">You already have access to {where}. There&apos;s nothing else to do.</p>
            <Link href={invite.viewer.memberHome} className={buttonClasses({ size: "lg", className: "mt-5 w-full" })}>
              Open {invite.orgName}
            </Link>
          </>
        ) : invite.viewer.emailMatches ? (
          <>
            <p className="mb-4 text-center text-xs text-ink-faint">
              Signed in as <span className="text-ink-secondary">{invite.viewer.email}</span>
            </p>
            <AcceptInvitationForm token={invite.token} orgName={invite.orgName} />
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100/90" role="note">
              <MailQuestion size={17} className="mt-0.5 flex-none text-amber-300" aria-hidden="true" />
              <p>
                You&apos;re signed in as <span className="font-medium text-amber-50">{invite.viewer.email}</span>, but this invitation was
                sent to a different email address. Sign in with that address to accept it.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              <Link href={`/login?next=${encodeURIComponent(invitePath)}`} className={buttonClasses({ size: "lg" })}>
                Sign in with another account
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(invitePath)}`} className={buttonClasses({ variant: "outline", size: "lg" })}>
                Create an account
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}

function InviteSummary({ invite, showExpiry = false, className }: { invite: InvitationPreview; showExpiry?: boolean; className?: string }) {
  const rows = [
    { label: "Access", value: invite.kind === "client" ? "Client portal" : "Team workspace" },
    { label: "Role", value: invite.roleLabel },
    { label: "Invited by", value: invite.inviterName },
    ...(showExpiry ? [{ label: "Expires", value: `${formatDate(invite.expiresAt)} (${invite.expiresRelative})` }] : []),
  ];
  return (
    <div className={cn("rounded-xl border border-white/[0.08] bg-white/[0.02]", className)}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
        <BrandTile name={invite.orgName} hue={invite.orgHue} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{invite.orgName}</p>
          <p className="text-xs text-ink-faint">{invite.kind === "client" ? "Client portal on Atrium" : "Workspace on Atrium"}</p>
        </div>
      </div>
      <dl className="divide-y divide-white/[0.05] px-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-ink-faint">{row.label}</dt>
            <dd className="text-right text-ink-secondary">{row.value}</dd>
          </div>
        ))}
      </dl>
      {invite.roleDescription && <p className="border-t border-white/[0.06] px-4 py-3 text-xs leading-relaxed text-ink-muted">{invite.roleDescription}</p>}
    </div>
  );
}

const TONES = {
  slate: "border-white/10 bg-white/[0.04] text-ink-muted",
  red: "border-red-400/25 bg-red-500/10 text-red-300",
  emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
};

function StateIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: keyof typeof TONES }) {
  return (
    <span className={cn("mx-auto grid h-14 w-14 place-items-center rounded-2xl border", TONES[tone])}>
      <Icon size={26} aria-hidden="true" />
    </span>
  );
}

function HomeLink() {
  return (
    <>
      Want to know what Atrium is?{" "}
      <Link href="/" className="font-medium text-cyan-300 hover:text-cyan-200">
        Visit the homepage
      </Link>
    </>
  );
}
