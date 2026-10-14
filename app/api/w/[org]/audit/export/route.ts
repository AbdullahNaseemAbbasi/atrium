import type { NextRequest } from "next/server";
import { format } from "date-fns";
import { can } from "@/lib/auth/permissions";
import { filterAuditLogs, normaliseAuditQuery, toAuditRow } from "@/lib/data/queries/settings";
import { getDb, newId } from "@/lib/data/store";
import { fileSlug, toCsv } from "@/lib/export/csv";
import { attachmentHeaders, notFoundResponse, requestIp, routeTeamContext } from "@/lib/export/route-auth";

/**
 * Audit log CSV export. Re-checks the session and `audit.view` (the page
 * check isn't enough: this URL can be opened directly), applies the same
 * filters as the page, escapes every cell against formula injection and
 * records the export in the audit log itself.
 */
export async function GET(request: NextRequest, context: RouteContext<"/api/w/[org]/audit/export">) {
  const { org } = await context.params;
  const ctx = await routeTeamContext(org);
  if (!ctx || !can(ctx.role, "audit.view")) return notFoundResponse();

  const db = getDb();
  const now = new Date();
  const search = request.nextUrl.searchParams;
  const filters = normaliseAuditQuery({
    action: search.get("action") ?? undefined,
    actor: search.get("actor") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
  });
  const rows = filterAuditLogs(db.auditLogs, ctx.org.id, filters).map((log) => toAuditRow(db, log, now));

  const csv = toCsv(
    ["Time (UTC)", "Actor", "Actor email", "Action", "Summary", "Entity type", "Entity ID", "IP address", "Metadata"],
    rows.map((row) => [
      row.createdAt,
      row.actorLabel,
      row.actor?.email ?? "",
      row.actionLabel,
      row.summary,
      row.entityType,
      row.entityId,
      row.ip ?? "",
      row.metadata.map((item) => `${item.key}=${item.value}`).join("; "),
    ]),
  );

  db.auditLogs.push({
    id: newId("aud"),
    organizationId: ctx.org.id,
    actorUserId: ctx.user.id,
    action: "data.exported",
    entityType: "audit_log",
    entityId: ctx.org.id,
    summary: `Exported ${rows.length} audit log ${rows.length === 1 ? "entry" : "entries"} as CSV`,
    metadata: {
      rows: rows.length,
      format: "csv",
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.actor ? { actor: filters.actor } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    },
    ip: await requestIp(),
    createdAt: now.toISOString(),
  });

  return new Response(csv, {
    headers: attachmentHeaders(`${fileSlug(ctx.org.slug)}-audit-log-${format(now, "yyyy-MM-dd")}.csv`, "text/csv; charset=utf-8"),
  });
}
