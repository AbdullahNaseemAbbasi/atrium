"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";
import { ActivityRow, type ActivityRowItem } from "@/components/activity/activity-row";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "client", label: "Client-visible" },
  { key: "internal", label: "Internal" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

/** Client activity with a switch between what the client sees on their portal and internal-only events. */
export function ClientActivity({ items, limit = 12 }: { items: ActivityRowItem[]; limit?: number }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [expanded, setExpanded] = React.useState(false);
  const counts: Record<Filter, number> = {
    all: items.length,
    client: items.filter((item) => item.visibility === "client").length,
    internal: items.filter((item) => item.visibility === "internal").length,
  };
  const filtered = filter === "all" ? items : items.filter((item) => item.visibility === filter);
  const shown = expanded ? filtered : filtered.slice(0, limit);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 px-4 sm:px-5" role="group" aria-label="Filter activity by visibility">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs transition",
              filter === item.key
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,.2)]"
                : "border-white/[0.08] bg-white/[0.02] text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
            <span className="ml-1.5 tabular-nums text-ink-faint">{counts[item.key]}</span>
          </button>
        ))}
      </div>
      <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        {shown.length === 0 ? (
          <EmptyState
            compact
            icon={Activity}
            title={filter === "internal" ? "No internal activity" : filter === "client" ? "Nothing the client has seen yet" : "No activity yet"}
            description="Uploads, reviews, comments and project changes for this client appear here."
          />
        ) : (
          <ol className="divide-y divide-white/[0.04]">
            {shown.map((item) => (
              <li key={item.id}>
                <ActivityRow item={item} />
              </li>
            ))}
          </ol>
        )}
        {filtered.length > limit && (
          <div className="mt-3 flex justify-center">
            <button type="button" onClick={() => setExpanded((value) => !value)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
              {expanded ? "Show less" : `Show ${filtered.length - limit} more`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
