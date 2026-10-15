import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";

/*
 * Building blocks for the public site. They follow the product's colours but
 * keep the page plain: left-aligned headings, flat buttons, real screenshots,
 * no badges, glows or decorative icons.
 */

/* ---------- Layout ---------- */

export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1180px] px-5 sm:px-8", className)} {...props} />;
}

/** Flat call-to-action buttons for the public site (no gradient, no glow). */
export function ctaClasses(kind: "primary" | "secondary" = "primary", className?: string) {
  return buttonClasses({
    variant: kind === "primary" ? "primary" : "outline",
    size: "lg",
    className: cn(
      "px-5",
      kind === "primary" && "bg-none bg-cyan-400 shadow-none hover:bg-cyan-300 hover:brightness-100",
      className,
    ),
  });
}

/** Short line above a heading. Plain text, not a pill. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm font-medium text-cyan-300", className)}>{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
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
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h2 id={id} className="text-balance text-[1.75rem] font-semibold leading-tight text-ink sm:text-[2.125rem]">
        {title}
      </h2>
      {description && <p className="mt-4 text-pretty text-[1.0625rem] leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}

/** Top-of-page introduction for inner public pages (owns the page's h1). */
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
    <section className={cn("border-b border-line pb-12 pt-14 sm:pb-16 sm:pt-20", className)}>
      <Container>
        {eyebrow && <div className="mb-4">{eyebrow}</div>}
        <h1 className="max-w-3xl text-balance text-[2.25rem] font-semibold leading-[1.15] text-ink sm:text-5xl sm:leading-[1.1]">{title}</h1>
        {description && <p className="mt-5 max-w-2xl text-pretty text-[1.0625rem] leading-relaxed text-ink-muted sm:text-lg">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}

/* ---------- Product imagery ---------- */

/**
 * A real product screenshot with a thin border. Screenshots are 1440×900;
 * `crop` sets the visible shape (it can change per breakpoint) and
 * `focus` picks which part of the screen stays in view when cropped, so
 * phones show one readable area instead of the whole screen shrunk down.
 */
export function ScreenshotFrame({
  src,
  alt,
  caption,
  priority = false,
  sizes = "(min-width: 1180px) 1100px, 100vw",
  crop = "aspect-[1440/860]",
  focus = "object-left-top",
  className,
}: {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  priority?: boolean;
  sizes?: string;
  crop?: string;
  focus?: string;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className={cn("relative overflow-hidden rounded-lg border border-white/[0.12] bg-[#0b1722] shadow-[0_24px_60px_rgba(0,0,0,.45)]", crop)}>
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={cn("object-cover", focus)} />
      </div>
      {caption && <figcaption className="mt-3 text-sm text-ink-faint">{caption}</figcaption>}
    </figure>
  );
}

/* ---------- Lists ---------- */

export function CheckList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn("list-disc space-y-2.5 pl-5 marker:text-cyan-400", className)}>
      {items.map((item, index) => (
        <li key={index} className="pl-1 text-[0.9375rem] leading-relaxed text-ink-secondary">
          {item}
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
    <div className={cn("divide-y divide-white/[0.08] border-y border-white/[0.08]", className)}>
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-ink transition-colors hover:text-cyan-200 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown size={18} className="flex-none text-ink-faint transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="-mt-1 max-w-2xl pb-6 text-[0.9375rem] leading-relaxed text-ink-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

/* ---------- Calls to action ---------- */

export function CtaBand({
  title = "Try it on your next client review.",
  description = "Start on the free Starter plan, or sign in to the demo workspace as the agency owner and then as the client to see both sides of the same project.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="border-t border-line py-16 sm:py-20">
      <Container className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h2 id="cta-title" className="text-balance text-[1.75rem] font-semibold leading-tight text-ink sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-pretty text-ink-muted">{description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className={ctaClasses("primary")}>
            Try the demo
          </Link>
          <Link href="/signup" className={ctaClasses("secondary")}>
            Start free
          </Link>
        </div>
      </Container>
    </section>
  );
}

/** Heading + text block used in feature lists. No icon tile on purpose. */
export function FeatureBlurb({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <div className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}
