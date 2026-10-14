import Link from "next/link";
import { Lock } from "lucide-react";
import type { ActivityView } from "@/lib/data/views";
import { Avatar } from "@/components/ui/avatar";

export type ActivityRowItem = ActivityView & { when: string; visibility: "internal" | "client"; time?: string };

/** One line of the activity feed: avatar, sentence, project, time and an "Internal" marker. */
export function ActivityRow({ item, showProject = true }: { item: ActivityRowItem; showProject?: boolean }) {
  return (
    <div className="relative flex items-start gap-3 py-3">
      {item.actor ? (
        <Avatar user={item.actor} size="md" ring className="z-10" />
      ) : (
        <span className="z-10 h-9 w-9 flex-none rounded-full bg-surface-raised" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed">
          <span className="text-ink">{item.actor?.name ?? "Someone"}</span> <span className="text-ink-muted">{item.action}</span>{" "}
          {item.href ? (
            <Link href={item.href} className="break-words font-medium text-cyan-300 hover:text-cyan-200">
              {item.targetLabel}
            </Link>
          ) : (
            <span className="break-words font-medium text-ink-secondary">{item.targetLabel}</span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          {showProject && item.projectName && <span className="truncate">{item.projectName}</span>}
          {showProject && item.projectName && <span aria-hidden="true">·</span>}
          <span title={item.time}>{item.when}</span>
          {item.visibility === "internal" ? (
            <span className="inline-flex items-center gap-1 text-amber-300/90">
              <Lock size={11} aria-hidden="true" /> Internal
            </span>
          ) : (
            <span className="text-cyan-300/80">Visible to client</span>
          )}
        </p>
      </div>
    </div>
  );
}
