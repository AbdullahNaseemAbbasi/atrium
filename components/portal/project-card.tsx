import Link from "next/link";
import { CalendarDays, Flag, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalProjectCard } from "@/lib/data/queries/portal";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/misc";
import { ProjectIcon } from "@/components/projects/project-icon";

/** A shared project as the client sees it: progress, the next milestone and who leads it. */
export function ProjectCard({ project, base, hue }: { project: PortalProjectCard; base: string; hue: number }) {
  const done = project.status === "completed";
  return (
    <Link
      href={`${base}/projects/${project.id}`}
      className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/25"
    >
      <div className="flex items-start gap-3">
        <ProjectIcon icon={project.icon} hue={hue} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink group-hover:text-cyan-200">{project.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <CalendarDays size={12} aria-hidden="true" /> {project.dueText}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      {project.description && <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{project.description}</p>}

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-ink-faint">
            {project.milestonesDone} of {project.milestonesTotal} milestones done
          </span>
          <span className="tabular-nums text-ink-secondary">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} label={`${project.name} progress`} tone={done ? "emerald" : "cyan"} />
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-start gap-2.5 border-t border-line pt-4 text-sm">
          <Flag size={15} className={cn("mt-0.5 flex-none", project.nextMilestone ? "text-cyan-300" : "text-emerald-400")} aria-hidden="true" />
          {project.nextMilestone ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink-secondary">
                <span className="text-ink-faint">Next: </span>
                {project.nextMilestone.title}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">{project.nextMilestone.dueText}</p>
            </div>
          ) : (
            <p className="text-ink-secondary">All milestones complete</p>
          )}
          {project.nextMilestone?.needsApproval ? (
            <span className="inline-flex flex-none items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200">
              <ShieldCheck size={12} aria-hidden="true" /> Needs your approval
            </span>
          ) : project.nextMilestone?.approvalRequired ? (
            <span className="inline-flex flex-none items-center gap-1 text-[11px] text-ink-faint">
              <ShieldCheck size={12} aria-hidden="true" /> Your sign-off
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {project.lead ? (
            <span className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
              <Avatar user={project.lead} size="xs" />
              <span className="truncate">{project.lead.name} · Project lead</span>
            </span>
          ) : (
            <span />
          )}
          {project.pendingReviews > 0 && (
            <span className="flex-none rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
              {project.pendingReviews} to review
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
