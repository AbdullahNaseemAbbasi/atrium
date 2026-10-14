"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Switch as RadixSwitch } from "radix-ui";
import { LoaderCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

/** Submit button that shows a spinner while its parent form's action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/**
 * Search box that writes `?q=` into the URL (debounced) so results are
 * shareable and rendered on the server. Must sit inside <Suspense>.
 */
export function SearchInput({
  placeholder = "Search…",
  param = "q",
  className,
}: {
  placeholder?: string;
  param?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(searchParams.get(param) ?? "");
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    const current = searchParams.get(param) ?? "";
    if (value === current) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) next.set(param, value.trim());
      else next.delete(param);
      next.delete("page");
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, param, pathname, router, searchParams]);

  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 transition focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/15",
        className,
      )}
    >
      <Search size={16} className="flex-none text-ink-faint" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-sm text-ink-secondary outline-none placeholder:text-ink-faint focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => setValue("")} aria-label="Clear search" className="text-ink-faint hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Native select that updates one search param when changed. Must sit inside <Suspense>. */
export function ParamSelect({
  param,
  options,
  label,
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";
  return (
    <label className={cn("relative", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={current}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          if (event.target.value) next.set(param, event.target.value);
          else next.delete(param);
          next.delete("page");
          router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
        }}
        className="h-10 w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.025] py-0 pl-3.5 pr-9 text-sm text-ink-secondary outline-none transition hover:border-white/15 focus:border-cyan-400/50 [&>option]:bg-surface-raised"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        "relative inline-flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border border-line-strong bg-white/[0.06] transition-colors data-[state=checked]:border-cyan-400/60 data-[state=checked]:bg-cyan-500/70 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="block h-4.5 w-4.5 translate-x-[3px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </RadixSwitch.Root>
  );
}

/** Button that asks for confirmation before running a form action. */
export function ConfirmSubmit({
  message,
  children,
  ...props
}: ButtonProps & { message: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      {...props}
    >
      {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}
