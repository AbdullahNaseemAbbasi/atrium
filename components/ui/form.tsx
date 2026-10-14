import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-xl border border-line-strong bg-white/[0.025] px-3.5 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-white/20 focus:border-cyan-400/60 focus:bg-white/[0.04] focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500/50 aria-[invalid=true]:ring-red-500/10";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-ink-secondary", className)} {...props} />;
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-[96px] resize-y py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        CONTROL,
        "h-11 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10 [&>option]:bg-surface-raised",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | string[];
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-red-400" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {message ? (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1.5 text-xs text-red-300" role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          {message}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Native checkbox with a drawn tick. `className` styles the wrapper (spacing),
 * every other prop goes to the <input>.
 */
export function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <span className={cn("relative inline-grid h-4 w-4 flex-none place-items-center", className)}>
      <input
        type="checkbox"
        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-line-strong bg-white/[0.03] transition checked:border-cyan-400 checked:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute h-3 w-3 text-on-brand opacity-0 peer-checked:opacity-100"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

export function FormMessage({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        tone === "error"
          ? "border-red-500/25 bg-red-500/[0.08] text-red-200"
          : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-200",
        className,
      )}
    >
      <Icon size={16} className="mt-0.5 flex-none" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
