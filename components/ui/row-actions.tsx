"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "./dropdown";

export interface RowAction {
  label: string;
  href?: string;
  /** Copies an absolute URL built from this path. */
  copyPath?: string;
}

/** The "…" menu at the end of a table row. */
export function RowActions({ actions, label }: { actions: RowAction[]; label: string }) {
  const router = useRouter();
  return (
    <Dropdown>
      <DropdownTrigger
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-white/5 hover:text-ink"
        aria-label={label}
      >
        <MoreHorizontal size={18} />
      </DropdownTrigger>
      <DropdownContent className="min-w-[190px]">
        {actions.map((action) => (
          <DropdownItem
            key={action.label}
            onSelect={() => {
              if (action.copyPath) {
                void navigator.clipboard.writeText(`${window.location.origin}${action.copyPath}`);
                toast.success("Link copied");
              } else if (action.href) {
                router.push(action.href);
              }
            }}
          >
            {action.label}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
