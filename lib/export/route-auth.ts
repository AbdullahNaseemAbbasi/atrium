import "server-only";
import { headers } from "next/headers";
import { readSessionUserId } from "@/lib/auth/session";
import { resolveTeamContext } from "@/lib/data/access";
import { getDb } from "@/lib/data/store";

/**
 * Route handlers can't use `requireTeamContext` (it redirects / renders a
 * 404 page). They call this instead and answer 404 themselves when it
 * returns null, so a workspace's existence is never revealed.
 */
export async function routeTeamContext(orgSlug: string) {
  const userId = await readSessionUserId();
  if (!userId) return null;
  return resolveTeamContext(getDb(), userId, orgSlug);
}

export async function requestIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "local";
}

export function notFoundResponse() {
  return Response.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

/** `attachment` + a sanitised file name, never rendered inline. */
export function attachmentHeaders(fileName: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.\-]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}
