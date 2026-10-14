import Link from "next/link";
import { Activity } from "lucide-react";
import type { PortalActivityItem } from "@/lib/data/queries/portal";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";

/** Client-visible updates, newest first. */
export function ActivityFeed({ items, showProject = true, emptyText }: { items: PortalActivityItem[]; showProject?: boolean; emptyText?: string }) {
  if (items.length === 0) {
    return <EmptyState compact icon={Activity} title="No updates yet" description={emptyText ?? "Approvals, new versions and comments will show up here."} />;
  }
  return (
    <ol className="relative">
      <span className="absolute bottom-4 left-[15px] top-4 w-px bg-gradient-to-b from-cyan-400/35 to-transparent" aria-hidden="true" />
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3 border-b border-white/[0.04] py-3 last:border-0">
          {item.actor ? (
            <Avatar user={item.actor} size="sm" ring className="z-10" />
          ) : (
            <span className="z-10 h-8 w-8 flex-none rounded-full bg-surface-raised" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-ink-muted">
              <span className="text-ink">{item.actor?.name ?? "Someone"}</span> {item.action}{" "}
              {item.href ? (
                <Link href={item.href} className="font-medium text-cyan-300 hover:text-cyan-200">
                  {item.targetLabel}
                </Link>
              ) : (
                <span className="font-medium text-ink-secondary">{item.targetLabel}</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {showProject && item.projectName ? `${item.projectName} · ` : ""}
              {item.when}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
