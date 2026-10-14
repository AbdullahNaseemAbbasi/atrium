import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { CalendarTask, TaskCalendar } from "@/lib/data/queries/tasks";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { CalendarMore, CalendarTaskChip } from "./calendar-parts";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VISIBLE_PER_DAY = 3;

export type CalendarTaskLink = CalendarTask & { href: string };

/**
 * Month grid with tasks on their due dates. Below `md` it collapses into an
 * agenda list so it stays readable on a phone.
 */
export function TaskCalendarView({
  calendar,
  monthHref,
  taskHref,
}: {
  calendar: TaskCalendar;
  monthHref: (month: string | undefined) => string;
  taskHref: (taskId: string) => string;
}) {
  const withLinks = (tasks: CalendarTask[]): CalendarTaskLink[] => tasks.map((task) => ({ ...task, href: taskHref(task.id) }));
  const agenda = calendar.days.filter((day) => day.inMonth && day.tasks.length > 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink" aria-live="polite">
            {calendar.label}
          </h2>
          <span className="text-xs text-ink-faint">
            {calendar.inMonth} {calendar.inMonth === 1 ? "task" : "tasks"} due
            {calendar.undated > 0 && ` · ${calendar.undated} without a due date not shown`}
          </span>
        </div>
        <nav aria-label="Change month" className="flex items-center gap-2">
          <Link href={monthHref(calendar.prev)} scroll={false} className={buttonClasses({ variant: "outline", size: "sm" })} aria-label="Previous month">
            <ChevronLeft size={14} /> <span className="hidden sm:inline">Prev</span>
          </Link>
          <Link
            href={monthHref(undefined)}
            scroll={false}
            aria-disabled={calendar.isCurrentMonth}
            className={buttonClasses({ variant: calendar.isCurrentMonth ? "ghost" : "secondary", size: "sm" })}
          >
            Today
          </Link>
          <Link href={monthHref(calendar.next)} scroll={false} className={buttonClasses({ variant: "outline", size: "sm" })} aria-label="Next month">
            <span className="hidden sm:inline">Next</span> <ChevronRight size={14} />
          </Link>
        </nav>
      </div>

      {/* Month grid (tablet and up) */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b border-line bg-white/[0.018]" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-3 py-2 text-xs font-medium text-ink-faint">
              {day}
            </div>
          ))}
        </div>
        <ol className="grid grid-cols-7" aria-label={`Tasks due in ${calendar.label}`}>
          {calendar.days.map((day, index) => {
            const shown = day.tasks.slice(0, VISIBLE_PER_DAY);
            const hidden = day.tasks.length - shown.length;
            const date = parseISO(day.key);
            return (
              <li
                key={day.key}
                aria-label={`${format(date, "EEEE, MMMM d")}${day.tasks.length ? `, ${day.tasks.length} ${day.tasks.length === 1 ? "task" : "tasks"}` : ""}`}
                className={cn(
                  "relative min-h-[128px] border-b border-line p-2 lg:min-h-[140px]",
                  index % 7 !== 6 && "border-r",
                  !day.inMonth && "bg-black/[0.12]",
                  day.isWeekend && day.inMonth && "bg-white/[0.012]",
                  day.isToday && "bg-cyan-500/[0.06] shadow-[inset_0_0_0_1px_rgba(34,211,238,.45)]",
                )}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={cn(
                      "grid h-6 min-w-6 place-items-center rounded-md px-1 text-xs tabular-nums",
                      day.isToday ? "bg-cyan-400 font-semibold text-on-brand shadow-[0_0_12px_rgba(34,211,238,.5)]" : day.inMonth ? "text-ink-secondary" : "text-ink-faint/60",
                    )}
                  >
                    {day.dayOfMonth}
                  </span>
                  {day.isToday && <span className="text-[10px] font-medium uppercase tracking-wider text-cyan-300">Today</span>}
                </div>
                <ul className="space-y-1">
                  {withLinks(shown).map((task) => (
                    <li key={task.id}>
                      <CalendarTaskChip task={task} />
                    </li>
                  ))}
                </ul>
                {hidden > 0 && <CalendarMore count={hidden} label={format(date, "EEEE, MMMM d")} tasks={withLinks(day.tasks)} />}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Agenda (phones) */}
      <div className="md:hidden">
        {agenda.length === 0 ? (
          <EmptyState compact icon={CalendarDays} title="Nothing due this month" description="Try another month or clear a filter." />
        ) : (
          <ol className="divide-y divide-line">
            {agenda.map((day) => (
              <li key={day.key} className={cn("p-4", day.isToday && "bg-cyan-500/[0.05]")}>
                <p className={cn("mb-2 text-xs font-medium", day.isToday ? "text-cyan-300" : "text-ink-faint")}>
                  {format(parseISO(day.key), "EEEE, MMM d")}
                  {day.isToday && " · Today"}
                </p>
                <ul className="space-y-1.5">
                  {withLinks(day.tasks).map((task) => (
                    <li key={task.id}>
                      <CalendarTaskChip task={task} roomy />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
