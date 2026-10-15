import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCheck,
  CheckSquare,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock3,
  FolderOpen,
  HeartPulse,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Tone } from "@/lib/domain/labels";
import { getReports, type Health, type ReportsData } from "@/lib/data/queries/reports";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { CardSkeleton, EmptyState, PageHeader, ProgressBar, Skeleton, StatGridSkeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { ChartFrame, ChartTable } from "@/components/reports/chart-frame";
import { BarList, ColumnChart } from "@/components/reports/charts";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ params }: PageProps<"/w/[org]/reports">) {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <Reports params={params} />
    </Suspense>
  );
}

const days = (value: number) => `${value.toFixed(1)} ${value === 1 ? "day" : "days"}`;

async function Reports({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getReports(org);
  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Delivery health for ${data.orgName}, calculated live from projects, tasks and client decisions.`}
        actions={<span className="text-xs text-ink-faint">Updated {formatDateTime(data.generatedAt)}</span>}
      />

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CheckSquare}
          label="Tasks completed"
          value={String(kpis.completed.value)}
          delta={{ value: kpis.completed.delta, period: "vs previous 30 days", upIsGood: true }}
          caption="Marked done in the last 30 days."
          trend={kpis.completed.trend}
        />
        <StatCard
          icon={Clock3}
          label="Review turnaround"
          value={kpis.turnaround.value === null ? "No data" : days(kpis.turnaround.value)}
          caption={
            kpis.turnaround.decisions > 0
              ? `Median time from sending work to the client's decision, across ${kpis.turnaround.decisions} decisions.`
              : "No client decisions yet."
          }
        />
        <StatCard
          icon={CheckCheck}
          label="First-pass approval"
          value={kpis.firstPass.rate === null ? "No data" : `${kpis.firstPass.rate}%`}
          caption={
            kpis.firstPass.decided > 0
              ? `${kpis.firstPass.firstPass} of ${kpis.firstPass.decided} deliverables approved on version 1.`
              : "No deliverables decided yet."
          }
        />
        <StatCard
          icon={AlertTriangle}
          label="At risk or late"
          value={String(kpis.atRisk.value)}
          caption={`Out of ${kpis.atRisk.of} open projects. The rules are under the health table.`}
          danger={kpis.atRisk.value > 0}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Throughput data={data} />
        <Workload data={data} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Turnaround data={data} />
        <FirstPass data={data} />
      </section>

      <ProjectHealth data={data} />
    </>
  );
}

function Throughput({ data }: { data: ReportsData }) {
  const total = data.weekly.reduce((sum, week) => sum + week.count, 0);
  const points = data.weekly.map((week) => ({
    label: week.label === "This week" ? "Now" : week.label,
    detail: week.label === "This week" ? "This week (so far)" : `Week of ${week.label}`,
    value: week.count,
  }));
  return (
    <ChartFrame
      icon="throughput"
      title="Tasks completed per week"
      description={`${total} tasks completed in the last 12 weeks. The last column is the current week so far.`}
      howTo={
        <>
          Count of tasks whose completion date falls in each Monday-to-Sunday week, across every project you can see. Reopened tasks drop out until
          they are completed again.
        </>
      }
      chart={
        total === 0 ? (
          <EmptyState compact icon={CheckSquare} title="No completed tasks yet" description="Weekly throughput appears once tasks are marked done." />
        ) : (
          <ColumnChart points={points} unit={["task", "tasks"]} label="Tasks completed per week, last 12 weeks" />
        )
      }
      table={
        <ChartTable
          caption="Tasks completed per week"
          columns={["Week", "Tasks completed"]}
          rows={data.weekly.map((week) => [week.label === "This week" ? "This week (so far)" : `Week of ${week.label}`, week.count])}
        />
      }
    />
  );
}

