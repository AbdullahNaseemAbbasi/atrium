import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CreditCard, EyeOff, FlaskConical, KeyRound, LockKeyhole, Mail, ScrollText, UserCog, type LucideIcon } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { CheckList, Container, CtaBand, Eyebrow, PageIntro } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Atrium keeps each agency's workspace and each client's files apart: tenant isolation, role-based access, private files with expiring links and an audit log.",
};

interface Topic {
  id: string;
  icon: LucideIcon;
  title: string;
  intro: string;
  points: string[];
}

const TOPICS: Topic[] = [
  {
    id: "isolation",
    icon: Building2,
    title: "Tenant isolation",
    intro:
      "Every record in Atrium belongs to exactly one workspace. The workspace you're working in always comes from a verified membership, never from the URL alone.",
    points: [
      "Every page, query and server action checks your membership and role before it reads or writes anything.",
      "IDs sent from the browser are never trusted: the record is loaded and its workspace is compared with yours first.",
      "A project, file or client from another workspace returns “not found” rather than “forbidden”, so IDs can't be used to discover what exists.",
      "The access rules are pure functions with their own automated tests, so a change that weakens them shows up as a failing test.",
    ],
  },
  {
    id: "roles",
    icon: UserCog,
    title: "Roles and least privilege",
    intro: "Each person gets one role per workspace, and each role has a fixed list of permissions that the server checks on every action.",
    points: [
      "Owners control the workspace, billing and roles. Managers run projects and clients and can read the audit log.",
      "Team members only see the projects they're assigned to.",
      "Billing managers handle plans and invoices and see no project data at all.",
      "Managers can invite team members but can't create owners or change existing roles.",
    ],
  },
  {
    id: "clients",
    icon: EyeOff,
    title: "What clients can and can't see",
    intro: "Client users live in a separate portal with its own, much smaller set of permissions.",
    points: [
      "A client only sees projects that are shared with them and belong to their own company.",
      "Inside those projects they see client-visible tasks, submitted deliverables and the client comment thread.",
      "Drafts, internal comments, internal files, budgets and other clients' work never reach the portal.",
      "Only client approvers can approve work, and only on a version that's currently in review.",
    ],
  },
  {
    id: "files",
    icon: KeyRound,
    title: "Private files and expiring links",
    intro: "Files are stored privately. There are no public URLs for deliverables or project files.",
    points: [
      "A download link is issued only after your access to that file is checked.",
      "Each link is signed, names exactly one file and one person, and expires after 60 seconds.",
      "Access is checked again when the link is opened, in case your role changed in the meantime.",
      "Every download is recorded in the audit log with the person, the file and the time.",
    ],
  },
  {
    id: "sessions",
    icon: LockKeyhole,
    title: "Sign-in and sessions",
    intro: "Your session is kept in a cookie that scripts can't read and the browser can't forge.",
    points: [
      "Session cookies are httpOnly, SameSite=Lax, sent only over HTTPS in production and signed with HMAC.",
      "Sessions end after seven days, or straight away when you sign out.",
      "Password reset gives the same answer whether or not an account exists, so email addresses can't be checked against Atrium.",
      "After sign-in you're only redirected to pages on Atrium itself, never to an outside address.",
    ],
  },
  {
    id: "audit",
    icon: ScrollText,
    title: "Audit log",
    intro: "Security-relevant changes are recorded with who did them, when, and from which IP address.",
    points: [
      "Invitations, revoked invitations, role changes and removed members.",
      "Client access granted or revoked, and projects shared or unshared with clients.",
      "Approvals and change requests, file downloads and data exports.",
      "Plan changes and failed payments.",
    ],
  },
  {
    id: "billing",
    icon: CreditCard,
    title: "Billing and plan limits",
    intro: "The browser never decides what you pay or what your plan allows.",
    points: [
      "Plan prices live on the server. Checkout maps a plan to a price there, so a modified request can't change the amount.",
      "Limits on projects, client portals, seats and storage are enforced inside each action, not just hidden in the interface.",
      "Card details are handled by the payment provider. Atrium keeps only the brand, last four digits and expiry date.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageIntro
        eyebrow={<Eyebrow>Security</Eyebrow>}
        title="Built so one client never sees another client's work"
        description="Agencies hold other companies' unreleased work. This page explains, in plain terms, how Atrium keeps it where it belongs, and where the demo build still differs from production."
      />

      <Container className="grid gap-10 pb-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">On this page</p>
            <ul className="mt-4 space-y-1 border-l border-line">
              {[...TOPICS, { id: "demo", title: "About this demo" }, { id: "report", title: "Reporting an issue" }].map((topic) => (
                <li key={topic.id}>
                  <a href={`#${topic.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-ink-muted transition hover:border-cyan-400 hover:text-cyan-200">
                    {topic.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {TOPICS.map((topic) => (
            <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-title`} className="card scroll-mt-28 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-cyan-400/20 bg-cyan-500/[0.07] text-cyan-300">
                  <topic.icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 id={`${topic.id}-title`} className="text-xl font-semibold text-ink">
                    {topic.title}
                  </h2>
                  <p className="mt-2 leading-relaxed text-ink-muted">{topic.intro}</p>
                </div>
              </div>
              <CheckList items={topic.points} className="mt-6 sm:pl-[60px]" />
            </section>
          ))}

          <section id="demo" aria-labelledby="demo-title" className="scroll-mt-28 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6 sm:p-8">
            <h2 id="demo-title" className="flex items-center gap-2.5 text-xl font-semibold text-ink">
              <FlaskConical size={20} className="text-amber-300" aria-hidden="true" /> About this demo build
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              This site runs on synthetic data kept in memory, and every demo account shares one published password. The access rules,
              roles, signed download links and audit entries above all run for real. The hosted version is planned on Postgres, with the
              same tenant rules also written as row-level security policies, and with files in a private storage bucket.
            </p>
          </section>

          <section id="report" aria-labelledby="report-title" className="card scroll-mt-28 p-6 sm:p-8">
            <h2 id="report-title" className="flex items-center gap-2.5 text-xl font-semibold text-ink">
              <Mail size={20} className="text-cyan-300" aria-hidden="true" /> Reporting a security issue
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              If you think you&apos;ve found a vulnerability, tell us before sharing it publicly. Include the steps to reproduce it and what you
              expected to happen. We reply within one business day and keep you updated until it&apos;s fixed.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact?topic=security" className={buttonClasses()}>
                Send a security report
              </Link>
              <a href="mailto:security@atrium.example" className={buttonClasses({ variant: "outline" })}>
                security@atrium.example
              </a>
            </div>
          </section>
        </div>
      </Container>
      <CtaBand title="See the access rules for yourself." description="Open the demo as an owner, then as a client, and compare what each one can see." />
    </>
  );
}
