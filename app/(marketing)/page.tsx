import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CreditCard,
  FileClock,
  FolderKanban,
  KeyRound,
  Layers,
  ScrollText,
  Send,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PLAN_ORDER, PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { PlanCard } from "@/components/marketing/plan-card";
import {
  CheckList,
  Container,
  CtaBand,
  Eyebrow,
  FaqList,
  ScreenshotFrame,
  SectionHeading,
  type FaqItem,
} from "@/components/marketing/primitives";
import { AuditSnippet, NotificationsSnippet, PortalSnippet, UsageSnippet } from "@/components/marketing/product-snippets";

export const metadata: Metadata = {
  title: { absolute: "Atrium: the client portal for agencies" },
  description:
    "Give every client one place to review work, approve it and see what happens next. Projects, versioned deliverables, approvals and billing for agencies and studios.",
  openGraph: {
    title: "Atrium: the client portal for agencies",
    description: "Projects, versioned deliverables and recorded approvals in one portal your clients can find.",
    images: [{ url: "/screenshots/dashboard.png", width: 1440, height: 900, alt: "The Atrium workspace dashboard" }],
  },
};

const STEPS = [
  {
    icon: Building2,
    title: "Set up your workspace",
    text: "Create a workspace, invite your team and add your clients. Roles decide who sees budgets, billing and internal notes.",
  },
  {
    icon: Send,
    title: "Share work when it's ready",
    text: "Upload deliverables to a project. Every upload becomes a new version, and drafts stay internal until you send them for review.",
  },
  {
    icon: FileClock,
    title: "Get a clear decision",
    text: "Clients approve or request changes from their portal. Each decision is pinned to the exact version, with the reviewer and the time.",
  },
];