function Workload({ data }: { data: ReportsData }) {
  const open = data.workload.reduce((sum, row) => sum + row.open, 0);
  return (
    <ChartFrame
      icon="workload"
      title="Open tasks by team member"
      description={`${open} open tasks across the team. Overdue tasks are flagged.`}
      howTo={<>Tasks that are not done, grouped by assignee. Overdue means still open with a due date before today. Unassigned tasks get their own row.</>}
      chart={
        open === 0 ? (
          <EmptyState compact icon={Inbox} title="No open tasks" description="No one has open work. New tasks show up here, grouped by assignee." />
        ) : (
          <BarList
            label="Open tasks by team member"
            rows={data.workload.map((row) => ({
              key: row.userId ?? "unassigned",
              label: row.name,
              value: row.open,
              valueText: `${row.open} open`,
              detail: row.overdue > 0 ? `${row.overdue} overdue` : "None overdue",
              leading: row.userId ? { kind: "avatar" as const, hue: row.avatarHue } : undefined,
              warning: row.overdue > 0 ? `${row.overdue} overdue` : undefined,
            }))}
          />
        )
      }
      table={
        <ChartTable
          caption="Open tasks by team member"
          columns={["Team member", "Open", "Overdue"]}
          rows={data.workload.map((row) => [row.name, row.open, row.overdue])}
        />
      }
    />
  );
}

function Turnaround({ data }: { data: ReportsData }) {
  const max = Math.max(...data.byClient.map((row) => row.medianDays ?? 0), 1);
  return (
    <ChartFrame
      icon="turnaround"
      title="Review turnaround by client"
      description="Median days from sending work for review to the client's decision. Shorter is faster."
      howTo={
        <>
          For every client decision (approve or request changes) we measure the time from when that version was sent for review to the decision,
          then take the median per client so one slow review doesn&apos;t skew the number. Work still waiting for a decision isn&apos;t counted yet.
        </>
      }
      chart={
        data.byClient.length === 0 ? (
          <EmptyState compact icon={Clock3} title="No client decisions yet" description="Turnaround appears after a client approves or requests changes." />
        ) : (
          <BarList
            label="Median review turnaround by client"
            max={max}
            rows={data.byClient.map((row) => ({
              key: row.clientId,
              label: row.clientName,
              value: row.medianDays ?? 0,
              valueText: days(row.medianDays ?? 0),
              detail: `Median of ${row.decisions} ${row.decisions === 1 ? "decision" : "decisions"}`,
              leading: { kind: "brand" as const, hue: row.hue },
            }))}
          />
        )
      }
      table={
        <ChartTable
          caption="Median review turnaround by client"
          columns={["Client", "Median days", "Decisions"]}
          rows={data.byClient.map((row) => [row.clientName, row.medianDays?.toFixed(1) ?? "No data", row.decisions])}
        />
      }
    />
  );
}

function FirstPass({ data }: { data: ReportsData }) {
  return (
    <ChartFrame
      icon="firstPass"
      title="First-pass approval by client"
      description="Share of deliverables the client approved on the first version, without asking for changes."
      howTo={
        <>
          Deliverables with at least one client decision count. A deliverable passes first time when its earliest decision is an approval of version 1.
          Rate = first-time approvals ÷ deliverables decided. Work still waiting for its first decision is left out.
        </>
      }
      chart={
        data.firstPassByClient.length === 0 ? (
          <EmptyState compact icon={CheckCheck} title="Nothing decided yet" description="Rates appear after clients review their first deliverables." />
        ) : (
          <BarList
            label="First-pass approval rate by client"
            max={100}
            rows={data.firstPassByClient.map((row) => ({
              key: row.clientId,
              label: row.clientName,
              value: row.rate ?? 0,
              valueText: `${row.rate ?? 0}%`,
              detail: `${row.firstPass} of ${row.decided} ${row.decided === 1 ? "deliverable" : "deliverables"}`,
            }))}
          />
        )
      }
      table={
        <ChartTable
          caption="First-pass approval by client"
          columns={["Client", "Approved first time", "Decided", "Rate"]}
          rows={data.firstPassByClient.map((row) => [row.clientName, row.firstPass, row.decided, `${row.rate ?? 0}%`])}
        />
      }
    />
  );
}

const HEALTH: Record<Health, { label: string; tone: Tone; icon: LucideIcon }> = {
  on_track: { label: "On track", tone: "emerald", icon: CircleCheck },
  at_risk: { label: "At risk", tone: "amber", icon: CircleAlert },
  late: { label: "Late", tone: "red", icon: CircleX },
  not_started: { label: "Not started", tone: "slate", icon: CircleDashed },
};

