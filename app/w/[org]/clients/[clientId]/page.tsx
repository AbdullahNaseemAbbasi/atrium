import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Clock3,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  Globe,
  Mail,
  MailPlus,
  NotebookPen,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { getClientDetail, type ClientDetail } from "@/lib/data/queries/clients";
import { CLIENT_ROLE_LABELS } from "@/lib/auth/permissions";
import { Card, CardHeader, IconBox } from "@/components/ui/card";
import { Badge, ClientStatusBadge, InvitationStatusBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { Avatar, BrandTile } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Breadcrumbs, CardSkeleton, EmptyState, ProgressBar, Skeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { FlashToast } from "@/components/ui/flash-toast";
import { ProjectIcon } from "@/components/projects/project-icon";
import { InvitePortalUserButton } from "@/components/clients/invite-portal-user";
import { ClientInvitationActions, PortalAccessButton, PortalRoleSelect } from "@/components/clients/portal-user-actions";
import { ClientActivity } from "@/components/clients/client-activity";

export const metadata: Metadata = { title: "Client" };

export default function ClientPage({ params }: PageProps<"/w/[org]/clients/[clientId]">) {
  return (
    <Suspense fallback={<ClientSkeleton />}>
      <ClientOverview params={params} />
    </Suspense>
  );
}

async function ClientOverview({ params }: { params: Promise<{ org: string; clientId: string }> }) {
  const { org, clientId } = await params;
  const data = await getClientDetail(org, clientId);
  const { client } = data;

  return (
    <>
      <FlashToast messages={{ created: "Client added. Invite their reviewers next.", saved: "Client saved." }} />
      <section className="pb-5 pt-7">
        <Breadcrumbs items={[{ label: "Clients", href: `${data.base}/clients` }, { label: client.companyName }]} />
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <BrandTile name={client.companyName} hue={client.brandHue} size="lg" className="h-14 w-14 rounded-2xl text-lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-words text-3xl font-bold tracking-tight text-ink">{client.companyName}</h1>
                <ClientStatusBadge status={client.status} />
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">
                {client.industry} · Client since {formatDate(client.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {data.can.manage && (
              <Link href={`${data.base}/clients/${client.id}/edit`} className={buttonClasses({ variant: "outline" })}>
                <Pencil size={15} /> Edit client
              </Link>
            )}
            {data.can.manageAccess && client.status !== "archived" && (
              <InvitePortalUserButton orgSlug={data.orgSlug} clientId={client.id} clientName={client.companyName} sharedProjects={data.stats.sharedProjects} />
            )}
          </div>
        </div>
      </section>

      {client.status === "archived" && (
        <div className="mb-4 rounded-xl border border-slate-500/25 bg-slate-500/[0.06] px-4 py-3 text-sm text-ink-muted">
          This client is archived. Its portal is closed and it doesn&apos;t count toward your plan.
          {data.can.manage && " Change the status to reopen the portal."}
        </div>
      )}

      <section aria-label="Client summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Folder} label="Active projects" value={data.stats.activeProjects} sub={`${data.projects.length} total`} />
        <Stat icon={Eye} label="Shared with client" value={data.stats.sharedProjects} sub="visible on their portal" />
        <Stat icon={Clock3} label="Waiting on client" value={data.stats.pendingApprovals} sub="deliverables in review" warn={data.stats.pendingApprovals > 0} />
        <Stat icon={Users} label="Portal users" value={data.stats.activePortalUsers} sub={`${data.invitations.filter((item) => item.status === "pending").length} invited`} />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="min-w-0 space-y-4">
          <ProjectsCard data={data} />
          <Card>
            <CardHeader icon={Activity} title="Activity" description="Recent events for this client. Internal ones are marked and never reach the portal." />
            <ClientActivity items={data.activity} />
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader icon={UserRound} title="Main contact" />
            <dl className="divide-y divide-white/[0.05] px-5 pb-3">
              <ContactRow icon={UserRound} label="Name" value={client.contactName} />
              <ContactRow
                icon={Mail}
                label="Email"
                value={
                  <a href={`mailto:${client.email}`} className="break-all text-cyan-300 hover:text-cyan-200">
                    {client.email}
                  </a>
                }
              />
              <ContactRow
                icon={Phone}
                label="Phone"
                value={
                  client.phone ? (
                    <a href={`tel:${client.phone.replace(/[^+\d]/g, "")}`} className="hover:text-cyan-300">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-ink-faint">Not added</span>
                  )
                }
              />
              <ContactRow
                icon={Globe}
                label="Website"
                value={
                  client.website ? (
                    <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" className="break-all hover:text-cyan-300">
                      {client.website}
                    </a>
                  ) : (
                    <span className="text-ink-faint">Not added</span>
                  )
                }
              />
            </dl>
          </Card>

          <Card>
            <CardHeader icon={NotebookPen} tone="amber" title="Internal notes" description="Only your team sees these." />
            <div className="px-5 pb-5">
              {client.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{client.notes}</p>
              ) : (
                <p className="text-sm text-ink-faint">
                  No notes yet.
                  {data.can.manage && (
                    <>
                      {" "}
                      <Link href={`${data.base}/clients/${client.id}/edit`} className="text-cyan-300 hover:text-cyan-200">
                        Add review preferences or decision makers
                      </Link>
                      .
                    </>
                  )}
                </p>
              )}
            </div>
          </Card>

          <PortalUsersCard data={data} />
          <InvitationsCard data={data} />
        </div>
      </div>
    </>
  );
}

function Stat({ icon, label, value, sub, warn = false }: { icon: LucideIcon; label: string; value: number; sub: string; warn?: boolean }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <IconBox icon={icon} tone={warn ? "amber" : "cyan"} className="hidden sm:grid" />
      <div className="min-w-0">
        <p className="truncate text-xs text-ink-faint">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
        <p className="truncate text-[11px] text-ink-faint">{sub}</p>
      </div>
    </Card>
  );
}

function ContactRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="flex flex-none items-center gap-2 text-ink-faint">
        <Icon size={14} aria-hidden="true" /> {label}
      </dt>
      <dd className="min-w-0 text-right text-ink-secondary">{value}</dd>
    </div>
  );
}

