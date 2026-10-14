import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";

/* ---------- Layout ---------- */

export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function Eyebrow({ icon: Icon, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/[0.06] px-3 py-1 text-xs font-medium text-cyan-200",
        className,
      )}
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  id,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl", className)}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">{eyebrow}</p>}
      <h2 id={id} className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-pretty text-base leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}

/** Top-of-page introduction for inner marketing pages (owns the page's h1). */
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative pb-12 pt-14 sm:pb-16 sm:pt-20", className)}>
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[min(720px,90vw)] -translate-x-1/2 rounded-full bg-cyan-500/[0.07] blur-[90px]"
        aria-hidden="true"
      />
      <Container className="relative text-center">
        {eyebrow && <div className="mb-5 flex justify-center">{eyebrow}</div>}
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight text-ink sm:text-5xl">{title}</h1>
        {description && <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}

/* ---------- Product imagery ---------- */

/**
 * A product screenshot in a glowing browser frame. Screenshots are 1440×900;
 * the bottom strip is cropped so the frame reads as a wide window.
 */
export function ScreenshotFrame({
  src,
  alt,
  label,
  priority = false,
  sizes = "(min-width: 1200px) 1136px, 100vw",
  className,
  glow = true,
}: {
  src: string;
  alt: string;
  label?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  glow?: boolean;
}) {
  return (
    <figure className={cn("relative", className)}>
      {glow && (
        <>
          <div className="pointer-events-none absolute -inset-x-6 -top-10 bottom-10 rounded-[40px] bg-cyan-500/[0.14] blur-[70px]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-[15%] -bottom-6 h-24 rounded-full bg-sky-500/[0.12] blur-[60px]" aria-hidden="true" />
        </>
      )}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0b1722] p-1.5 shadow-[0_30px_100px_rgba(0,0,0,.55),0_0_0_1px_rgba(34,211,238,.06),0_0_60px_rgba(34,211,238,.12)] sm:rounded-[22px] sm:p-2">
        <div className="flex items-center gap-1.5 px-2 pb-2 pt-1 sm:px-3 sm:pb-2.5 sm:pt-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/15 sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-white/15 sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-white/15 sm:h-2.5 sm:w-2.5" />
          {label && (
            <span className="mx-auto hidden rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-0.5 font-mono text-[11px] text-ink-faint sm:block">
              {label}
            </span>
          )}
        </div>
        <div className="relative aspect-[1440/820] overflow-hidden rounded-xl border border-white/[0.06] sm:rounded-2xl">
          <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover object-top" />
        </div>
      </div>
    </figure>
  );
}

/* ---------- Lists ---------- */

export function CheckList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3 text-sm leading-relaxed text-ink-secondary">
          <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-cyan-500/10 text-cyan-300">
            <Check size={12} strokeWidth={3} aria-hidden="true" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- FAQ (native disclosure: keyboard and screen-reader friendly) ---------- */

export interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-white/[0.06] rounded-2xl border border-line bg-surface/60", className)}>
      {items.map((item) => (
        <details key={item.question} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[15px] font-medium text-ink transition-colors hover:text-cyan-200 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              size={18}
              className="flex-none text-ink-faint transition-transform duration-200 group-open:rotate-180 group-open:text-cyan-300"
              aria-hidden="true"
            />
          </summary>
          <div className="-mt-1 pb-5 pr-8 text-sm leading-relaxed text-ink-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

/* ---------- Calls to action ---------- */

export function CtaBand({
  title = "Bring your next client review into Atrium.",
  description = "Start on the free Starter plan, or open the demo workspace and click around as an agency owner, a team member or a client.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.12] via-[#0d1d2a] to-sky-600/[0.08] px-6 py-12 text-center shadow-[0_0_80px_rgba(34,211,238,.08)] sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[480px] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-[80px]" aria-hidden="true" />
          <h2 id="cta-title" className="relative mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {title}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-ink-muted">{description}</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClasses({ size: "lg", className: "px-6" })}>
              Start free <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/login" className={buttonClasses({ variant: "outline", size: "lg", className: "px-6" })}>
              Explore the demo
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

/** Small icon + title + text block used in feature grids. */
export function FeatureBlurb({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card p-6", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,.08)]">
        <Icon size={19} aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}
