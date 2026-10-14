import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckSquare,
  ChevronRight,
  Clock3,
  CreditCard,
  Crown,
  Database,
  FileCheck2,
  Folder,
  FolderPlus,
  Inbox,
  Plus,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn, formatBytes, formatDate, percent } from "@/lib/utils";
import { getDashboard, parseRange, type TeamDashboard } from "@/lib/data/queries/dashboard";
import { Card, CardHeader, IconBox } from "@/components/ui/card";
import { DeliverableStatusBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  CardSkeleton,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
  StatGridSkeleton,
  THead,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/misc";
import { RowActions } from "@/components/ui/row-actions";
import { ProjectIcon } from "@/components/projects/project-icon";
import { MyTasksCard } from "@/components/dashboard/my-tasks";
import { RangeSelect } from "@/components/dashboard/range-select";
import { FlashToast } from "@/components/ui/flash-toast";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ params, searchParams }: PageProps<"/w/[org]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <FlashToast
        messages={{
          welcome: "Your workspace is ready. Start with a project or invite your team.",
          joined: "You have joined the workspace.",
        }}
      />
      <Dashboard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getDashboard(org, parseRange(query.range));

  if (data.kind === "billing") {
    return (
      <>
        <PageHeader title="Dashboard" description={`Welcome back, ${data.firstName}. You manage billing for ${data.orgName}.`} />
        <Card>
          <EmptyState
            icon={CreditCard}
            title="Billing lives in one place"
            description="As a billing manager you can see the plan, payment method, usage and invoices. Project data stays private to the delivery team."
            action={
              <Link href={`${data.base}/billing`} className={buttonClasses()}>
                Open billing
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const period = `vs ${data.range} days ago`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${data.firstName}! Here's what's happening across ${data.orgName}.`}
        actions={<RangeSelect value={data.range} />}
      />

      <section aria-label="Quick actions" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.can.createProject && (
          <QuickAction active href={`${data.base}/projects/new`} icon={Plus} title="New project" subtitle="Start a new project" />
        )}
        {data.can.addClient && <QuickAction href={`${data.base}/clients/new`} icon={Users} title="Add client" subtitle="Bring in a new client" />}
        {data.can.invite && <QuickAction href={`${data.base}/team/invite`} icon={UserPlus} title="Invite team member" subtitle="Grow your team" />}
        {data.can.reports ? (
          <QuickAction href={`${data.base}/reports`} icon={BarChart3} title="View reports" subtitle="See insights and data" />
        ) : (
          <QuickAction href={`${data.base}/approvals`} icon={FileCheck2} title="Approvals" subtitle="Follow client reviews" />
        )}
        {!data.can.createProject && (
          <QuickAction href={`${data.base}/tasks?scope=mine`} icon={CheckSquare} title="My tasks" subtitle="Everything assigned to you" />
        )}
      </section>

      <section aria-label="Key metrics" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Folder}
          label="Active projects"
          value={String(data.stats.active.value)}
          delta={{ value: data.stats.active.delta, period, upIsGood: true }}
          caption="Started and in planning, progress or review."
          trend={data.stats.active.trend}
        />
        <StatCard
          icon={CheckSquare}
          label="Tasks due soon"
          value={String(data.stats.dueSoon.value)}
          delta={{ value: data.stats.dueSoon.delta, period, upIsGood: false }}
          caption="Open tasks due in the next 7 days."
          trend={data.stats.dueSoon.trend}
        />
        <StatCard
          icon={Clock3}
          label="Pending approvals"
          value={String(data.stats.pending.value)}
          delta={{ value: data.stats.pending.delta, period, upIsGood: false }}
          caption="Deliverables waiting for client review."
          trend={data.stats.pending.trend}
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue tasks"
          value={String(data.stats.overdue.value)}
          delta={{ value: data.stats.overdue.delta, period, upIsGood: false }}
          caption="Open tasks past their due date."
          trend={data.stats.overdue.trend}
          danger={data.stats.overdue.value > 0}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <RecentProjects data={data} />
        <MyTasksCard tasks={data.tasks} base={data.base} defaultScope={data.defaultTaskScope} canSeeEveryone={data.can.createProject} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <ReviewQueue data={data} />
        <RecentActivity data={data} />
      </section>

      <WorkspaceOverview data={data} />
    </>
  );
}

function QuickAction({
  icon: Icon,
  title,
  subtitle,
  href,
  active = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[88px] items-center rounded-2xl border p-4 text-left transition-all duration-300",
        active
          ? "border-cyan-400/60 bg-gradient-to-r from-cyan-500/35 to-sky-600/20 shadow-[0_0_25px_rgba(34,211,238,.2)] hover:shadow-[0_0_32px_rgba(34,211,238,.3)]"
          : "border-white/[0.08] bg-[#101d29]/80 hover:border-cyan-400/25 hover:bg-surface-hover",
      )}
    >
      <span className={cn("grid h-12 w-12 flex-none place-items-center rounded-xl", active ? "bg-cyan-300 text-[#06131c]" : "bg-cyan-500/10 text-cyan-300")}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="ml-4 min-w-0">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-xs text-ink-muted">{subtitle}</span>
      </span>
      <ChevronRight size={18} className="ml-auto flex-none text-cyan-300 transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

function RecentProjects({ data }: { data: TeamDashboard }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={Folder}
        title="Recent projects"
        description="Progress, deadlines and status of your most active work."
        action={
          <Link href={`${data.base}/projects`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            View all projects →
          </Link>
        }
      />
      {data.recentProjects.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No projects yet"
          description="Create your first project to start tracking milestones, tasks and client approvals."
          action={
            data.can.createProject ? (
              <Link href={`${data.base}/projects/new`} className={buttonClasses()}>
                <Plus size={16} /> New project
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <Table className="min-w-[700px] [&_td]:px-2.5 [&_th]:px-2.5">
            <THead>
              <Th>Project</Th>
              <Th>Client</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Due date</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </THead>
            <tbody>
              {data.recentProjects.map((project) => (
                <Tr key={project.id}>
                  <Td className="font-medium text-ink">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <ProjectIcon icon={project.icon} hue={project.client?.hue} size="sm" />
                      <Link href={`${data.base}/projects/${project.id}`} className="hover:text-cyan-300">
                        {project.name}
                      </Link>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{project.client?.name ?? "Internal"}</Td>
                  <Td>
                    <ProjectStatusBadge status={project.status} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 text-xs tabular-nums text-ink-muted">{project.progress}%</span>
                      <ProgressBar value={project.progress} label={`${project.name} progress`} className="w-16" />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(project.dueAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`${data.base}/projects/${project.id}`}
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                        aria-label={`View ${project.name}`}
                      >
                        View
                      </Link>
                      <RowActions
                        label={`More actions for ${project.name}`}
                        actions={[
                          { label: "Open tasks", href: `${data.base}/projects/${project.id}/tasks` },
                          { label: "Deliverables", href: `${data.base}/projects/${project.id}/deliverables` },
                          { label: "Milestones", href: `${data.base}/projects/${project.id}/milestones` },
                          { label: "Copy link", copyPath: `${data.base}/projects/${project.id}` },
                        ]}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}

function ReviewQueue({ data }: { data: TeamDashboard }) {
  return (
    <Card>
      <CardHeader icon={Clock3} title="Waiting for client review" description="Deliverables that need client approval or a new version." />
      {data.reviews.length === 0 ? (
        <EmptyState compact icon={Inbox} title="Nothing waiting on clients" description="Submitted deliverables appear here until the client decides." />
      ) : (
        <TableWrap>
          <Table className="min-w-[720px] text-xs">
            <THead>
              <Th>Deliverable</Th>
              <Th>Project</Th>
              <Th>Client</Th>
              <Th>Submitted</Th>
              <Th>Review status</Th>
              <Th>
                <span className="sr-only">Open</span>
              </Th>
            </THead>
            <tbody>
              {data.reviews.slice(0, 5).map((item) => (
                <Tr key={item.id}>
                  <Td className="py-3 font-medium text-ink">
                    {item.title}
                    <span className="ml-1.5 text-ink-faint">v{item.version}</span>
                  </Td>
                  <Td className="py-3">{item.projectName}</Td>
                  <Td className="py-3">{item.clientName}</Td>
                  <Td className="whitespace-nowrap py-3">
                    {formatDate(item.submittedAt)}
                    {item.status === "in_review" && item.waitingDays > 2 && (
                      <span className="ml-1.5 text-amber-300">· {item.waitingDays}d waiting</span>
                    )}
                  </Td>
                  <Td className="py-3">
                    <DeliverableStatusBadge status={item.status} />
                  </Td>
                  <Td className="py-3">
                    <Link
                      href={`${data.base}/projects/${item.projectId}/deliverables/${item.id}`}
                      className={buttonClasses({ variant: "secondary", size: "xs" })}
                      aria-label={`View ${item.title}`}
                    >
                      View
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 flex justify-center">
            <Link href={`${data.base}/approvals`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              View all approvals →
            </Link>
          </div>
        </TableWrap>
      )}
    </Card>
  );
}

function RecentActivity({ data }: { data: TeamDashboard }) {
  return (
    <Card>
      <CardHeader icon={Activity} title="Recent activity" description={`What changed across the workspace in the last ${data.range} days.`} />
      <div className="px-5 pb-5">
        {data.activity.length === 0 ? (
          <EmptyState compact icon={Activity} title="Quiet period" description="No activity in this time range. Try a longer range." />
        ) : (
          <ol className="relative">
            <span className="absolute bottom-4 left-[17px] top-4 w-px bg-gradient-to-b from-cyan-400/40 to-transparent" aria-hidden="true" />
            {data.activity.map((item) => (
              <li key={item.id} className="relative flex items-center gap-3 border-b border-white/[0.04] py-3 last:border-0">
                {item.actor ? (
                  <Avatar user={item.actor} size="md" ring className="z-10" />
                ) : (
                  <span className="z-10 h-9 w-9 rounded-full bg-surface-raised" aria-hidden="true" />
                )}
                <p className="min-w-0 flex-1 text-sm">
                  <span className="text-ink">{item.actor?.name ?? "Someone"}</span>{" "}
                  <span className="text-ink-muted">{item.action}</span>{" "}
                  {item.href ? (
                    <Link href={item.href} className="font-medium text-cyan-300 hover:text-cyan-200">
                      {item.targetLabel}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink-secondary">{item.targetLabel}</span>
                  )}
                </p>
                <span className="hidden whitespace-nowrap text-xs text-ink-faint sm:block">{item.when}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex justify-center">
          <Link href={`${data.base}/activity`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            View activity log →
          </Link>
        </div>
      </div>
    </Card>
  );
}

function WorkspaceOverview({ data }: { data: TeamDashboard }) {
  const { overview } = data;
  const storagePercent = percent(overview.storageUsed, overview.storageLimit);
  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center">
        <div className="flex items-center gap-3 xl:w-[220px]">
          <IconBox icon={Users} />
          <h2 className="font-semibold text-ink">Workspace overview</h2>
        </div>
        <div className="grid flex-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewItem
            icon={Users}
            label="Team members"
            value={String(overview.members)}
            extra={overview.membersJoined > 0 ? `+${overview.membersJoined} in ${data.range} days` : `No new members in ${data.range} days`}
            positive={overview.membersJoined > 0}
          />
          <OverviewItem
            icon={Building2}
            label="Active clients"
            value={String(overview.activeClients)}
            extra={overview.clientsAdded > 0 ? `+${overview.clientsAdded} in ${data.range} days` : `No new clients in ${data.range} days`}
            positive={overview.clientsAdded > 0}
          />
          <OverviewItem icon={Crown} label="Current plan" value={overview.planName} extra={overview.planInterval} gold />
          <div className="border-white/[0.06] lg:border-l lg:pl-5">
            <div className="flex items-center gap-3">
              <IconBox icon={Database} />
              <div className="flex-1">
                <p className="text-xs text-ink-faint">Storage used</p>
                <ProgressBar value={storagePercent} label="Storage used" className="mt-2" tone={storagePercent > 85 ? "amber" : "cyan"} />
                <div className="mt-1 flex justify-between gap-2 text-xs text-ink-muted">
                  <span className="whitespace-nowrap">
                    {formatBytes(overview.storageUsed)} / {formatBytes(overview.storageLimit)}
                  </span>
                  <span className="tabular-nums">{storagePercent}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {data.can.manageTeam && (
            <Link href={`${data.base}/team`} className={buttonClasses({ size: "lg", className: "px-4" })}>
              Manage team
            </Link>
          )}
          {data.can.settings && (
            <Link href={`${data.base}/settings`} className={buttonClasses({ variant: "secondary", size: "lg", className: "px-4" })}>
              <Settings size={17} /> Workspace settings
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function OverviewItem({
  icon,
  label,
  value,
  extra,
  gold = false,
  positive = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  extra: string;
  gold?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="border-white/[0.06] lg:border-l lg:pl-5">
      <div className="flex items-center gap-3">
        <IconBox icon={icon} tone={gold ? "amber" : "cyan"} />
        <div>
          <p className="text-xs text-ink-faint">{label}</p>
          <p className="mt-0.5 text-xl font-semibold text-ink">{value}</p>
          <p className={cn("text-xs", positive ? "text-emerald-400" : "text-ink-faint")}>{extra}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[88px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-4">
        <StatGridSkeleton />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}