function ProjectsCard({ data }: { data: ClientDetail }) {
  return (
    <Card>
      <CardHeader
        icon={Folder}
        title="Projects"
        description={data.projectsNote ?? "Shared projects appear on the client portal. Private ones never do."}
        action={
          data.can.createProject && (
            <Link href={`${data.base}/projects/new?client=${data.client.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <FolderPlus size={14} /> New project
            </Link>
          )
        }
      />
      {data.projects.length === 0 ? (
        <EmptyState
          compact
          icon={FolderPlus}
          title="No projects yet"
          description={data.can.createProject ? `Start a project for ${data.client.companyName} and share it when the first milestone is ready.` : "You aren't on any of this client's projects."}
          action={
            data.can.createProject && (
              <Link href={`${data.base}/projects/new?client=${data.client.id}`} className={buttonClasses()}>
                <FolderPlus size={16} /> New project
              </Link>
            )
          }
        />
      ) : (
        <TableWrap>
          <Table className="min-w-[640px]">
            <THead>
              <Th>Project</Th>
              <Th>Status</Th>
              <Th>Portal</Th>
              <Th>Progress</Th>
              <Th>Due</Th>
            </THead>
            <tbody>
              {data.projects.map((project) => (
                <Tr key={project.id}>
                  <Td className="font-medium text-ink">
                    <div className="flex items-center gap-3">
                      <ProjectIcon icon={project.icon} hue={project.client?.hue} size="sm" />
                      <Link href={`${data.base}/projects/${project.id}`} className="hover:text-cyan-300">
                        {project.name}
                      </Link>
                    </div>
                  </Td>
                  <Td>
                    <ProjectStatusBadge status={project.status} />
                  </Td>
                  <Td>
                    {project.sharedWithClient ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-cyan-300">
                        <Eye size={13} aria-hidden="true" /> Shared
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-faint">
                        <EyeOff size={13} aria-hidden="true" /> Private
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 text-xs tabular-nums text-ink-muted">{project.progress}%</span>
                      <ProgressBar value={project.progress} label={`${project.name} progress`} className="w-16" />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(project.dueAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}

function PortalUsersCard({ data }: { data: ClientDetail }) {
  const activeApprovers = data.portalUsers.filter((row) => row.status === "active" && row.role === "approver").length;
  return (
    <Card>
      <CardHeader
        icon={ShieldCheck}
        title="Portal users"
        description="People at the client who can sign in to review work."
        action={
          data.can.manageAccess &&
          data.client.status !== "archived" &&
          data.portalUsers.length > 0 && (
            <InvitePortalUserButton
              orgSlug={data.orgSlug}
              clientId={data.client.id}
              clientName={data.client.companyName}
              sharedProjects={data.stats.sharedProjects}
              variant="secondary"
              size="sm"
            />
          )
        }
      />
      {data.portalUsers.length === 0 ? (
        <EmptyState
          compact
          icon={Users}
          title="No portal users yet"
          description={
            data.invitations.some((item) => item.status === "pending")
              ? "An invitation is pending below. People appear here once they accept."
              : "Invite an approver so the client can review and sign off on deliverables."
          }
          action={
            data.can.manageAccess &&
            data.client.status !== "archived" && (
              <InvitePortalUserButton orgSlug={data.orgSlug} clientId={data.client.id} clientName={data.client.companyName} sharedProjects={data.stats.sharedProjects} variant="secondary" />
            )
          }
        />
      ) : (
        <ul className="divide-y divide-white/[0.05] px-5 pb-3">
          {data.portalUsers.map((row) => {
            const suspended = row.status !== "active";
            return (
              <li key={row.membershipId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
                <Avatar user={row.user} size="md" className={cn(suspended && "opacity-50 grayscale")} />
                <div className="min-w-[11rem] flex-1">
                  <p className={cn("truncate text-sm", suspended ? "text-ink-muted" : "text-ink")}>{row.user.name}</p>
                  <p className="truncate text-xs text-ink-faint">{row.user.email}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{suspended ? "Access revoked" : `Last active ${row.lastActiveText}`}</p>
                </div>
                <div className="ml-12 flex items-center gap-1.5 sm:ml-auto">
                  {data.can.manageAccess && !suspended ? (
                    <PortalRoleSelect
                      orgSlug={data.orgSlug}
                      membershipId={row.membershipId}
                      name={row.user.name}
                      role={row.role}
                      isLastApprover={row.role === "approver" && activeApprovers === 1}
                    />
                  ) : (
                    <Badge tone={suspended ? "slate" : row.role === "approver" ? "cyan" : "slate"}>{suspended ? "Revoked" : CLIENT_ROLE_LABELS[row.role]}</Badge>
                  )}
                  {data.can.manageAccess && (
                    <PortalAccessButton orgSlug={data.orgSlug} membershipId={row.membershipId} name={row.user.name} clientName={data.client.companyName} status={row.status} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function InvitationsCard({ data }: { data: ClientDetail }) {
  if (data.invitations.length === 0) return null;
  return (
    <Card>
      <CardHeader icon={MailPlus} title="Invitations" description="Sent but not accepted yet. Links expire after 7 days." />
      <ul className="divide-y divide-white/[0.05] px-5 pb-3">
        {data.invitations.map((invitation) => (
          <li key={invitation.id} className="flex items-start gap-3 py-3.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-dashed border-line-strong text-ink-faint" aria-hidden="true">
              <Mail size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm text-ink">{invitation.email}</p>
                <InvitationStatusBadge status={invitation.status} />
              </div>
              <p className="text-xs text-ink-faint">
                {CLIENT_ROLE_LABELS[invitation.role]} · invited by {invitation.invitedBy} {invitation.sentText}
              </p>
              <p className={cn("mt-0.5 text-[11px]", invitation.status === "expired" ? "text-amber-300/90" : "text-ink-faint")}>
                {invitation.status === "expired" ? `Expired ${invitation.expiresText}` : `Expires ${invitation.expiresText}`}
              </p>
              {data.can.manageAccess && (
                <div className="-ml-2.5 mt-2">
                  <ClientInvitationActions orgSlug={data.orgSlug} invitationId={invitation.id} email={invitation.email} expired={invitation.status === "expired"} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ClientSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[84px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
