import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-cyan-500 to-sky-500 font-semibold text-on-brand shadow-[0_0_24px_rgba(34,211,238,.25)] hover:brightness-110",
  secondary: "border border-cyan-500/30 bg-cyan-500/[0.04] font-medium text-cyan-300 hover:bg-cyan-500/10",
  outline:
    "border border-line-strong bg-white/[0.03] font-medium text-ink-secondary hover:border-white/20 hover:bg-white/[0.06] hover:text-ink",
  ghost: "font-medium text-ink-muted hover:bg-white/5 hover:text-ink",
  danger: "border border-red-500/30 bg-red-500/10 font-medium text-red-300 hover:bg-red-500/20",
  link: "font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline",
} as const;

const SIZES = {
  xs: "h-7 gap-1.5 rounded-lg px-2.5 text-xs",
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-sm",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background-color,border-color,color,filter,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    variant === "link" ? "h-auto p-0" : SIZES[size],
    VARIANTS[variant],
    className,
  );
}

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the child element (for example a Link) with button styles. */
  asChild?: boolean;
}

export function Button({ variant, size, asChild, className, type, ...props }: ButtonProps) {
  if (asChild) {
    return <Slot.Root className={buttonClasses({ variant, size, className })} {...props} />;
  }
  return <button type={type ?? "button"} className={buttonClasses({ variant, size, className })} {...props} />;
}
