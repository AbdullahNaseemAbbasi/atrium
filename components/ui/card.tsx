import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/domain/labels";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("card min-w-0", className)} {...props} />;
}

const ICON_TONES: Record<Tone, string> = {
  cyan: "bg-cyan-500/10 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,.08)]",
  blue: "bg-blue-500/10 text-blue-300",
  emerald: "bg-emerald-500/10 text-emerald-300",
  amber: "bg-amber-500/10 text-amber-300",
  red: "bg-red-500/15 text-red-300",
  slate: "bg-white/[0.06] text-ink-muted",
  violet: "bg-violet-500/10 text-violet-300",
};

export function IconBox({
  icon: Icon,
  tone = "cyan",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-xl" : "h-10 w-10 rounded-xl";
  const iconSize = size === "sm" ? 15 : size === "lg" ? 22 : 19;
  return (
    <div className={cn("grid flex-none place-items-center", dims, ICON_TONES[tone], className)} aria-hidden="true">
      <Icon size={iconSize} />
    </div>
  );
}

export function CardHeader({
  icon,
  tone,
  title,
  description,
  action,
  className,
  titleAs: Title = "h2",
}: {
  icon?: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconBox icon={icon} tone={tone} />}
        <div className="min-w-0">
          <Title className="font-semibold text-ink">{title}</Title>
          {description && <p className="mt-1 text-xs text-ink-faint">{description}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-line", className)} role="separator" />;
}
