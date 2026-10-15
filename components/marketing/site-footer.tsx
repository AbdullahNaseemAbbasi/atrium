import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "./primitives";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/security", label: "Security" },
      { href: "/login", label: "Live demo" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/contact", label: "Contact us" },
      { href: "/status", label: "System status" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/contact?topic=security", label: "Report a security issue" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-auto border-t border-line bg-[#06101a]">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" aria-label="Atrium home" className="inline-block">
              <Logo size={28} />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              A shared space where agencies send work to their clients and get it signed off.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="text-sm font-medium text-ink-secondary">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-ink-muted transition-colors hover:text-cyan-300">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Atrium. All rights reserved.</p>
          <p>This is a demo. The companies, people and email addresses on this site are made up.</p>
        </div>
      </Container>
    </footer>
  );
}
