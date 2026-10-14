"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import { Briefcase, CornerDownLeft, FileCheck2, FolderKanban, LayoutDashboard, Search, SquareCheckBig } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/misc";
import type { SearchEntry } from "@/lib/data/queries/shell";

const KIND_META: Record<SearchEntry["kind"], { label: string; icon: typeof Search }> = {
  page: { label: "Pages", icon: LayoutDashboard },
  project: { label: "Projects", icon: FolderKanban },
  client: { label: "Clients", icon: Briefcase },
  deliverable: { label: "Deliverables", icon: FileCheck2 },
  task: { label: "Open tasks", icon: SquareCheckBig },
};

const ORDER: SearchEntry["kind"][] = ["project", "client", "deliverable", "task", "page"];

/** Ctrl/⌘ + K quick search over everything the viewer is allowed to see. */
export function CommandPalette({
  entries,
  open,
  onOpenChange,
}: {
  entries: SearchEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? entries.filter((entry) => entry.label.toLowerCase().includes(q) || entry.sub?.toLowerCase().includes(q))
      : entries.filter((entry) => entry.kind === "project" || entry.kind === "page");
    return ORDER.flatMap((kind) => matched.filter((entry) => entry.kind === kind).slice(0, q ? 6 : 8));
  }, [entries, query]);

  function go(entry: SearchEntry | undefined) {
    if (!entry) return;
    onOpenChange(false);
    setQuery("");
    router.push(entry.href);
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[#020a10]/70 backdrop-blur-sm" />
        <RadixDialog.Content
          className="fixed left-1/2 top-[12vh] z-[90] w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0c1823] shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-pop-in"
          aria-describedby={undefined}
        >
          <RadixDialog.Title className="sr-only">Search the workspace</RadixDialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search size={18} className="text-ink-faint" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((value) => Math.min(value + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((value) => Math.max(value - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(results[cursor]);
                }
              }}
              placeholder="Search projects, clients, deliverables, tasks…"
              className="h-14 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
              aria-activedescendant={results[cursor] ? `cmd-${cursor}` : undefined}
            />
            <Kbd>Esc</Kbd>
          </div>
          <ul id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-ink-muted">No matches for “{query}”.</li>}
            {results.map((entry, index) => {
              const meta = KIND_META[entry.kind];
              const Icon = meta.icon;
              const showHeading = index === 0 || results[index - 1].kind !== entry.kind;
              return (
                <React.Fragment key={`${entry.kind}-${entry.href}-${entry.label}`}>
                  {showHeading && (
                    <li role="presentation" className="px-3 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                      {meta.label}
                    </li>
                  )}
                  <li
                    id={`cmd-${index}`}
                    role="option"
                    aria-selected={index === cursor}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                      index === cursor ? "bg-cyan-500/10 text-ink" : "text-ink-secondary",
                    )}
                  >
                    <Icon size={16} className={index === cursor ? "text-cyan-300" : "text-ink-faint"} aria-hidden="true" />
                    <span className="truncate">{entry.label}</span>
                    {entry.sub && <span className="truncate text-xs text-ink-faint">{entry.sub}</span>}
                    {index === cursor && <CornerDownLeft size={14} className="ml-auto text-ink-faint" aria-hidden="true" />}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
