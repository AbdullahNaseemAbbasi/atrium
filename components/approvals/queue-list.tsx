import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleCheck, FileText, MessageSquare, RotateCcw, Send } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { WAITING_WARNING_DAYS, type ApprovalTab, type DecisionItem, type QueueItem } from "@/lib/data/queries/approvals";
import { Avatar, AvatarStack, BrandTile } from "@/components/ui/avatar";
import { Badge, DeliverableStatusBadge } from "@/components/ui/badge";

function Subject({ title, version, project, client }: Pick<QueueItem, "title" | "version" | "project" | "client">) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {client ? (
        <BrandTile name={client.name} hue={client.hue} />
      ) : (
        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white/[0.05] text-ink-muted" aria-hidden="true">
          <FileText size={16} />
        </span>
      )}
      <div className="min-w-0">
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-medium text-ink group-hover:text-cyan-200">{title}</span>
          <span className="flex-none text-xs text-ink-faint">v{version}</span>
        </p>
        <p className="truncate text-xs text-ink-faint">
          {project.name} · {client?.name ?? "Internal"}
        </p>
      </div>
    </div>
  );
}

const ROW = "group flex flex-col gap-3 px-4 py-4 transition hover:bg-white/[0.02] focus-visible:bg-white/[0.03] sm:px-5 lg:flex-row lg:items-center";

/** Rows for the waiting, changes and drafts tabs. */
export function QueueList({ items, tab }: { items: QueueItem[]; tab: Exclude<ApprovalTab, "decided"> }) {
  return (
    <ul className="divide-y divide-white/[0.05]">
      {items.map((item) => {
        const late = tab === "waiting" && item.waitingDays > WAITING_WARNING_DAYS;
        return (
          <li key={item.id}>
            <Link href={item.href} className={ROW}>
              <div className="min-w-0 lg:w-[38%]">
                <Subject {...item} />
              </div>

              <div className="min-w-0 flex-1 pl-12 text-xs text-ink-muted lg:pl-0">
                {tab === "waiting" && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span title={formatDateTime(item.at)}>Sent {item.atText}</span>
                    {late ? (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-300">
                        <AlertTriangle size={13} aria-hidden="true" /> {item.waitingDays} days waiting
                      </span>
                    ) : (
                      <span className="text-ink-faint">{item.waitingDays === 0 ? "Sent today" : `${item.waitingDays} ${item.waitingDays === 1 ? "day" : "days"} waiting`}</span>
                    )}
                    {item.reviewers.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-faint">
                        <AvatarStack users={item.reviewers} size="xs" max={3} /> {item.reviewers.length === 1 ? item.reviewers[0].name : `${item.reviewers.length} approvers`}
                      </span>
                    ) : (
                      <span className="text-red-300">No approver on the portal</span>
                    )}
                  </div>
                )}
                {tab === "changes" && (
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {item.decision?.by && <Avatar user={item.decision.by} size="xs" />}
                      <span className="text-ink-secondary">{item.decision?.by?.name ?? "The client"}</span>
                      <span className="text-ink-faint" title={formatDateTime(item.at)}>
                        asked for changes on v{item.decision?.version ?? item.version} · {item.atText}
                      </span>
                    </p>
                    {item.decision?.comment && <p className="line-clamp-2 text-ink-muted">“{item.decision.comment}”</p>}
                  </div>
                )}
                {tab === "drafts" && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span title={formatDateTime(item.at)}>
                      {item.uploadedBy ? `${item.uploadedBy.name} uploaded v${item.version}` : `v${item.version} uploaded`} · {item.atText}
                    </span>
                    {item.blocker ? (
                      <span className="text-amber-300/90">{item.blocker}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-cyan-300">
                        <Send size={12} aria-hidden="true" /> Ready to send
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pl-12 lg:justify-end lg:pl-0">
                <span className="flex items-center gap-3">
                  {item.commentCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-faint" aria-label={`${item.commentCount} comments`}>
                      <MessageSquare size={12} aria-hidden="true" /> {item.commentCount}
                    </span>
                  )}
                  {late ? <Badge tone="amber">Nudge client</Badge> : <DeliverableStatusBadge status={item.status} />}
                </span>
                <ChevronRight size={16} className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Rows for the "Recently decided" tab, one per client decision. */
export function DecisionList({ items }: { items: DecisionItem[] }) {
  return (
    <ul className="divide-y divide-white/[0.05]">
      {items.map((item) => {
        const approved = item.decision === "approved";
        return (
          <li key={item.id}>
            <Link href={item.href} className={ROW}>
              <div className="min-w-0 lg:w-[38%]">
                <Subject title={item.title} version={item.version} project={item.project} client={item.client} />
              </div>
              <div className="min-w-0 flex-1 space-y-1 pl-12 text-xs lg:pl-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {item.by && <Avatar user={item.by} size="xs" />}
                  <span className="text-ink-secondary">{item.by?.name ?? "The client"}</span>
                  <span className={approved ? "text-emerald-300" : "text-red-300"}>{approved ? "approved" : "requested changes on"}</span>
                  <span className="text-ink-faint">v{item.version}</span>
                </p>
                {item.comment && <p className="line-clamp-2 text-ink-muted">“{item.comment}”</p>}
              </div>
              <div className="flex items-center justify-between gap-3 pl-12 lg:justify-end lg:pl-0">
                <span className="flex items-center gap-3">
                  <span className="text-xs text-ink-faint" title={formatDateTime(item.decidedAt)}>
                    {item.decidedText}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                      approved ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300",
                    )}
                  >
                    {approved ? <CircleCheck size={13} aria-hidden="true" /> : <RotateCcw size={13} aria-hidden="true" />}
                    {approved ? "Approved" : "Changes"}
                  </span>
                </span>
                <ChevronRight size={16} className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
