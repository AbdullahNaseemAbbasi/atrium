import { Suspense } from "react";
import type { Metadata } from "next";
import { Building2, SearchX } from "lucide-react";
import { firstParam, formatBytes, formatDate } from "@/lib/utils";
import { listAdminWorkspaces } from "@/lib/data/queries/admin";
import { BrandTile } from "@/components/ui/avatar";
import { SubscriptionStatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/interactive";
import { EmptyState, PageHeader, Skeleton, TableSkeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { SupportViewButton } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Workspaces" };

export default function AdminWorkspacesPage({ searchParams }: PageProps<"/admin/workspaces">) {
  return (
    <Suspense fallback={<WorkspacesSkeleton />}>
      <Workspaces searchParams={searchParams} />
    </Suspense>
  );
}

async function Workspaces({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const data = await listAdminWorkspaces({ q: firstParam(query.q) });

  return (
    <>
      <PageHeader
        title="Workspaces"
        description="Every agency on the platform with plan and usage. Support view shows metadata only and is recorded in that workspace's audit log."
      />
      <Card>
        <CardHeader
          icon={Building2}
          title={`${data.total} ${data.total === 1 ? "workspace" : "workspaces"}`}
          description="Counts include every status. Storage is deliverable versions plus project files."
          action={<SearchInput placeholder="Search by name or URL…" className="sm:w-72" />}
        />
        {data.rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No workspaces match" description={`Nothing matches "${data.q}". Try part of the name or URL.`} />
        ) : (
          <TableWrap>
            <Table className="min-w-[900px]">
              <THead>
                <Th>Workspace</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th className="text-right">Members</Th>
                <Th className="text-right">Clients</Th>
                <Th className="text-right">Projects</Th>
                <Th className="text-right">Storage</Th>
                <Th>Created</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </THead>
              <tbody>
                {data.rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <BrandTile name={row.name} hue={row.hue} size="sm" />
                        <span>
                          <span className="block font-medium text-ink">{row.name}</span>
                          <span className="block text-xs text-ink-faint">/w/{row.slug}</span>
                        </span>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-ink-secondary">{row.planName}</span>
                      <span className="block text-xs text-ink-faint">{row.interval}</span>
                    </Td>
                    <Td>
                      <SubscriptionStatusBadge status={row.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{row.members}</Td>
                    <Td className="text-right tabular-nums">{row.clients}</Td>
                    <Td className="text-right tabular-nums">{row.projects}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{formatBytes(row.storageBytes)}</Td>
                    <Td className="whitespace-nowrap">{formatDate(row.createdAt)}</Td>
                    <Td className="text-right">
                      <SupportViewButton organizationId={row.id} name={row.name} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

function WorkspacesSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="card">
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}
