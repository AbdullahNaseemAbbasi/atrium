"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/context";
import { findOrgBySlug, resolveClientContext, resolveTeamContext } from "@/lib/data/access";
import { getDb, saveDb } from "@/lib/data/store";

/** The caller must belong to the workspace (as team or client) to touch its notifications. */
async function scope(orgSlug: string) {
  const user = await requireUser();
  const db = await getDb();
  const org = findOrgBySlug(db, orgSlug);
  if (!org || !(resolveTeamContext(db, user.id, orgSlug) || resolveClientContext(db, user.id, orgSlug))) {
    throw new Error("Not found");
  }
  return { db, user, org };
}

export async function markAllNotificationsRead(orgSlug: string) {
  const { db, user, org } = await scope(orgSlug);
  const now = new Date().toISOString();
  for (const item of db.notifications) {
    if (item.recipientUserId === user.id && item.organizationId === org.id && !item.readAt) item.readAt = now;
  }
  await saveDb();
  refresh();
}

export async function markNotificationRead(orgSlug: string, notificationId: string) {
  const { db, user, org } = await scope(orgSlug);
  const item = db.notifications.find(
    (row) => row.id === notificationId && row.recipientUserId === user.id && row.organizationId === org.id,
  );
  if (item && !item.readAt) item.readAt = new Date().toISOString();
  await saveDb();
  refresh();
}
