import { Suspense } from "react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Download, Filter, History, SearchX, ShieldCheck } from "lucide-react";
import { firstParam, formatDateTime } from "@/lib/utils";
import type { Tone } from "@/lib/domain/labels";
import { getAuditLog, type AuditRow } from "@/lib/data/queries/settings";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { EmptyState, Pagination, Skeleton, TableSkeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Audit log · Settings" };

// Never served from the browser's page cache: downloads and support views add
// entries without refreshing anything, and the log isn't a Realtime table.
export const unstable_dynamicStaleTime = 0;

type Search = Record<string, string | string[] | undefined>;

export default function AuditLogPage({ params, searchParams }: PageProps<"/w/[org]/settings/audit-log">) {
  return (
    <Suspense fallback={<AuditSkeleton />}>
      <AuditLog params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AuditLog({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getAuditLog(org, {
    action: firstParam(query.action),
    actor: firstParam(query.actor),
    from: firstParam(query.from),
    to: firstParam(query.to),
    page: firstParam(query.page),
  });
  const path = `${data.base}/settings/audit-log`;
  const hrefFor = (page: number) => {
    const next = new URLSearchParams(data.queryString);
    if (page > 1) next.set("page", String(page));
    return `${path}${next.size ? `?${next}` : ""}`;
  };

  return (
    <Card>
      <CardHeader
        icon={History}
        title="Audit log"
        description={`${data.total} security-relevant events: access changes, approvals, exports and billing. Entries can't be edited or deleted.`}
        action={
          <a
            href={data.exportHref}
            download
            className={buttonClasses({ variant: "secondary", size: "sm" })}
            aria-label={data.filtered ? "Export filtered entries as CSV" : "Export all entries as CSV"}
          >
            <Download size={14} /> Export CSV
          </a>
        }
      />

      <Form action={path} className="grid grid-cols-2 gap-3 border-t border-line px-4 py-4 sm:px-5 xl:grid-cols-[1fr_1fr_150px_150px_auto]">
        <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-1">
          <Label htmlFor="audit-action" className="text-xs">
            Action
          </Label>
          <Select id="audit-action" name="action" defaultValue={data.filters.action} className="h-10">
            <option value="">All actions</option>
            {data.actions.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-1">
          <Label htmlFor="audit-actor" className="text-xs">
            Actor
          </Label>
          <Select id="audit-actor" name="actor" defaultValue={data.filters.actor} className="h-10">
            <option value="">Everyone</option>
            {data.actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
            {data.hasSystem && <option value="system">System (automated)</option>}
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="audit-from" className="text-xs">
            From
          </Label>
          <Input id="audit-from" name="from" type="date" defaultValue={data.filters.from} className="h-10 [color-scheme:dark]" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="audit-to" className="text-xs">
            To
          </Label>
          <Input id="audit-to" name="to" type="date" defaultValue={data.filters.to} className="h-10 [color-scheme:dark]" />
        </div>
        <div className="col-span-2 flex items-end gap-2 xl:col-span-1">
          <button type="submit" className={buttonClasses({ className: "h-10 flex-1 xl:flex-none" })}>
            <Filter size={15} /> Apply
          </button>
          {data.filtered && (
            <Link href={path} className={buttonClasses({ variant: "ghost", className: "h-10" })}>
              Reset
            </Link>
          )}
        </div>
      </Form>

      {data.page.total === 0 ? (
        data.filtered ? (
          <EmptyState
            icon={SearchX}
            title="No entries match these filters"
            description="Widen the date range or choose a different action or person."
            action={
              <Link href={path} className={buttonClasses({ variant: "secondary" })}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Nothing recorded yet"
            description="Invitations, role changes, approvals and exports will appear here as they happen."
          />
        )
      ) : (
        <>
          <ul className="divide-y divide-white/[0.05] border-t border-line px-4 sm:hidden">
            {data.page.items.map((row) => (
              <AuditListItem key={row.id} row={row} />
            ))}
          </ul>
          <TableWrap className="hidden sm:block">
            <Table className="min-w-[860px]">
              <THead>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Details</Th>
                <Th>IP address</Th>
              </THead>
              <tbody>
                {data.page.items.map((row) => (
                  <AuditTableRow key={row.id} row={row} />
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination
            page={data.page.page}
            pageCount={data.page.pageCount}
            total={data.page.total}
            pageSize={data.page.pageSize}
            hrefFor={hrefFor}
          />
        </>
      )}
    </Card>
  );
}

const ACTION_TONES: Record<string, Tone> = {
  member: "blue",
  invitation: "blue",
  client: "violet",
  project: "cyan",
  deliverable: "emerald",
  file: "slate",
  data: "amber",
  billing: "amber",
  workspace: "slate",
  auth: "slate",
  support: "red",
};

function toneFor(action: string): Tone {
  return action === "billing.payment_failed" ? "red" : (ACTION_TONES[action.split(".")[0]] ?? "slate");
}

function ActorAvatar({ row }: { row: AuditRow }) {
  return row.actor ? (
    <Avatar user={row.actor} size="sm" />
  ) : (
    <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-ink-muted" aria-hidden="true">
      SYS
    </span>
  );
}

function MetadataChips({ row }: { row: AuditRow }) {
  if (row.metadata.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Details">
      {row.metadata.map((item) => (
        <li key={item.key} className="max-w-full break-all rounded-md border border-line bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
          <span className="text-ink-faint">{item.key}:</span> {item.value}
        </li>
      ))}
    </ul>
  );
}

function AuditListItem({ row }: { row: AuditRow }) {
  return (
    <li className="py-4">
      <div className="flex items-center gap-2.5">
        <ActorAvatar row={row} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{row.actorLabel}</p>
          <p className="text-xs text-ink-faint">
            <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
            {row.ip && <span className="font-mono"> · {row.ip}</span>}
          </p>
        </div>
        <Badge tone={toneFor(row.action)}>{row.actionLabel}</Badge>
      </div>
      <p className="mt-2 text-sm text-ink-secondary">{row.summary}</p>
      <MetadataChips row={row} />
    </li>
  );
}

function AuditTableRow({ row }: { row: AuditRow }) {
  const tone = toneFor(row.action);
  return (
    <Tr>
      <Td className="whitespace-nowrap align-top">
        <time dateTime={row.createdAt} className="block text-ink-secondary">
          {formatDateTime(row.createdAt)}
        </time>
        <span className="text-xs text-ink-faint">{row.when}</span>
      </Td>
      <Td className="align-top">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <ActorAvatar row={row} />
          <span>
            <span className="block text-ink">{row.actorLabel}</span>
            {row.actor && <span className="block text-xs text-ink-faint">{row.actor.email}</span>}
          </span>
        </div>
      </Td>
      <Td className="align-top">
        <Badge tone={tone}>{row.actionLabel}</Badge>
      </Td>
      <Td className="align-top">
        <p className="text-ink-secondary">{row.summary}</p>
        <MetadataChips row={row} />
      </Td>
      <Td className="whitespace-nowrap align-top font-mono text-xs">{row.ip ?? <span className="text-ink-faint">Not recorded</span>}</Td>
    </Tr>
  );
}

function AuditSkeleton() {
  return (
    <div className="card" aria-busy="true">
      <div className="flex items-center gap-3 p-5">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
      </div>
      <Skeleton className="mx-5 h-16" />
      <TableSkeleton rows={8} />
    </div>
  );
}
