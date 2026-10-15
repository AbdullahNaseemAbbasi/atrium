import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getInviteForm } from "@/lib/data/queries/team";
import { inviteMembers } from "@/lib/actions/team";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { CardSkeleton, PageHeader, ProgressBar } from "@/components/ui/misc";
import { InviteForm } from "@/components/team/invite-form";

export const metadata: Metadata = { title: "Invite people" };

export default function InvitePage({ params }: PageProps<"/w/[org]/team/invite">) {
  return (
    <Suspense fallback={<CardSkeleton className="mt-8" lines={6} />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getInviteForm(org);
  const { usage } = data;
  const used = usage.members + usage.pending;
  const seatsLeft = usage.limit.limit === null ? null : Math.max(usage.limit.limit - used, 0);

  return (
    <>
      <PageHeader
        title="Invite people"
        description={`Add teammates to ${data.orgName}. Each invitation link is valid for 7 days.`}
        breadcrumbs={[{ label: "Team", href: `${data.base}/team` }, { label: "Invite people" }]}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="p-5 sm:p-7">
          {seatsLeft === 0 && (
            <FormMessage className="mb-6">
              All {usage.limit.limit} seats on your {usage.planName} plan are taken. Revoke a pending invitation, remove someone, or{" "}
              <Link href={`${data.base}/billing`} className="underline">
                upgrade your plan
              </Link>
              .
            </FormMessage>
          )}
          <InviteForm
            action={inviteMembers.bind(null, data.orgSlug)}
            roleOptions={data.roleOptions}
            defaultRole={data.defaultRole}
            seatsLeft={seatsLeft}
            footer={
              <Link href={`${data.base}/team`} className={buttonClasses({ variant: "ghost", size: "lg" })}>
                Cancel
              </Link>
            }
          />
        </Card>
        <aside className="space-y-4">
          <Card className="p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">Seats</p>
            {usage.limit.limit === null ? (
              <p className="mt-2">
                {used} in use · unlimited on {usage.planName}.
              </p>
            ) : (
              <>
                <p className="mt-2">
                  {used} of {usage.limit.limit} seats in use on {usage.planName}
                  {usage.pending > 0 && ` (including ${usage.pending} pending ${usage.pending === 1 ? "invitation" : "invitations"})`}.{" "}
                  <span className={seatsLeft === 0 ? "text-amber-300" : "text-ink-secondary"}>
                    {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} left.
                  </span>
                </p>
                <ProgressBar value={Math.round((used / usage.limit.limit) * 100)} label="Seats used" tone={seatsLeft === 0 ? "amber" : "cyan"} className="mt-3" />
              </>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck size={17} className="text-cyan-300" aria-hidden="true" /> Who can invite whom
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li>Owners can invite any role, including other owners.</li>
              <li>Managers can invite team members.</li>
              <li>Client contacts are invited from their client page.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
