"use client";

import * as React from "react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

export const Dropdown = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;
export const DropdownGroup = DropdownMenu.Group;

export function DropdownContent({
  className,
  align = "end",
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[70] min-w-[220px] overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0c1823]/98 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-pop-in",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownItem({
  className,
  danger = false,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        danger
          ? "text-red-400 data-[highlighted]:bg-red-500/10"
          : "text-ink-secondary data-[highlighted]:bg-white/[0.05] data-[highlighted]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint", className)} {...props} />;
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1.5 h-px bg-line" />;
}
