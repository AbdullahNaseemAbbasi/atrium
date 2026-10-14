import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Columns3, List, ListTodo, Lock, MessageSquare, SearchX, UserCheck } from "lucide-react";
import { cn, firstParam } from "@/lib/utils";
import { DUE_FILTERS, getWorkspaceTasks, type WorkspaceTaskRow, type WorkspaceTasks } from "@/lib/data/queries/tasks";
import { PRIORITY, PRIORITY_ORDER } from "@/lib/domain/labels";
import { Card } from "@/components/ui/card";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, FilterChips, PageHeader, Pagination, Skeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { ParamSelect, SearchInput } from "@/components/ui/interactive";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { NewWorkspaceTaskButton } from "@/components/workspace-tasks/new-task-dialog";
import { TaskCalendarView } from "@/components/workspace-tasks/task-calendar";

export const metadata: Metadata = { title: "Tasks" };

type Search = Record<string, string | string[] | undefined>;

export default function TasksPage({ params, searchParams }: PageProps<"/w/[org]/tasks">) {
  return (
    <Suspense fallback={<TasksSkeleton />}>
      <Tasks params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Tasks({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getWorkspaceTasks(org, {
    view: firstParam(query.view),
    scope: firstParam(query.scope),
    status: firstParam(query.status),
    priority: firstParam(query.priority),
    project: firstParam(query.project),
    due: firstParam(query.due),
    q: firstParam(query.q),
    page: firstParam(query.page),
    month: firstParam(query.month),
    task: firstParam(query.task),
  });
  const { filters } = data;
  const currentPage = data.page && data.page.page > 1 ? String(data.page.page) : undefined;

  const href = (patch: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      view: filters.view === "list" ? undefined : filters.view,
      scope: filters.scope === "mine" ? "mine" : undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      project: filters.project || undefined,
      due: filters.due || undefined,
      q: filters.q || undefined,
      month: filters.view === "calendar" && filters.month !== data.calendar?.current ? filters.month : undefined,
      page: currentPage,
      ...patch,
    };
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const qs = next.toString();
    return `${data.base}/tasks${qs ? `?${qs}` : ""}`;
  };
  const taskHref = (taskId: string) => href({ task: taskId });

  const statusChips = [
    { key: "", label: "Any status" },
    { key: "open", label: "Open" },
    { key: "todo", label: "To do" },
    { key: "in_progress", label: "In progress" },
    { key: "in_review", label: "In review" },
    { key: "blocked", label: "Blocked" },
    { key: "done", label: "Done" },
  ].map((chip) => ({
    label: chip.label,
    count: data.statusCounts[chip.key || "all"] ?? 0,
    active: filters.status === chip.key,
    href: href({ status: chip.key || undefined, page: undefined }),
  }));

  const views = [
    { view: "list", label: "List", icon: List },
    { view: "board", label: "Board", icon: Columns3 },
    { view: "calendar", label: "Calendar", icon: CalendarDays },
  ] as const;

  const newTask = data.canWork && data.newTaskProjects.length > 0 && (
    <NewWorkspaceTaskButton orgSlug={data.orgSlug} projects={data.newTaskProjects} defaultProjectId={filters.project || undefined} size="lg" />
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description={
          filters.scope === "mine"
            ? "Everything assigned to you, across every project you work on."
            : (data.scopeNote ?? "Every task across your projects, in one list, board or calendar.")
        }
        actions={newTask}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <SearchInput placeholder="Search tasks or projects…" className="xl:w-72" />
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 xl:flex xl:justify-end">
            <ParamSelect
              param="project"
              label="Filter by project"
              className="col-span-2 sm:col-span-1 xl:w-52"
              options={[{ value: "", label: "All projects" }, ...data.projects.map((project) => ({ value: project.id, label: project.name }))]}
            />
            <ParamSelect
              param="priority"
              label="Filter by priority"
              className="xl:w-40"
              options={[{ value: "", label: "Any priority" }, ...PRIORITY_ORDER.map((priority) => ({ value: priority, label: PRIORITY[priority].label }))]}
            />
            <ParamSelect
              param="due"
              label="Filter by due date"
              className="xl:w-48"
              options={[{ value: "", label: "Any due date" }, ...Object.entries(DUE_FILTERS).map(([value, label]) => ({ value, label }))]}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-line bg-white/[0.02] p-1" role="group" aria-label="Whose tasks">
              {(
                [
                  { scope: "all", label: "All tasks", count: data.scopeCounts.all },
                  { scope: "mine", label: "Assigned to me", count: data.scopeCounts.mine },
                ] as const
              ).map((option) => (
                <Link
                  key={option.scope}
                  href={href({ scope: option.scope === "mine" ? "mine" : undefined, page: undefined })}
                  scroll={false}
                  aria-current={filters.scope === option.scope ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition",
                    filters.scope === option.scope ? "bg-cyan-500/15 text-cyan-200" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {option.scope === "mine" && <UserCheck size={13} aria-hidden="true" />}
                  {option.label}
                  <span className="tabular-nums text-ink-faint">{option.count} open</span>
                </Link>
              ))}
            </div>
            {filters.view !== "board" && <FilterChips label="Filter by status" items={statusChips} />}
          </div>
          <div className="inline-flex self-start rounded-xl border border-line bg-white/[0.02] p-1 lg:self-auto" role="group" aria-label="Task view">
            {views.map((option) => (
              <Link
                key={option.view}
                href={href({ view: option.view === "list" ? undefined : option.view, page: undefined, month: undefined })}
                scroll={false}
                aria-current={filters.view === option.view ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition",
                  filters.view === option.view ? "bg-cyan-500/15 text-cyan-200" : "text-ink-muted hover:text-ink",
                )}
              >
                <option.icon size={14} aria-hidden="true" /> {option.label}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <Results data={data} href={href} taskHref={taskHref} newTask={newTask} />
      </div>

      <TaskDrawer
        task={data.selected}
        orgSlug={data.orgSlug}
        members={data.drawer.members}
        milestones={data.drawer.milestones}
        canWork={data.drawer.canWork}
        projectShared={data.drawer.projectShared}
      />
    </>
  );
}

function Results({
  data,
  href,
  taskHref,
  newTask,
}: {
  data: WorkspaceTasks;
  href: (patch: Record<string, string | undefined>) => string;
  taskHref: (taskId: string) => string;
  newTask: ReactNode;
}) {
  const { filters } = data;

  if (data.totalVisible === 0) {
    return (
      <Card>
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description={
            data.newTaskProjects.length > 0
              ? "Break project work into tasks with owners and due dates. They all show up here."
              : "You aren't on a project yet. Once a manager adds you, its tasks appear here."
          }
          action={newTask || undefined}
        />
      </Card>
    );
  }

  if (filters.view === "calendar" && data.calendar) {
    return <TaskCalendarView calendar={data.calendar} monthHref={(month) => href({ month, page: undefined })} taskHref={taskHref} />;
  }

  if (data.resultCount === 0 && filters.view !== "calendar") {
    const onlyScope = filters.scope === "mine" && !data.hasFilters;
    return (
      <Card>
        <EmptyState
          icon={onlyScope ? UserCheck : SearchX}
          title={onlyScope ? "Nothing assigned to you" : "No tasks match these filters"}
          description={onlyScope ? "When someone assigns you a task it lands here. You can still browse the whole team's work." : "Try a different status, project or due date, or clear the search."}
          action={
            <Link href={onlyScope ? href({ scope: undefined }) : `${data.base}/tasks${filters.view === "list" ? "" : `?view=${filters.view}`}`} className={buttonClasses({ variant: "secondary" })}>
              {onlyScope ? "See all tasks" : "Clear filters"}
            </Link>
          }
        />
      </Card>
    );
  }

  if (filters.view === "board" && data.board) {
    return <TaskBoard tasks={data.board} orgSlug={data.orgSlug} canWork={data.canWork} showProject />;
  }

  if (!data.page) return null;
  const rows = data.page.items;
  return (
    <Card>
      <TableWrap className="hidden pt-4 md:block">
        <Table className="min-w-[860px]">
          <THead>
            <Th>Task</Th>
            <Th>Project</Th>
            <Th>Assignee</Th>
            <Th>Priority</Th>
            <Th>Due</Th>
            <Th>Status</Th>
          </THead>
          <tbody>
            {rows.map((task) => (
              <Tr key={task.id}>
                <Td className="max-w-[320px]">
                  <Link href={taskHref(task.id)} scroll={false} className="inline-flex items-center gap-2 font-medium text-ink hover:text-cyan-300">
                    <span className="truncate">{task.title}</span>
                    {!task.clientVisible && <Lock size={12} className="flex-none text-amber-300/80" aria-label="Internal task" />}
                  </Link>
                  {(task.milestone || task.commentCount > 0) && (
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                      {task.milestone && <span className="truncate">{task.milestone.title}</span>}
                      {task.commentCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={11} aria-hidden="true" /> {task.commentCount}
                        </span>
                      )}
                    </p>
                  )}
                </Td>
                <Td>
                  <Link href={`${data.base}/projects/${task.project.id}/tasks`} className="block whitespace-nowrap text-ink-secondary hover:text-cyan-300">
                    {task.project.name}
                  </Link>
                  <span className="text-xs text-ink-faint">{task.clientName ?? "Internal"}</span>
                </Td>
                <Td>
                  <Assignee task={task} />
                </Td>
                <Td>
                  <PriorityBadge priority={task.priority} />
                </Td>
                <Td className={cn("whitespace-nowrap", task.overdue && "text-red-300")}>{task.dueText}</Td>
                <Td>
                  <TaskStatusBadge status={task.status} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <ul className="divide-y divide-line md:hidden">
        {rows.map((task) => (
          <li key={task.id}>
            <Link href={taskHref(task.id)} scroll={false} className="block p-4 transition hover:bg-white/[0.02]">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 font-medium text-ink">
                  <span className="truncate">{task.title}</span>
                  {!task.clientVisible && <Lock size={12} className="flex-none text-amber-300/80" aria-label="Internal task" />}
                </p>
                <TaskStatusBadge status={task.status} />
              </div>
              <p className="mt-1 truncate text-xs text-ink-faint">
                {task.project.name} · {task.clientName ?? "Internal"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                <PriorityBadge priority={task.priority} />
                <span className={cn("whitespace-nowrap", task.overdue ? "text-red-300" : "text-ink-muted")}>{task.dueText}</span>
                <span className="ml-auto">
                  <Assignee task={task} compact />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="pt-4 md:pt-0">
        <Pagination
          page={data.page.page}
          pageCount={data.page.pageCount}
          total={data.page.total}
          pageSize={data.page.pageSize}
          hrefFor={(page) => href({ page: page > 1 ? String(page) : undefined })}
        />
      </div>
    </Card>
  );
}

function Assignee({ task, compact = false }: { task: WorkspaceTaskRow; compact?: boolean }) {
  if (!task.assignee) return <span className="text-xs text-ink-faint">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-ink-secondary">
      <Avatar user={task.assignee} size="xs" />
      <span className={compact ? "text-xs" : undefined}>{compact ? task.assignee.name.split(" ")[0] : task.assignee.name}</span>
    </span>
  );
}

function TasksSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[132px] rounded-2xl" />
      <div className="card mt-4 space-y-3 p-5">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
