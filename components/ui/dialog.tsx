"use client";

import * as React from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  title,
  description,
  children,
  size = "md",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[#020a10]/70 backdrop-blur-sm animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[90] max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-cyan-500/20 bg-[#0c1823] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] focus:outline-none animate-pop-in",
          width,
          className,
        )}
      >
        <div className="mb-5 pr-8">
          <RadixDialog.Title className="text-lg font-semibold text-ink">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1.5 text-sm text-ink-muted">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</RadixDialog.Description>
          )}
        </div>
        {children}
        <RadixDialog.Close
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-white/5 hover:text-ink"
          aria-label="Close"
        >
          <X size={17} />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("mt-6 flex flex-col-reverse gap-2.5 border-t border-line pt-5 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}
