import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  CircleX,
  Database,
  FlaskConical,
  FolderKanban,
  HardDrive,
  Mail,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { formatBytes, formatDateTime } from "@/lib/utils";
import { getAdminOverview, type HealthStatus } from "@/lib/data/queries/admin";
import type { Tone } from "@/lib/domain/labels";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, IconBox } from "@/components/ui/card";
import { FlashToast } from "@/components/ui/flash-toast";
import { PageHeader, Skeleton, StatGridSkeleton } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { ResetDemoButton } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

const STATUS: Record<HealthStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  operational: { label: "Operational", tone: "emerald", icon: CircleCheck },
  sandbox: { label: "Sandbox", tone: "blue", icon: FlaskConical },
  degraded: { label: "Degraded", tone: "amber", icon: CircleAlert },
  down: { label: "Down", tone: "red", icon: CircleX },
};

const CHECK_ICONS: Record<string, LucideIcon> = { store: Database, storage: HardDrive, email: Mail, webhooks: Webhook };

async function Overview() {
  const data = await getAdminOverview();
  const { metrics } = data;
  const allGood = data.checks.every((check) => check.status === "operational" || check.status === "sandbox");

  return (
    <>
      <FlashToast messages={{ reset: "Demo data restored to the original seed." }} />
      <PageHeader
        title="Platform health"
        description={`Signed in as ${data.adminName}. Operators can see workspace metadata and system health. Client project content stays hidden.`}
        actions={<ResetDemoButton />}
      />

      <Card>
        <CardHeader
          icon={allGood ? CircleCheck : CircleAlert}
          tone={allGood ? "emerald" : "amber"}
          title={allGood ? "All systems operational" : "Some services need attention"}
          description={`Checked ${formatDateTime(data.checkedAt)}. Each check makes a real round trip through the service it names.`}
        />
        <ul className="grid gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
          {data.checks.map((check) => {
            const status = STATUS[check.status];
            const StatusIcon = status.icon;
            return (
              <li key={check.key} className="flex flex-col rounded-2xl border border-line bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <IconBox icon={CHECK_ICONS[check.key] ?? Database} size="sm" tone="slate" />
                  <h3 className="font-medium text-ink">{check.name}</h3>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Badge tone={status.tone}>
                    <StatusIcon size={13} aria-hidden="true" /> {status.label}
                  </Badge>
                  <span className="text-xs tabular-nums text-ink-muted">
                    {check.status === "sandbox" ? "No network call" : `${check.latencyMs < 1 ? check.latencyMs.toFixed(2) : check.latencyMs.toFixed(1)} ms`}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-faint">{check.detail}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      <section aria-label="Platform metrics" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Workspaces" value={String(metrics.workspaces)} caption="Agencies using Atrium." />
        <StatCard
          icon={Users}
          label="Users"
          value={String(metrics.teamUsers + metrics.clientUsers)}
          caption={`${metrics.teamUsers} team members, ${metrics.clientUsers} client portal users.`}
        />
        <StatCard icon={FolderKanban} label="Projects" value={String(metrics.projects)} caption="Across every workspace, any status." />
        <StatCard icon={HardDrive} label="Storage" value={formatBytes(metrics.storageBytes)} caption="Deliverable versions plus project files." />
      </section>

      <Card className="mt-4">
        <CardHeader
          icon={Webhook}
          title="Billing webhook events"
          description="Signed provider events. Duplicates and out-of-date events are acknowledged without changing anything."
          action={
            <Link href="/admin/webhooks" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Open event log →
            </Link>
          }
        />
        <ul className="grid gap-3 px-4 pb-5 sm:grid-cols-3 sm:px-5">
          <WebhookStat label="Processed" value={metrics.webhooks.processed} hint="Applied to a subscription or invoice." href="/admin/webhooks?status=processed" />
          <WebhookStat label="Skipped" value={metrics.webhooks.skipped} hint="Duplicate replays or stale events." href="/admin/webhooks?status=skipped" />
          <WebhookStat
            label="Failed"
            value={metrics.webhooks.failed}
            hint="Answered 500 so the provider retries."
            href="/admin/webhooks?status=failed"
            danger={metrics.webhooks.failed > 0}
          />
        </ul>
      </Card>
    </>
  );
}

function WebhookStat({ label, value, hint, href, danger = false }: { label: string; value: number; hint: string; href: string; danger?: boolean }) {
  return (
    <li>
      <Link href={href} className="block h-full rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-cyan-400/25 hover:bg-white/[0.035]">
        <span className="flex items-center gap-2 text-sm text-ink-secondary">
          {danger && <CircleAlert size={14} className="text-red-300" aria-hidden="true" />}
          {label}
        </span>
        <span className="mt-1 block text-2xl font-semibold text-ink">{value}</span>
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      </Link>
    </li>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[230px] rounded-2xl" />
      <div className="mt-4">
        <StatGridSkeleton />
      </div>
      <Skeleton className="mt-4 h-[180px] rounded-2xl" />
    </div>
  );
}
