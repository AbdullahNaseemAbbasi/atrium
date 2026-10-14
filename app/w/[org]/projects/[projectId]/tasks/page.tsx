import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, List, ListTodo, Lock } from "lucide-react";
import { cn, firstParam } from "@/lib/utils";
import { getProjectTasks } from "@/lib/data/queries/projects";
import { PRIORITY, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER } from "@/lib/domain/labels";
import { Card } from "@/components/ui/card";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, Skeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { ParamSelect, SearchInput } from "@/components/ui/interactive";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { NewTaskButton } from "@/components/tasks/new-task-button";

export const metadata: Metadata = { title: "Project tasks" };

export default function ProjectTasksPage({ params, searchParams }: PageProps<"/w/[org]/projects/[projectId]/tasks">) {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
      <ProjectTasks params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectTasks({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org, projectId }, query] = await Promise.all([params, searchParams]);
  const data = await getProjectTasks(org, projectId, {
    view: firstParam(query.view),
    status: firstParam(query.status),
    assignee: firstParam(query.assignee),
    priority: firstParam(query.priority),
    q: firstParam(query.q),
    task: firstParam(query.task),
  });
  const base = `${data.projectBase}/tasks`;
  const viewHref = (view: "board" | "list") => {
    const next = new URLSearchParams();
    if (data.filters.q) next.set("q", data.filters.q);
    if (data.filters.assignee) next.set("assignee", data.filters.assignee);
    if (data.filters.priority) next.set("priority", data.filters.priority);
    if (view === "list") next.set("view", "list");
    return `${base}${next.size ? `?${next}` : ""}`;
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput placeholder="Search tasks…" className="lg:w-72" />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <ParamSelect
            param="assignee"
            label="Filter by assignee"
            className="sm:w-48"
            options={[{ value: "", label: "All assignees" }, { value: "none", label: "Unassigned" }, ...data.members.map((member) => ({ value: member.id, label: member.name }))]}
          />
          <ParamSelect
            param="priority"
            label="Filter by priority"
            className="sm:w-44"
            options={[{ value: "", label: "Any priority" }, ...PRIORITY_ORDER.map((priority) => ({ value: priority, label: PRIORITY[priority].label }))]}
          />
          {data.view === "list" && (
            <ParamSelect
              param="status"
              label="Filter by status"
              className="sm:w-44"
              options={[{ value: "", label: "Any status" }, ...TASK_STATUS_ORDER.map((status) => ({ value: status, label: TASK_STATUS[status].label }))]}
            />
          )}
        </div>
        <div className="flex items-center gap-3 lg:ml-auto">
          <div className="inline-flex rounded-xl border border-line bg-white/[0.02] p-1" role="group" aria-label="Task view">
            {(
              [
                { view: "board", label: "Board", icon: Columns3 },
                { view: "list", label: "List", icon: List },
              ] as const
            ).map((option) => (
              <Link
                key={option.view}
                href={viewHref(option.view)}
                scroll={false}
                aria-current={data.view === option.view ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition",
                  data.view === option.view ? "bg-cyan-500/15 text-cyan-200" : "text-ink-muted hover:text-ink",
                )}
              >
                <option.icon size={14} aria-hidden="true" /> {option.label}
              </Link>
            ))}
          </div>
          {data.canWork && (
            <NewTaskButton orgSlug={data.orgSlug} projectId={data.projectId} members={data.members} milestones={data.milestones} projectShared={data.projectShared} />
          )}
        </div>
      </div>

      {data.rows.length === 0 && !data.filters.q && !data.filters.assignee && !data.filters.priority && !data.filters.status ? (
        <Card>
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Break the work into tasks, assign owners and set due dates. Mark the ones the client should follow as visible."
            action={
              data.canWork ? (
                <NewTaskButton orgSlug={data.orgSlug} projectId={data.projectId} members={data.members} milestones={data.milestones} projectShared={data.projectShared} />
              ) : undefined
            }
          />
        </Card>
      ) : data.view === "board" ? (
        <TaskBoard tasks={data.rows} orgSlug={data.orgSlug} canWork={data.canWork} />
      ) : (
        <Card>
          {data.rows.length === 0 ? (
            <EmptyState icon={ListTodo} title="No tasks match" description="Try clearing a filter." compact />
          ) : (
            <TableWrap className="pt-4">
              <Table className="min-w-[820px]">
                <THead>
                  <Th>Task</Th>
                  <Th>Assignee</Th>
                  <Th>Priority</Th>
                  <Th>Due</Th>
                  <Th>Milestone</Th>
                  <Th>Status</Th>
                </THead>
                <tbody>
                  {data.rows.map((task) => (
                    <Tr key={task.id}>
                      <Td className="font-medium text-ink">
                        <Link href={`${base}?view=list&task=${task.id}`} scroll={false} className="inline-flex items-center gap-2 hover:text-cyan-300">
                          {task.title}
                          {!task.clientVisible && <Lock size={12} className="text-amber-300/80" aria-label="Internal task" />}
                        </Link>
                      </Td>
                      <Td>
                        {task.assignee ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <Avatar user={task.assignee} size="xs" /> {task.assignee.name}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Unassigned</span>
                        )}
                      </Td>
                      <Td>
                        <PriorityBadge priority={task.priority} />
                      </Td>
                      <Td className={cn("whitespace-nowrap", task.overdue && "text-red-300")}>{task.dueText}</Td>
                      <Td className="text-xs">{task.milestone?.title ?? "—"}</Td>
                      <Td>
                        <TaskStatusBadge status={task.status} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      )}

      <TaskDrawer
        task={data.selected}
        orgSlug={data.orgSlug}
        members={data.members}
        milestones={data.milestones}
        canWork={data.canWork}
        projectShared={data.projectShared}
      />
    </>
  );
}
