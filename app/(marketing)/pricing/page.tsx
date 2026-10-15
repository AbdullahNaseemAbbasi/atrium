import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { PLAN_ORDER, PLANS, type Plan } from "@/lib/billing/plans";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { Container, CtaBand, FaqList, PageIntro, SectionHeading, type FaqItem } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Atrium is free for up to 3 active projects. Professional and Agency plans add room for more clients, seats and storage.",
};

type Cell = boolean | string;

function limit(value: number | null, unit = "") {
  return value === null ? "Unlimited" : `${value}${unit}`;
}

const LIMIT_ROWS: { label: string; value: (plan: Plan) => Cell }[] = [
  { label: "Active projects", value: (plan) => limit(plan.limits.projects) },
  { label: "Client portals", value: (plan) => limit(plan.limits.clients) },
  { label: "Team seats", value: (plan) => limit(plan.limits.seats) },
  { label: "Private file storage", value: (plan) => formatBytes(plan.limits.storageBytes) },
];

const has = (plan: Plan, text: string) => plan.highlights.some((item) => item.toLowerCase().includes(text));

const FEATURE_GROUPS: { title: string; rows: { label: string; value: (plan: Plan) => Cell }[] }[] = [
  {
    title: "Client collaboration",
    rows: [
      { label: "Client portal with approver and viewer roles", value: () => true },
      { label: "Versioned deliverables", value: () => true },
      { label: "Approval history pinned to each version", value: () => true },
      { label: "Client and internal comment threads", value: () => true },
      { label: "In-app notifications", value: () => true },
    ],
  },
  {
    title: "Project management",
    rows: [
      { label: "Task board and list views", value: () => true },
      { label: "Milestones", value: () => true },
      { label: "Milestone approval rules", value: (plan) => has(plan, "milestone approval") || plan.key === "agency" },
    ],
  },
  {
    title: "Control and support",
    rows: [
      { label: "Team roles: owner, manager, member, billing", value: () => true },
      { label: "Audit log and CSV export", value: (plan) => has(plan, "audit log") || plan.key === "agency" },
      { label: "Priority support", value: (plan) => has(plan, "priority support") },
      { label: "Custom roles", value: (plan) => (has(plan, "custom roles") ? "Coming soon" : false) },
    ],
  },
];

const FAQ: FaqItem[] = [
  {
    question: "How does the Professional trial work?",
    answer:
      "Choose the trial when you create your workspace and you get Professional limits for 14 days without adding a card. Owners and billing managers can pick a paid plan from the Billing page at any time during the trial.",
  },
  {
    question: "Do client users count as team seats?",
    answer:
      "No. Seats are for people on your team. Client contacts are invited into a client portal, and plans limit the number of portals, not the number of people inside each one.",
  },
  {
    question: "What counts as an active project?",
    answer:
      "Any project in planning, in progress or in review. Completed, cancelled and on-hold projects don't count, so you can keep your history without paying for it.",
  },
  {
    question: "What happens if we reach a limit?",
    answer:
      "Atrium tells you which limit you've hit and stops new projects, portals or invitations beyond it. Nothing you already have is removed, and upgrading lifts the limit straight away.",
  },
  {
    question: "How do payments work?",
    answer:
      "Card payments are processed by Stripe. Atrium keeps only the card brand, the last four digits and the expiry date so you can see which card is on file.",
  },
  {
    question: "Do prices include tax?",
    answer: "Prices are in US dollars and don't include sales tax or VAT, which is added at checkout where it applies.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageIntro
        title="Simple plans that grow with your client list"
        description="Every plan includes client portals, versioned deliverables and a full approval history. Pay for more projects, portals, seats and storage when you need them."
      />
      <section aria-label="Plans" className="pb-8">
        <Container>
          <PricingPlans />
          <p className="mt-8 text-center text-sm text-ink-muted">
            Running a larger team or need a contract?{" "}
            <Link href="/contact?topic=sales" className="font-medium text-cyan-300 hover:text-cyan-200">
              Talk to us
            </Link>
          </p>
        </Container>
      </section>

      <section aria-labelledby="compare-title" className="py-20 sm:py-24">
        <Container>
          <SectionHeading id="compare-title" eyebrow="Compare" title="What each plan includes" />
          <p className="mt-8 text-center text-xs text-ink-faint sm:hidden">Swipe the table sideways to compare all three plans.</p>
          <div className="card relative mt-4 overflow-x-auto sm:mt-12">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <caption className="sr-only">Plan comparison</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="w-[40%] px-5 py-5 text-left text-sm font-medium text-ink-faint">
                    Feature
                  </th>
                  {PLAN_ORDER.map((key) => (
                    <th key={key} scope="col" className="px-5 py-5 text-center">
                      <span className={PLANS[key].recommended ? "font-semibold text-cyan-200" : "font-semibold text-ink"}>{PLANS[key].name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <GroupRow title="Usage limits" />
                {LIMIT_ROWS.map((row) => (
                  <FeatureRow key={row.label} label={row.label} value={row.value} />
                ))}
                {FEATURE_GROUPS.map((group) => (
                  <Group key={group.title} group={group} />
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section aria-labelledby="pricing-faq-title" className="pb-8 pt-4">
        <Container className="max-w-[880px]">
          <SectionHeading id="pricing-faq-title" eyebrow="Billing questions" title="Pricing FAQ" />
          <FaqList items={FAQ} className="mt-10" />
        </Container>
      </section>
      <CtaBand title="Try Atrium on your next project." />
    </>
  );
}

function Group({ group }: { group: (typeof FEATURE_GROUPS)[number] }) {
  return (
    <>
      <GroupRow title={group.title} />
      {group.rows.map((row) => (
        <FeatureRow key={row.label} label={row.label} value={row.value} />
      ))}
    </>
  );
}

function GroupRow({ title }: { title: string }) {
  return (
    <tr className="bg-white/[0.02]">
      <th scope="colgroup" colSpan={4} className="px-5 py-3 text-left text-sm font-semibold text-cyan-300">
        {title}
      </th>
    </tr>
  );
}

function FeatureRow({ label, value }: { label: string; value: (plan: Plan) => Cell }) {
  return (
    <tr className="border-b border-white/[0.05] last:border-0">
      <th scope="row" className="px-5 py-3.5 text-left font-normal text-ink-secondary">
        {label}
      </th>
      {PLAN_ORDER.map((key) => {
        const cell = value(PLANS[key]);
        return (
          <td key={key} className="px-5 py-3.5 text-center">
            {cell === true ? (
              <>
                <Check size={17} className="mx-auto text-cyan-300" aria-hidden="true" />
                <span className="sr-only">Included</span>
              </>
            ) : cell === false ? (
              <>
                <Minus size={17} className="mx-auto text-ink-faint/60" aria-hidden="true" />
                <span className="sr-only">Not included</span>
              </>
            ) : (
              <span className="tabular-nums text-ink">{cell}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
