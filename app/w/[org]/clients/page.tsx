import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Folder, Globe, Mail, MailPlus, Plus, SearchX, Users } from "lucide-react";
import { firstParam, pluralize } from "@/lib/utils";
import { CLIENT_STATUS_ORDER, listClients, type ClientListRow } from "@/lib/data/queries/clients";
import { CLIENT_STATUS } from "@/lib/domain/labels";
import { Card } from "@/components/ui/card";
import { ClientStatusBadge } from "@/components/ui/badge";
import { BrandTile } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, FilterChips, PageHeader, ProgressBar, Skeleton } from "@/components/ui/misc";
import { SearchInput } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Clients" };

type Search = Record<string, string | string[] | undefined>;

export default function ClientsPage({ params, searchParams }: PageProps<"/w/[org]/clients">) {
  return (
    <Suspense fallback={<ClientsSkeleton />}>
      <Clients params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Clients({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await listClients(org, { q: firstParam(query.q), status: firstParam(query.status) });
  const { filters, limit } = data;

  const href = (status?: string) => {
    const next = new URLSearchParams();
    if (filters.q) next.set("q", filters.q);
    if (status) next.set("status", status);
    const qs = next.toString();
    return `${data.base}/clients${qs ? `?${qs}` : ""}`;
  };
  const chips = [{ key: "all", label: "All" }, ...CLIENT_STATUS_ORDER.map((key) => ({ key, label: CLIENT_STATUS[key].label }))].map((chip) => ({
    label: chip.label,
    count: data.counts[chip.key] ?? 0,
    active: filters.status === chip.key,
    href: href(chip.key === "all" ? undefined : chip.key),
  }));

  const usagePercent = limit.limit ? Math.round((limit.used / limit.limit) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Clients"
        description="The companies you work for, their portal users and every project you run for them."
        actions={
          data.canManage && (
            <Link href={`${data.base}/clients/new`} className={buttonClasses({ size: "lg" })}>
              <Plus size={17} /> Add client
            </Link>
          )
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput placeholder="Search company, contact or industry…" className="lg:w-96" />
          <div className="flex min-w-0 items-center gap-3 text-xs text-ink-muted lg:w-80">
            <span className="whitespace-nowrap">
              {limit.limit === null ? (
                <>
                  <span className="text-ink-secondary">{limit.used}</span> client portals · unlimited on {data.planName}
                </>
              ) : (
                <>
                  <span className="text-ink-secondary">{limit.used}</span> of {limit.limit} client portals on {data.planName}
                </>
              )}
            </span>
            {limit.limit !== null && (
              <ProgressBar value={usagePercent} size="sm" label="Client portals used" tone={usagePercent >= 100 ? "amber" : "cyan"} className="flex-1" />
            )}
          </div>
        </div>
        <div className="mt-4">
          <FilterChips label="Filter by status" items={chips} />
        </div>
      </Card>

      {data.rows.length === 0 ? (
        <Card className="mt-4">
          {data.totalClients === 0 ? (
            <EmptyState
              icon={Building2}
              title="No clients yet"
              description={
                data.canManage
                  ? "Add the companies you work for. Each one gets a private portal for reviews and approvals."
                  : "Owners and managers add clients. Ask one of them to set up the first client."
              }
              action={
                data.canManage && (
                  <Link href={`${data.base}/clients/new`} className={buttonClasses()}>
                    <Plus size={16} /> Add client
                  </Link>
                )
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No clients match"
              description="Try another status or search term."
              action={
                <Link href={`${data.base}/clients`} className={buttonClasses({ variant: "secondary" })}>
                  Clear filters
                </Link>
              }
            />
          )}
        </Card>
      ) : (
        <>
          <ul className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.rows.map((client) => (
              <li key={client.id} className="min-w-0">
                <ClientCard client={client} href={`${data.base}/clients/${client.id}`} />
              </li>
            ))}
          </ul>
          {data.projectsNote && <p className="mt-3 text-xs text-ink-faint">{data.projectsNote}</p>}
        </>
      )}
    </>
  );
}

function ClientCard({ client, href }: { client: ClientListRow; href: string }) {
  const archived = client.status === "archived";
  return (
    <Link
      href={href}
      className={`card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/25 hover:shadow-[0_16px_50px_rgba(0,0,0,0.35),0_0_0_1px_rgba(34,211,238,0.06)] ${archived ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <BrandTile name={client.companyName} hue={client.brandHue} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-ink transition group-hover:text-cyan-200">{client.companyName}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-faint">{client.industry}</p>
        </div>
        <ClientStatusBadge status={client.status} />
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        <p className="truncate text-ink-secondary">{client.contactName}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
          <Mail size={13} className="flex-none text-ink-faint" aria-hidden="true" />
          <span className="truncate">{client.email}</span>
        </p>
        {client.website && (
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
            <Globe size={13} className="flex-none text-ink-faint" aria-hidden="true" />
            <span className="truncate">{client.website}</span>
          </p>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-line bg-white/[0.02] p-3 text-center">
        <Metric icon={Folder} label="Active projects" value={`${client.activeProjects}`} sub={`of ${client.totalProjects}`} />
        <Metric icon={Users} label="Portal users" value={String(client.portalUsers)} />
        <Metric icon={MailPlus} label="Pending invites" value={String(client.pendingInvites)} muted={client.pendingInvites === 0} />
      </dl>

      <p className="mt-auto pt-4 text-xs text-ink-faint">
        Added {client.addedText} · {pluralize(client.totalProjects, "project")}
      </p>
    </Link>
  );
}

function Metric({ icon: Icon, label, value, sub, muted = false }: { icon: typeof Folder; label: string; value: string; sub?: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center justify-center gap-1 text-[11px] text-ink-faint">
        <Icon size={12} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums ${muted ? "text-ink-faint" : "text-ink"}`}>
        {value}
        {sub && <span className="ml-1 text-xs font-normal text-ink-faint">{sub}</span>}
      </dd>
    </div>
  );
}

function ClientsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[120px] rounded-2xl" />
      <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[270px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
