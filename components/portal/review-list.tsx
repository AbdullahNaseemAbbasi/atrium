import Link from "next/link";
import { ArrowRight, Clock3, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewItem } from "@/lib/data/queries/portal";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/files/file-type-icon";

/**
 * Deliverables waiting on the client. Approvers get a large "Review" call
 * to action; viewers get a quieter "Open" link because they can't decide.
 */
export function ReviewList({ items, base, canApprove }: { items: ReviewItem[]; base: string; canApprove: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const href = `${base}/deliverables/${item.id}`;
        const long = item.waitingDays > 2;
        return (
          <li
            key={item.id}
            className="flex flex-col gap-4 rounded-2xl border border-amber-400/15 bg-gradient-to-r from-amber-500/[0.05] to-transparent p-4 sm:flex-row sm:items-center sm:p-5"
          >
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <FileTypeIcon mimeType={item.mimeType} fileName={item.fileName} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={href} className="font-semibold text-ink hover:text-cyan-300">
                    {item.title}
                  </Link>
                  <Badge tone="slate">v{item.version}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-ink-muted">
                  {item.projectName}
                  {item.milestoneTitle && <span className="text-ink-faint"> · {item.milestoneTitle}</span>}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                  <span className={cn("inline-flex items-center gap-1.5", long && "text-amber-300")}>
                    <Clock3 size={13} aria-hidden="true" />
                    {item.sentText}
                    {long && ` · waiting ${item.waitingDays} days`}
                  </span>
                  {item.commentCount > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare size={13} aria-hidden="true" />
                      {item.commentCount} {item.commentCount === 1 ? "comment" : "comments"}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href={href}
              className={buttonClasses({
                variant: canApprove ? "primary" : "secondary",
                size: "lg",
                className: "w-full sm:w-auto",
              })}
              aria-label={`${canApprove ? "Review" : "Open"} ${item.title} version ${item.version}`}
            >
              {canApprove ? `Review v${item.version}` : "Open"} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
