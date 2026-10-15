import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Info, Lock, MailPlus, UserPlus, Users } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { getTeam, type MemberRow, type TeamPage as TeamData } from "@/lib/data/queries/team";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { OrgRole } from "@/lib/data/types";
import type { Tone } from "@/lib/domain/labels";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, InvitationStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, FormNote, PageHeader, ProgressBar, Skeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { FlashToast } from "@/components/ui/flash-toast";
import { MemberRoleSelect, RemoveMemberButton, TeamInvitationActions } from "@/components/team/member-actions";

export const metadata: Metadata = { title: "Team" };

const ROLE_TONE: Record<OrgRole, Tone> = { owner: "amber", manager: "cyan", member: "slate", billing: "violet" };

export default function TeamPage({ params }: PageProps<"/w/[org]/team">) {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <Team params={params} />
    </Suspense>
  );
}

async function Team({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getTeam(org);
  const { usage } = data;
  const used = usage.members + usage.pending;
  const usedPercent = usage.limit.limit ? Math.round((used / usage.limit.limit) * 100) : 0;
  const full = usage.limit.limit !== null && used >= usage.limit.limit;

  return (
    <>
      <FlashToast messages={{ invited: "Invitations sent. They'll get an email with a link to join." }} />
      <PageHeader
        title="Team"
        description={`The people in ${data.orgName}, their roles and pending invitations.`}
        actions={
          data.can.invite && (
            <Link href={`${data.base}/team/invite`} className={buttonClasses({ size: "lg" })}>
              <UserPlus size={17} /> Invite people
            </Link>
          )
        }
      />

      {!data.can.invite && (
        <FormNote icon={Info} className="mb-4">
          You can see who&apos;s on the team. Owners and managers send invitations and change roles.
        </FormNote>
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 lg:w-[380px]">
            <p className="text-sm font-medium text-ink-secondary">Seats</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {used}
              <span className="text-base font-normal text-ink-faint">{usage.limit.limit === null ? " used · unlimited" : ` of ${usage.limit.limit}`}</span>
            </p>
            {usage.limit.limit !== null && (
              <ProgressBar value={usedPercent} label="Seats used" tone={full ? "amber" : "cyan"} className="mt-2" />
            )}
            <p className={cn("mt-2 text-xs", full ? "text-amber-300" : "text-ink-faint")}>
              {usage.members} {usage.members === 1 ? "member" : "members"}
              {usage.pending > 0 && ` + ${usage.pending} pending ${usage.pending === 1 ? "invitation" : "invitations"}`} on the {usage.planName} plan.
              {full && " All seats are taken."}
            </p>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 lg:border-l lg:border-line lg:pl-5">
            {(Object.keys(ROLE_LABELS) as OrgRole[]).map((role) => (
              <div key={role} className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
                <dt className="truncate text-xs text-ink-faint">{ROLE_LABELS[role]}s</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{data.roleCounts[role]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader icon={Users} title="Members" description={data.can.manageRoles ? "Change roles inline. Every change is written to the audit log." : "Roles decide what each person can see and do."} />
        <MembersTable data={data} />
        <MemberCards data={data} />
      </Card>

      <Card className="mt-4">
        <CardHeader
          icon={MailPlus}
          title="Invitations"
          description="Pending invitations hold a seat for 7 days. Expired ones free it again."
          action={
            data.can.invite &&
            data.invitations.length > 0 && (
              <Link href={`${data.base}/team/invite`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <UserPlus size={14} /> Invite more
              </Link>
            )
          }
        />
        {data.invitations.length === 0 ? (
          <EmptyState
            compact
            icon={MailPlus}
            title="No open invitations"
            description={data.can.invite ? "Invite teammates by email. They'll join with the role you pick." : "When someone is invited, they show up here until they join."}
            action={
              data.can.invite && (
                <Link href={`${data.base}/team/invite`} className={buttonClasses()}>
                  <UserPlus size={16} /> Invite people
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.05] px-4 pb-3 sm:px-5">
            {data.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-dashed border-line-strong text-ink-faint" aria-hidden="true">
                    <MailPlus size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{invitation.email}</p>
                    <p className="text-xs text-ink-faint">
                      {invitation.roleLabel} · invited by {invitation.invitedBy} {invitation.sentText}
                    </p>
                    <p className={cn("text-[11px]", invitation.status === "expired" ? "text-amber-300/90" : "text-ink-faint")}>
                      {invitation.status === "expired" ? `Expired ${invitation.expiresText}` : `Expires ${invitation.expiresText}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pl-12 sm:justify-end sm:pl-0">
                  <InvitationStatusBadge status={invitation.status} />
                  {invitation.canManage && (
                    <TeamInvitationActions orgSlug={data.orgSlug} invitationId={invitation.id} email={invitation.email} expired={invitation.status === "expired"} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function RoleCell({ data, member }: { data: TeamData; member: MemberRow }) {
  if (member.roleChoices.length > 0) {
    return <MemberRoleSelect orgSlug={data.orgSlug} membershipId={member.membershipId} name={member.user.name} role={member.role} choices={member.roleChoices} />;
  }
  return (
    <span className="inline-flex items-center gap-1.5" title={data.can.manageRoles && member.lockReason ? member.lockReason : undefined}>
      <Badge tone={ROLE_TONE[member.role]}>{member.roleLabel}</Badge>
      {data.can.manageRoles && member.lockReason && <Lock size={12} className="text-ink-faint" aria-label={member.lockReason} />}
    </span>
  );
}

function MemberIdentity({ member }: { member: MemberRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex-none">
        <Avatar user={member.user} size="md" />
        {member.online && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-emerald-400" aria-label="Online now" />
        )}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium text-ink">
          <span className="truncate">{member.user.name}</span>
          {member.isSelf && <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[11px] font-medium text-cyan-200">You</span>}
        </p>
        <p className="truncate text-xs text-ink-faint">{member.user.email}</p>
      </div>
    </div>
  );
}

function MembersTable({ data }: { data: TeamData }) {
  return (
    <TableWrap className="hidden md:block">
      <Table className="min-w-[900px]">
        <THead>
          <Th>Member</Th>
          <Th>Title</Th>
          <Th>Role</Th>
          <Th>Projects</Th>
          <Th>Last active</Th>
          <Th>Joined</Th>
          <Th className="text-right">
            <span className="sr-only">Actions</span>
          </Th>
        </THead>
        <tbody>
          {data.members.map((member) => (
            <Tr key={member.membershipId}>
              <Td className="max-w-[280px]">
                <MemberIdentity member={member} />
              </Td>
              <Td className="max-w-[200px] truncate text-xs">{member.user.title ?? "Not set"}</Td>
              <Td>
                <RoleCell data={data} member={member} />
              </Td>
              <Td className="whitespace-nowrap tabular-nums">
                {member.role === "billing" ? (
                  <span className="text-xs text-ink-faint">No project access</span>
                ) : (
                  <>
                    <span className="text-ink-secondary">{member.projects}</span>
                    {member.leads > 0 && <span className="ml-1.5 text-xs text-ink-faint">· leads {member.leads}</span>}
                  </>
                )}
              </Td>
              <Td className={cn("whitespace-nowrap text-xs", member.online && "text-emerald-300")}>{member.online ? "Online now" : member.lastActiveText}</Td>
              <Td className="whitespace-nowrap text-xs">{formatDate(member.joinedAt)}</Td>
              <Td className="text-right">
                {member.canRemove ? (
                  <RemoveMemberButton orgSlug={data.orgSlug} membershipId={member.membershipId} name={member.user.name} projects={member.projects} leads={member.leads} />
                ) : (
                  <span className="sr-only">No actions</span>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function MemberCards({ data }: { data: TeamData }) {
  return (
    <ul className="divide-y divide-white/[0.05] md:hidden">
      {data.members.map((member) => (
        <li key={member.membershipId} className="space-y-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <MemberIdentity member={member} />
            {member.canRemove && (
              <RemoveMemberButton orgSlug={data.orgSlug} membershipId={member.membershipId} name={member.user.name} projects={member.projects} leads={member.leads} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-12 text-xs text-ink-faint">
            <RoleCell data={data} member={member} />
            <span>{member.role === "billing" ? "No project access" : `${member.projects} ${member.projects === 1 ? "project" : "projects"}`}</span>
            <span className={member.online ? "text-emerald-300" : undefined}>{member.online ? "Online now" : `Active ${member.lastActiveText}`}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TeamSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[128px] rounded-2xl" />
      <div className="card mt-4 space-y-3 p-5">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
