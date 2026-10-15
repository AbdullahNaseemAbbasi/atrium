import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_ORDER, PLANS } from "@/lib/billing/plans";
import { formatBytes, formatMoney } from "@/lib/utils";
import { Container, CtaBand, ScreenshotFrame, SectionHeading, ctaClasses } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: { absolute: "Atrium: client sign-off for agencies and studios" },
  description:
    "Atrium is a shared space for an agency and its clients. Send a version of the work, and the client approves it or asks for changes on the record.",
  openGraph: {
    title: "Atrium: client sign-off for agencies and studios",
    description: "Send a version of the work. Your client approves it or asks for changes, and the decision stays with that version.",
    images: [{ url: "/screenshots/portal-review.png", width: 1440, height: 900, alt: "A client reviewing version 3 of a homepage mockup in Atrium" }],
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ReviewStory />
      <WhatClientsSee />
      <DayToDay />
      <PricingSummary />
      <Questions />
      <CtaBand />
    </>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="pt-14 sm:pt-20">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
          <div>
            <p className="text-[0.9375rem] text-ink-muted">For design and development studios that work with clients</p>
            <h1 id="hero-title" className="mt-4 text-balance text-[2.5rem] font-semibold leading-[1.08] text-ink sm:text-[3.5rem]">
              Show your client the latest version. Get their decision on the record.
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="text-pretty text-[1.0625rem] leading-relaxed text-ink-secondary">
              You upload a design, a document or a video. Your client sees that exact version in their own portal, comments on it, and
              approves it or asks for changes. Atrium keeps each decision with the version it was made on, so nobody has to search
              their inbox to find out what was agreed.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/login" className={ctaClasses("primary")}>
                Try the demo
              </Link>
              <Link href="/pricing" className="px-1 text-[0.9375rem] text-ink-secondary underline decoration-white/25 underline-offset-4 hover:text-ink hover:decoration-cyan-400">
                See pricing
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-faint">The demo doesn&apos;t need an account. Pick the agency owner or the client on the sign-in page.</p>
          </div>
        </div>

        <ScreenshotFrame
          src="/screenshots/portal-review.png"
          alt="The client portal: Daniel from Acme Co. looking at version 3 of a homepage mockup, with Approve and Request changes buttons"
          priority
          crop="aspect-[4/5] sm:aspect-[1440/860]"
          focus="object-right-top sm:object-left-top"
          className="mt-12 sm:mt-16"
          caption="The client's side. Daniel from Acme Co. is looking at version 3 of the homepage mockup Kinetic Studio sent him."
        />
      </Container>
    </section>
  );
}

/* ---------- A review, step by step ---------- */

const STORY = [
  {
    when: "Mon 10:12",
    who: "Liam, designer at Kinetic",
    what: "uploads homepage-mockup-v3.png. It's a draft, so Acme can't see it yet.",
  },
  {
    when: "Mon 15:40",
    who: "Emma, the project lead",
    what: "sends version 3 to Acme. Daniel gets a notification in his portal.",
  },
  {
    when: "Tue 09:05",
    who: "Chris at Acme",
    what: "asks whether the mobile menu is final. Chris can comment but can't approve.",
  },
  {
    when: "Tue 09:20",
    who: "Emma",
    what: "leaves an internal note for her team about the Thursday call. Acme never sees it.",
  },
  {
    when: "Tue 11:30",
    who: "Daniel",
    what: "approves version 3. His name, the version and the time are saved, and the Visual design milestone closes because that was its last open item.",
  },
];

function ReviewStory() {
  return (
    <section aria-labelledby="story-title" className="mt-24 border-t border-line py-20 sm:mt-28">
      <Container>
        <SectionHeading
          id="story-title"
          title="How one review goes"
          description="An example from the demo workspace, where Kinetic Studio is redesigning the Acme Co. website."
        />
        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <ol className="space-y-7">
            {STORY.map((step) => (
              <li key={step.when} className="grid grid-cols-[5.5rem_1fr] gap-4 sm:grid-cols-[6.5rem_1fr]">
                <span className="pt-0.5 font-mono text-[0.8125rem] text-ink-faint">{step.when}</span>
                <p className="text-[0.9375rem] leading-relaxed text-ink-secondary">
                  <span className="font-medium text-ink">{step.who}</span> {step.what}
                </p>
              </li>
            ))}
          </ol>
          <ScreenshotFrame
            src="/screenshots/review.png"
            alt="The agency's view of the same deliverable: version history, the client's comments and the approval trail"
            crop="aspect-[4/3]"
            sizes="(min-width: 1024px) 560px, 100vw"
            caption="The agency's side of the same file: every version, the discussion, and who decided what."
          />
        </div>
      </Container>
    </section>
  );
}

/* ---------- What the client sees ---------- */

const CLIENT_SEES = [
  "Projects you choose to share with them",
  "Tasks you mark as visible to the client",
  "Versions you send for review, with your note on what changed",
  "Comments written for them, and their own comments",
  "Files you share, through download links that expire after a minute",
];

const TEAM_ONLY = [
  "Drafts you haven't sent yet",
  "Internal notes on a deliverable or a task",
  "Internal tasks, budgets and billing",
  "Other clients, and projects you haven't shared",
];