const FAQ: FaqItem[] = [
  {
    question: "Do my clients need a paid account?",
    answer:
      "No. You invite client contacts to their portal and they sign in for free. Team seats on your plan are for your own people; clients are counted by portal, not by person.",
  },
  {
    question: "Can clients see our internal comments or budgets?",
    answer:
      "No. Clients only see projects you've shared with them, tasks you've marked as client-visible, deliverables you've submitted and comments posted to the client thread. Internal notes, budgets and drafts never reach the portal.",
  },
  {
    question: "What happens when a client requests changes?",
    answer:
      "The deliverable moves to “Changes requested” with the client's comment attached. You upload a new version and send it back for review. Every earlier version and decision stays in the history.",
  },
  {
    question: "Can I try it before signing up?",
    answer: (
      <>
        Yes. The <Link href="/login" className="text-cyan-300 hover:text-cyan-200">sign-in page</Link> has demo accounts for an agency owner, a
        project manager, a team member, a billing manager and two client roles, all in a workspace filled with sample projects.
      </>
    ),
  },
  {
    question: "What happens if we reach a plan limit?",
    answer:
      "Atrium tells you which limit you've reached, for example active projects or team seats, and stops new ones until you upgrade or free up space. Nothing you already have is removed or hidden.",
  },
  {
    question: "Is the data on this site real?",
    answer:
      "No. This is a demo build. Every company, person and email address is fictional, and changes you make in the demo are not kept for long, so feel free to click anything.",
  },
];

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Security />
      <PricingTeaser />
      <section aria-labelledby="faq-title" className="py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading
            id="faq-title"
            align="left"
            eyebrow="Questions"
            title="Before you invite your first client"
            description={
              <>
                Something else on your mind? The <Link href="/help" className="text-cyan-300 hover:text-cyan-200">help centre</Link> covers
                setup, roles and billing, or you can <Link href="/contact" className="text-cyan-300 hover:text-cyan-200">ask us directly</Link>.
              </>
            }
          />
          <FaqList items={FAQ} />
        </Container>
      </section>
      <CtaBand />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative pt-14 sm:pt-20">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[min(900px,100vw)] -translate-x-1/2 rounded-full bg-cyan-500/[0.08] blur-[110px]"
        aria-hidden="true"
      />
      <Container className="relative text-center">
        <div className="flex justify-center">
          <Eyebrow icon={Layers}>The client portal for agencies and studios</Eyebrow>
        </div>
        <h1 id="hero-title" className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          Give every client one place to{" "}
          <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">review and approve</span> your work.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
          Atrium keeps projects, versioned deliverables and sign-offs together. Your team works in a private workspace, and each client gets
          a portal that shows only their projects, so approvals stop getting lost in email threads.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className={buttonClasses({ size: "lg", className: "px-6" })}>
            Start free <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/login" className={buttonClasses({ variant: "outline", size: "lg", className: "px-6" })}>
            Explore the demo
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-faint">Free for up to 3 active projects. No card needed.</p>
      </Container>
      <Container className="relative mt-14 sm:mt-16">
        <ScreenshotFrame
          src="/screenshots/dashboard.png"
          alt="The Atrium dashboard for Kinetic Studio: quick actions, active projects, tasks due soon, pending approvals and a table of recent projects."
          label="Kinetic Studio · Dashboard"
          priority
        />
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From first upload to approved work in three steps"
          description="Atrium follows the way agency work already moves: your team makes it, the client reviews it, and everyone can see where it stands."
        />
        <ol className="relative mt-14 grid gap-4 md:grid-cols-3">
          <span
            className="absolute left-[16%] right-[16%] top-[38px] hidden h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 md:block"
            aria-hidden="true"
          />
          {STEPS.map((step, index) => (
            <li key={step.title} className="card relative p-6 text-center">
              <span className="relative mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-400/30 bg-[#0c1d29] text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,.18)]">
                <step.icon size={21} aria-hidden="true" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/80">Step {index + 1}</p>
              <h3 className="mt-2 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function FeatureRow({
  id,
  icon: Icon,
  eyebrow,
  title,
  text,
  points,
  image,
  reverse = false,
}: {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  image: { src: string; alt: string; label: string };
  reverse?: boolean;
}) {
  return (
    <div className={cn("grid items-center gap-10 lg:gap-14", reverse ? "lg:grid-cols-[1.15fr_0.85fr]" : "lg:grid-cols-[0.85fr_1.15fr]")}>
      <div className={reverse ? "lg:order-2" : undefined}>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
          <Icon size={15} aria-hidden="true" /> {eyebrow}
        </p>
        <h3 id={id} className="mt-3 text-balance text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 leading-relaxed text-ink-muted">{text}</p>
        <CheckList items={points} className="mt-6" />
      </div>
      <ScreenshotFrame
        src={image.src}
        alt={image.alt}
        label={image.label}
        sizes="(min-width: 1200px) 640px, (min-width: 1024px) 55vw, 100vw"
        className={reverse ? "lg:order-1" : undefined}
      />
    </div>
  );
}

function SmallFeature({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <article className="card flex min-w-0 flex-col p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
          <Icon size={19} aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{text}</p>
      <div className="mt-6 flex-1 rounded-2xl bg-gradient-to-b from-cyan-500/[0.06] to-transparent p-3 sm:p-5">{children}</div>
    </article>
  );
}

function Features() {
  return (
    <section aria-labelledby="features-title" className="border-y border-line bg-[#06101a]/40 py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="features-title"
          eyebrow="What's inside"
          title="Everything a client review needs, and nothing it doesn't"
          description="One workspace for your team, one portal per client, and a record of every decision in between."
        />
        <div className="mt-16 space-y-24">
          <FeatureRow
            id="feature-projects"
            icon={FolderKanban}
            eyebrow="Projects & milestones"
            title="Plan the work in milestones your client can follow"
            text="Break each project into milestones and tasks, with owners, priorities and due dates. Overdue work is flagged on the dashboard before anyone has to ask."
            points={[
              "Board and list views for tasks, filterable by assignee and priority",
              "Milestones that only complete once every deliverable in them is approved",
              "Mark any task as internal to keep it off the client portal",
            ]}
            image={{
              src: "/screenshots/board.png",
              alt: "The task board for the Website Redesign project with To do, In progress, In review, Blocked and Done columns.",
              label: "Website Redesign · Tasks",
            }}
          />
          <FeatureRow
            id="feature-deliverables"
            reverse
            icon={Layers}
            eyebrow="Deliverables & approvals"
            title="Every version kept, every decision on record"
            text="Upload a file and it becomes version one. Upload again and it becomes version two. When the client approves, Atrium records who approved which version and when."
            points={[
              "Full version history with notes on what changed",
              "Approve or request changes, with a comment the team sees straight away",
              "Drafts stay internal until you submit them for review",
            ]}
            image={{
              src: "/screenshots/review.png",
              alt: "A deliverable page for Homepage mockup version 3, waiting for client review, with client reviewers and version history.",
              label: "Homepage mockup · v3",
            }}
          />
        </div>
        <div className="mt-24 grid gap-4 md:grid-cols-2">
          <SmallFeature
            icon={Users}
            title="A portal for each client"
            text="Clients see shared projects, submitted deliverables and the client thread. Approvers can sign off; viewers can follow along and comment."
          >
            <PortalSnippet />
          </SmallFeature>
          <SmallFeature
            icon={Bell}
            title="Notifications and activity"
            text="The right people hear when work is submitted, approved or commented on. Repeats within ten minutes are folded into one notification."
          >
            <NotificationsSnippet />
          </SmallFeature>
          <SmallFeature
            icon={CreditCard}
            title="Billing and plan limits"
            text="Plans set limits on projects, client portals, seats and storage, and the server enforces them. Billing managers see invoices without seeing project data."
          >
            <UsageSnippet />
          </SmallFeature>
          <SmallFeature
            icon={ScrollText}
            title="Audit log"
            text="Invitations, role changes, sharing, approvals, downloads and exports are recorded with who did it, when and from which IP address."
          >
            <AuditSnippet />
          </SmallFeature>
        </div>
      </Container>
    </section>
  );
}

const SECURITY = [
  {
    icon: Building2,
    title: "Tenant isolation",
    text: "Every record belongs to one workspace, and every page and action checks your membership before reading or writing. Anything outside your workspace returns “not found”, so IDs can't be probed.",
  },
  {
    icon: KeyRound,
    title: "Private files, expiring links",
    text: "Files are never public. A download link is issued only after your access is checked, names exactly one file and expires after 60 seconds. Access is checked again when the link is used.",
  },
  {
    icon: ScrollText,
    title: "A trail you can read",
    text: "Security-relevant changes are written to an audit log with actor, time and IP address, so you can answer “who shared this?” without guessing.",
  },
];

function Security() {
  return (
    <section aria-labelledby="security-title" className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            id="security-title"
            align="left"
            eyebrow="Security"
            title="Client work stays with the people it belongs to"
            description="Agencies hold other companies' unreleased work. Atrium is built so one client can never stumble into another's files."
          />
          <Link href="/security" className={buttonClasses({ variant: "secondary", className: "w-fit" })}>
            How we handle security <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {SECURITY.map((item) => (
            <article key={item.title} className="card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-500/[0.07] text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,.12)]">
                <item.icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
          <ShieldCheck size={14} className="text-cyan-300" aria-hidden="true" />
          The access rules are plain functions covered by automated tests, and run before every query and server action.
        </p>
      </Container>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section aria-labelledby="pricing-title" className="border-y border-line bg-[#06101a]/40 py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          title="Start free, upgrade when the client list grows"
          description="Every plan includes client portals, versioned deliverables and approval history. Paid plans add room and controls."
        />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {PLAN_ORDER.map((key) => (
            <PlanCard key={key} plan={PLANS[key]} />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-ink-muted">
          Prices in US dollars.{" "}
          <Link href="/pricing" className="font-medium text-cyan-300 hover:text-cyan-200">
            Compare every plan feature →
          </Link>
        </p>
      </Container>
    </section>
  );
}
