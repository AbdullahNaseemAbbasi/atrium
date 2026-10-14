"use client";

import * as React from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/lib/actions/tasks";
import type { NewTaskProject } from "@/lib/data/queries/tasks";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { TaskForm } from "@/components/tasks/task-form";

/**
 * "New task" from the workspace task list: pick the project first, then the
 * regular task form loads that project's people and milestones.
 */
export function NewWorkspaceTaskButton({
  orgSlug,
  projects,
  defaultProjectId,
  variant = "primary",
  size = "md",
}: {
  orgSlug: string;
  projects: NewTaskProject[];
  defaultProjectId?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [open, setOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const initial = projects.some((project) => project.id === defaultProjectId) ? defaultProjectId! : (projects[0]?.id ?? "");
  const [projectId, setProjectId] = React.useState(initial);
  const project = projects.find((item) => item.id === projectId) ?? null;
  const onDone = React.useCallback(() => {
    setOpen(false);
    toast.success("Task added");
  }, []);

  if (projects.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setProjectId(initial);
          setFormKey((key) => key + 1);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus size={16} /> New task
        </Button>
      </DialogTrigger>
      <DialogContent title="New task" description="Choose the project, then describe the work. Assignees get notified." size="lg">
        <div className="mb-5 space-y-2">
          <Field label="Project" htmlFor="new-task-project" required hint={project ? projectHint(project) : undefined}>
            <Select
              id="new-task-project"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setFormKey((key) => key + 1);
              }}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.clientName ? ` · ${item.clientName}` : " · Internal"}
                </option>
              ))}
            </Select>
          </Field>
          {project && (
            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
              {project.shared ? <Eye size={13} className="text-cyan-300" aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
              {project.shared ? "Shared with the client portal" : "Not shared with a client"}
            </p>
          )}
        </div>
        {project && (
          <TaskForm
            key={`${project.id}-${formKey}`}
            action={createTask.bind(null, orgSlug, project.id)}
            members={project.members}
            milestones={project.milestones}
            submitLabel="Add task"
            projectShared={project.shared}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function projectHint(project: NewTaskProject) {
  const people = project.members.length;
  return `${people} ${people === 1 ? "person" : "people"} on this project${project.milestones.length ? ` · ${project.milestones.length} milestones` : ""}`;
}
