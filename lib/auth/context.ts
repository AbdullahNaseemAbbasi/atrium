import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/data/store";
import {
  clientPortalsFor,
  resolveClientContext,
  resolveTeamContext,
  teamWorkspacesFor,
  type ClientContext,
  type TeamContext,
} from "@/lib/data/access";
import type { User } from "@/lib/data/types";
import { readSessionUserId } from "./session";

/**
 * Data Access Layer entry points. Pages, layouts and server actions call these
 * instead of reading the cookie themselves, so every request is authorized
 * close to the data. (No React `cache()` here: sharing one promise between a
 * layout and its page confuses Next.js instant-navigation validation.)
 */

export async function getCurrentUser(): Promise<User | null> {
  const userId = await readSessionUserId();
  if (!userId) return null;
  // Everything after this point is per-request: reading the clock, seeding the
  // demo store and building relative dates must not be prerendered.
  await connection();
  return (await getDb()).users.find((user) => user.id === userId) ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolves the workspace for the signed-in team member. A client user who
 * opens a team URL is sent to their portal; anyone else gets a 404 so the
 * workspace's existence is not revealed.
 */
export async function requireTeamContext(orgSlug: string): Promise<TeamContext> {
  const user = await requireUser();
  const db = await getDb();
  const ctx = resolveTeamContext(db, user.id, orgSlug);
  if (ctx) return ctx;
  if (resolveClientContext(db, user.id, orgSlug)) redirect(`/portal/${orgSlug}`);
  notFound();
}

export async function requireClientContext(orgSlug: string): Promise<ClientContext> {
  const user = await requireUser();
  const db = await getDb();
  const ctx = resolveClientContext(db, user.id, orgSlug);
  if (ctx) return ctx;
  if (resolveTeamContext(db, user.id, orgSlug)) redirect(`/w/${orgSlug}`);
  notFound();
}

export async function requirePlatformAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound();
  return user;
}

/** Where a user lands after signing in. */
export async function homePathFor(user: User) {
  const db = await getDb();
  const workspace = teamWorkspacesFor(db, user.id)[0];
  if (workspace) return `/w/${workspace.org.slug}`;
  const portal = clientPortalsFor(db, user.id)[0];
  if (portal) return `/portal/${portal.org.slug}`;
  if (user.isPlatformAdmin) return "/admin";
  return "/onboarding";
}
