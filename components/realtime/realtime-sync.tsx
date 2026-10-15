"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Keeps an open workspace or portal in sync with the database. Supabase
 * Realtime streams row changes for this organization (row-level security
 * decides which rows this person may receive), and any change refreshes the
 * server components on screen. A refresh also empties the browser's page
 * cache (staleTimes in next.config.ts), so pages visited earlier are fetched
 * fresh too. New notifications for this person also show a toast. Hidden
 * tabs wait and refresh once when they become visible again, and a dropped
 * connection refreshes once it's back, to catch up on what it missed.
 */
const TABLES = {
  team: [
    "projects",
    "project_members",
    "tasks",
    "milestones",
    "deliverables",
    "deliverable_versions",
    "approvals",
    "comments",
    "project_files",
    "activity_events",
    "clients",
    "memberships",
    "client_memberships",
    "invitations",
    "subscriptions",
    "invoices",
    "integrations",
  ],
  portal: [
    "projects",
    "project_members",
    "tasks",
    "milestones",
    "deliverables",
    "deliverable_versions",
    "approvals",
    "comments",
    "project_files",
    "activity_events",
    "clients",
    "client_memberships",
  ],
} as const;

interface NotificationRow {
  organization_id: string;
  title: string;
  body: string;
  href: string;
}

export function RealtimeSync({ orgId, userId, scope }: { orgId: string; userId: string; scope: keyof typeof TABLES }) {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stale = false;
    let cancelled = false;

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        stale = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 350);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && stale) {
        stale = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase.channel(`atrium:${scope}:${orgId}:${userId}`);
    for (const table of TABLES[scope]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `organization_id=eq.${orgId}` }, refresh);
    }
    // Workspace name and brand, and people's names and photos (only profiles this person may see).
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "organizations", filter: `id=eq.${orgId}` }, refresh);
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, refresh);
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as NotificationRow;
        if (row.organization_id !== orgId) return;
        toast(row.title, {
          description: row.body,
          action: row.href ? { label: "Open", onClick: () => router.push(row.href) } : undefined,
        });
        refresh();
      },
    );

    void (async () => {
      // Realtime checks row-level security with this token, so set it before joining.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      let joined = false;
      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // The first join is the page we already have; a later one is a reconnect.
        if (joined) refresh();
        joined = true;
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [orgId, userId, scope, router]);

  return null;
}
