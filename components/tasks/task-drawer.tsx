"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import { CalendarDays, Flag, Lock, Trash2, User, X } from "lucide-react";
import { toast } from "sonner";
import { addTaskComment, deleteTask, updateTask } from "@/lib/actions/tasks";
import type { UserLite } from "@/lib/data/views";
import { formatDate } from "@/lib/utils";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentThread, type ThreadComment } from "@/components/comments/comment-thread";
import type { BoardTask } from "./task-board";
import { TaskForm } from "./task-form";

export type DrawerTask = BoardTask & { createdBy: UserLite; comments: ThreadComment[] };

/** Right-hand task panel driven by the `?task=` search param. */
export function TaskDrawer({
  task,
  orgSlug,
  members,
  milestones,
  canWork,
  projectShared,
}: {
  task: DrawerTask | null;
  orgSlug: string;
  members: UserLite[];
  milestones: { id: string; title: string }[];
  canWork: boolean;
  projectShared: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const editing = Boolean(task && editingId === task.id);
  const setEditing = (value: boolean) => setEditingId(value && task ? task.id : null);
  const [deleting, startDelete] = React.useTransition();

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("task");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  return (
    <RadixDialog.Root open={Boolean(task)} onOpenChange={(open) => !open && close()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[#020a10]/60 backdrop-blur-[2px]" />
        <RadixDialog.Content
          className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-[560px] flex-col border-l border-cyan-500/15 bg-[#0b1722] shadow-[0_0_80px_rgba(0,0,0,0.6)] focus:outline-none"
          aria-describedby={undefined}
        >
          {task && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-line p-5">
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">
                    {task.project.name}
                    {task.milestone ? ` · ${task.milestone.title}` : ""}
                  </p>
                  <RadixDialog.Title className="mt-1 text-lg font-semibold leading-snug text-ink">{task.title}</RadixDialog.Title>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <TaskStatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {!task.clientVisible && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                        <Lock size={12} aria-hidden="true" /> Internal
                      </span>
                    )}
                  </div>
                </div>
                <RadixDialog.Close className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink" aria-label="Close task">
                  <X size={18} />
                </RadixDialog.Close>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-5">
                {editing ? (
                  <TaskForm
                    action={updateTask.bind(null, orgSlug, task.id)}
                    members={members}
                    milestones={milestones}
                    defaults={task}
                    submitLabel="Save changes"
                    projectShared={projectShared}
                    onDone={() => {
                      setEditing(false);
                      toast.success("Task saved");
                    }}
                    footer={
                      <Button variant="ghost" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <Meta icon={User} label="Assignee" value={task.assignee?.name ?? "Unassigned"} />
                      <Meta icon={CalendarDays} label="Due" value={task.dueAt ? `${formatDate(task.dueAt)} · ${task.dueText}` : "No due date"} danger={task.overdue} />
                      <Meta icon={Flag} label="Milestone" value={task.milestone?.title ?? "None"} />
                      <Meta icon={User} label="Created by" value={task.createdBy.name} />
                    </dl>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Details</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                        {task.description || "No details yet."}
                      </p>
                    </div>
                    {canWork && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                          Edit task
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={deleting}
                          onClick={() => {
                            if (!window.confirm(`Delete “${task.title}”? This can't be undone.`)) return;
                            startDelete(async () => {
                              await deleteTask(orgSlug, task.id);
                              toast.success("Task deleted");
                              close();
                            });
                          }}
                        >
                          <Trash2 size={14} /> Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}

                <section aria-labelledby="task-comments">
                  <h3 id="task-comments" className="mb-4 text-sm font-semibold text-ink">
                    Comments <span className="text-ink-faint">({task.comments.length})</span>
                  </h3>
                  <CommentThread
                    comments={task.comments}
                    action={addTaskComment.bind(null, orgSlug, task.id)}
                    canChooseVisibility={false}
                    defaultVisibility="internal"
                    canPost={canWork}
                    emptyText="No comments on this task yet."
                  />
                </section>
              </div>
            </>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function Meta({ icon: Icon, label, value, danger = false }: { icon: typeof User; label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon size={13} aria-hidden="true" /> {label}
      </dt>
      <dd className={danger ? "mt-1 text-red-300" : "mt-1 text-ink-secondary"}>{value}</dd>
    </div>
  );
}
