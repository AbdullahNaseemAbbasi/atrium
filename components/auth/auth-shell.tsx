import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Backdrop } from "@/components/shell/chrome";

/** Split layout for sign-in, sign-up and password screens. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <div className="relative mx-auto grid min-h-screen max-w-[1400px] lg:grid-cols-[1fr_1.05fr]">
        <aside className="hidden flex-col justify-between p-10 lg:flex">
          <Link href="/" aria-label="Atrium home" className="w-fit">
            <Logo />
          </Link>
          <div className="max-w-md">
            <p className="text-3xl font-semibold leading-tight text-ink">
              One place for your clients to review work, approve it and see what happens next.
            </p>
            <ul className="mt-8 space-y-4 text-sm text-ink-secondary">
              {[
                "Private, versioned deliverables with signed download links",
                "Approval decisions recorded with reviewer, version and time",
                "Every workspace isolated from every other",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-faint">© 2026 Atrium · Demo build with synthetic data</p>
        </aside>
        <main id="main" className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[440px]">
            <Link href="/" aria-label="Atrium home" className="mb-8 inline-block lg:hidden">
              <Logo />
            </Link>
            <div className="card p-6 sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
              {description && <p className="mt-2 text-sm text-ink-muted">{description}</p>}
              <div className="mt-7">{children}</div>
            </div>
            {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