function dueText(daysLeft: number | null) {
  if (daysLeft === null) return "No due date";
  if (daysLeft === 0) return "Due today";
  if (daysLeft < 0) return `${Math.abs(daysLeft)} ${daysLeft === -1 ? "day" : "days"} late`;
  return `In ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
}

function ProjectHealth({ data }: { data: ReportsData }) {
  return (
    <Card className="mt-4">
      <CardHeader
        icon={HeartPulse}
        title="Project health"
        description={`Progress compared with time elapsed for every open project. At risk = progress trails time elapsed by more than ${data.atRiskGap} points. Late = past the due date.`}
      />
      {data.health.length === 0 ? (
        <EmptyState compact icon={FolderOpen} title="No open projects" description="Health appears for projects that are planned or in progress." />
      ) : (
        <>
          <ul className="divide-y divide-white/[0.05] border-t border-line px-4 sm:hidden">
            {data.health.map((row) => {
              const meta = HEALTH[row.health];
              const Icon = meta.icon;
              return (
                <li key={row.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`${data.base}/projects/${row.id}`} className="font-medium text-ink hover:text-cyan-300">
                        {row.name}
                      </Link>
                      <p className="text-xs text-ink-faint">
                        {row.clientName ?? "Internal"} · {dueText(row.daysLeft)}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>
                      <Icon size={13} aria-hidden="true" /> {meta.label}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="flex justify-between text-ink-faint">
                        Progress <span className="tabular-nums text-ink-secondary">{row.progress}%</span>
                      </dt>
                      <dd className="mt-1.5">
                        <ProgressBar value={row.progress} size="sm" label={`${row.name} progress`} />
                      </dd>
                    </div>
                    <div>
                      <dt className="flex justify-between text-ink-faint">
                        Time elapsed <span className="tabular-nums text-ink-secondary">{row.elapsed === null ? "No dates" : `${row.elapsed}%`}</span>
                      </dt>
                      <dd className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-slate-400/70" style={{ width: `${row.elapsed ?? 0}%` }} />
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
          <p className="px-4 pb-4 text-xs text-ink-faint sm:hidden">
            Progress = completed tasks ÷ all tasks. Time elapsed = days since start ÷ days from start to due date.
          </p>
          <TableWrap className="hidden sm:block">
            <Table className="min-w-[860px]">
              <THead>
                <Th>Project</Th>
                <Th>Progress</Th>
                <Th>Time elapsed</Th>
                <Th className="text-right">Gap</Th>
                <Th>Due</Th>
                <Th>Health</Th>
              </THead>
              <tbody>
                {data.health.map((row) => {
                  const meta = HEALTH[row.health];
                  const Icon = meta.icon;
                  return (
                    <Tr key={row.id}>
                      <Td>
                        <Link href={`${data.base}/projects/${row.id}`} className="font-medium text-ink hover:text-cyan-300">
                          {row.name}
                        </Link>
                        <span className="block text-xs text-ink-faint">{row.clientName ?? "Internal"}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <ProgressBar value={row.progress} label={`${row.name} progress`} className="w-24" />
                          <span className="w-9 text-xs tabular-nums text-ink-secondary">{row.progress}%</span>
                        </div>
                      </Td>
                      <Td>
                        {row.elapsed === null ? (
                          <span className="text-xs text-ink-faint">No dates</span>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div
                              className="h-2 w-24 overflow-hidden rounded-full bg-white/[0.06]"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={row.elapsed}
                              aria-label={`${row.name} time elapsed`}
                            >
                              <div className="h-full rounded-full bg-slate-400/70" style={{ width: `${row.elapsed}%` }} />
                            </div>
                            <span className="w-9 text-xs tabular-nums text-ink-secondary">{row.elapsed}%</span>
                          </div>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {row.gap === null ? "No dates" : <span className="text-ink-secondary">{row.gap > 0 ? `+${row.gap}` : row.gap < 0 ? `−${Math.abs(row.gap)}` : "0"} pts</span>}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="text-ink-secondary">{formatDate(row.dueAt)}</span>
                        <span className="block text-xs text-ink-faint">{dueText(row.daysLeft)}</span>
                      </Td>
                      <Td>
                        <Badge tone={meta.tone}>
                          <Icon size={13} aria-hidden="true" /> {meta.label}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <p className="mt-3 text-xs text-ink-faint">
              Progress = completed tasks ÷ all tasks. Time elapsed = days since the start date ÷ days from start to due date. Gap = progress − time
              elapsed. On track covers everything that isn&apos;t late, at risk or not yet started.
            </p>
          </TableWrap>
        </>
      )}
    </Card>
  );
}

function ReportsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <StatGridSkeleton />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
