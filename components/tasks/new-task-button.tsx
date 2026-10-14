"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/lib/actions/tasks";
import type { UserLite } from "@/lib/data/views";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TaskForm } from "./task-form";

export function NewTaskButton({
  orgSlug,
  projectId,
  members,
  milestones,
  projectShared,
}: {
  orgSlug: string;
  projectId: string;
  members: UserLite[];
  milestones: { id: string; title: string }[];
  projectShared: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  // Remount the form each time the dialog opens so it starts empty.
  const [formKey, setFormKey] = React.useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((key) => key + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New task
        </Button>
      </DialogTrigger>
      <DialogContent title="New task" description="Add a task to this project. Assignees get notified." size="lg">
        <TaskForm
          key={formKey}
          action={createTask.bind(null, orgSlug, projectId)}
          members={members}
          milestones={milestones}
          submitLabel="Add task"
          projectShared={projectShared}
          onDone={() => {
            setOpen(false);
            toast.success("Task added");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