function WhatClientsSee() {
  return (
    <section aria-labelledby="sees-title" className="border-t border-line py-20">
      <Container>
        <SectionHeading
          id="sees-title"
          title="What your client sees, and what stays with your team"
          description="Clients sign in to a portal for their own company. They see what you share with them and nothing else, even if they guess a link."
        />
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="border-b border-line pb-3 text-base font-semibold text-ink">Your client sees</h3>
            <ul className="mt-4 space-y-3">
              {CLIENT_SEES.map((item) => (
                <li key={item} className="text-[0.9375rem] leading-relaxed text-ink-secondary">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="border-b border-line pb-3 text-base font-semibold text-ink">Only your team sees</h3>
            <ul className="mt-4 space-y-3">
              {TEAM_ONLY.map((item) => (
                <li key={item} className="text-[0.9375rem] leading-relaxed text-ink-secondary">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-ink-faint">
              Each client user is either an approver or a viewer. Viewers can read and comment; only approvers can sign work off.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- The rest of the work ---------- */

const DETAILS = [
  {
    title: "Version history",
    text: "Every upload is kept. An approval belongs to the version it was given on, so a later upload starts a fresh review instead of inheriting a yes.",
  },
  {
    title: "Roles",
    text: "Owners and managers see every project. Team members see the ones they're on. A billing manager handles invoices and never sees project files.",
  },
  {
    title: "Private files",
    text: "Files aren't public. Someone who can see a file gets a download link that works for 60 seconds, and the download goes into the audit log.",
  },
  {
    title: "Audit log",
    text: "Invitations, role changes, approvals, exports and plan changes are recorded with who did it and when. Owners can export it as a CSV.",
  },
  {
    title: "Reports",
    text: "Review turnaround per client, how often work is approved on the first version, and which projects are behind. The formula is written next to each number.",
  },
  {
    title: "Plan limits",
    text: "Atrium checks your plan before it creates a project, invites someone or accepts an upload, and tells you which limit you'd go over.",
  },
];

function DayToDay() {
  return (
    <section aria-labelledby="work-title" className="border-t border-line py-20">
      <Container>
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
          <SectionHeading id="work-title" title="The work behind the review" />
          <p className="text-pretty text-[1.0625rem] leading-relaxed text-ink-muted">
            Projects are split into milestones and tasks. Your team works from a board, a list or a calendar. When a milestone needs the
            client&apos;s sign-off, it stays open until its last deliverable is approved.
          </p>
        </div>
        <ScreenshotFrame
          src="/screenshots/board.png"
          alt="The task board for the Website Redesign project, with columns for to do, in progress, in review, blocked and done"
          className="mt-10"
          crop="aspect-[4/5] sm:aspect-[1440/760]"
        />
        <dl className="mt-14 grid gap-x-16 gap-y-10 sm:grid-cols-2">
          {DETAILS.map((item) => (
            <div key={item.title} className="border-t border-line pt-5">
              <dt className="text-base font-semibold text-ink">{item.title}</dt>
              <dd className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{item.text}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ---------- Pricing ---------- */

function PricingSummary() {
  return (
    <section aria-labelledby="pricing-title" className="border-t border-line py-20">
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading id="pricing-title" title="Pricing" description="Monthly prices in US dollars. Paying yearly saves about 20%." />
          <Link href="/pricing" className="text-[0.9375rem] text-cyan-300 underline-offset-4 hover:underline">
            Compare the plans in detail
          </Link>
        </div>
        <div className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {PLAN_ORDER.map((key) => {
            const plan = PLANS[key];
            const projects = plan.limits.projects === null ? "Unlimited projects" : `${plan.limits.projects} active projects`;
            const clients = plan.limits.clients === null ? "unlimited client portals" : `${plan.limits.clients} client portals`;
            return (
              <div key={key} className="grid gap-2 py-6 md:grid-cols-[12rem_10rem_1fr] md:items-baseline md:gap-8">
                <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
                <p className="text-ink">
                  {plan.price.month === 0 ? (
                    "Free"
                  ) : (
                    <>
                      {formatMoney(plan.price.month)} <span className="text-sm text-ink-faint">a month</span>
                    </>
                  )}
                </p>
                <p className="text-[0.9375rem] leading-relaxed text-ink-muted">
                  {plan.tagline} {projects}, {clients}, {plan.limits.seats} team seats and {formatBytes(plan.limits.storageBytes)} of
                  storage.
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ---------- Questions ---------- */

const QUESTIONS = [
  {
    q: "Do my clients need an account?",
    a: "Yes. You invite them by email and they get a login for their company's portal. They can't see your other clients or anything you keep internal.",
  },
  {
    q: "What happens to older versions?",
    a: "They stay in the history with their comments and decisions, and you can still download them. Nothing is overwritten.",
  },
  {
    q: "Can someone at the client approve for the whole team?",
    a: "Only people you invite as approvers can approve. Viewers can follow along and comment.",
  },
  {
    q: "Is the data in the demo real?",
    a: "No. Kinetic Studio, Acme Co. and everyone in the demo are made up, and the demo data resets when the server restarts.",
  },
];

function Questions() {
  return (
    <section aria-labelledby="questions-title" className="border-t border-line py-20">
      <Container>
        <SectionHeading id="questions-title" title="Questions we get asked" />
        <div className="mt-10 grid gap-x-16 gap-y-10 md:grid-cols-2">
          {QUESTIONS.map((item) => (
            <div key={item.q}>
              <h3 className="text-base font-semibold text-ink">{item.q}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{item.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-[0.9375rem] text-ink-muted">
          Something else?{" "}
          <Link href="/help" className="text-cyan-300 underline-offset-4 hover:underline">
            The help centre
          </Link>{" "}
          covers setup, reviews and billing, or you can{" "}
          <Link href="/contact" className="text-cyan-300 underline-offset-4 hover:underline">
            write to us
          </Link>
          .
        </p>
      </Container>
    </section>
  );
}
