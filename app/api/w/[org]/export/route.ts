import { format } from "date-fns";
import { can } from "@/lib/auth/permissions";
import { getDb, newId } from "@/lib/data/store";
import { fileSlug } from "@/lib/export/csv";
import { attachmentHeaders, notFoundResponse, requestIp, routeTeamContext } from "@/lib/export/route-auth";
import { buildWorkspaceExport } from "@/lib/export/workspace";

/**
 * Full workspace export (JSON). Owner only (`data.export`), re-checked here,
 * scoped to this tenant, and recorded in the audit log.
 */
export async function GET(_request: Request, context: RouteContext<"/api/w/[org]/export">) {
  const { org } = await context.params;
  const ctx = await routeTeamContext(org);
  if (!ctx || !can(ctx.role, "data.export")) return notFoundResponse();

  const db = getDb();
  const now = new Date();
  const data = buildWorkspaceExport(db, ctx.org.id, now, ctx.user.id);
  const records = Object.values(data).reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);

  db.auditLogs.push({
    id: newId("aud"),
    organizationId: ctx.org.id,
    actorUserId: ctx.user.id,
    action: "data.exported",
    entityType: "workspace",
    entityId: ctx.org.id,
    summary: `Exported all workspace data as JSON (${records.toLocaleString("en-US")} records)`,
    metadata: { records, format: "json" },
    ip: await requestIp(),
    createdAt: now.toISOString(),
  });

  return new Response(JSON.stringify(data, null, 2), {
    headers: attachmentHeaders(`${fileSlug(ctx.org.slug)}-workspace-export-${format(now, "yyyy-MM-dd")}.json`, "application/json; charset=utf-8"),
  });
}
