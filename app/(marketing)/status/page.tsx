import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "System status",
  description: "Demo status page for Atrium showing component health and 90-day history. Sample data, not live monitoring.",
};

/*
 * Everything on this page is sample data that illustrates the status page.
 * Days are relative ("12 days ago") so the page can be prerendered without
 * reading the clock.
 */

const DAYS = 90;

type Level = "operational" | "degraded" | "outage";

interface Incident {
  id: string;
  component: string;
  daysAgo: number;
  level: Exclude<Level, "operational">;
  title: string;
  /** Minutes the component was unavailable (outages only count toward uptime). */
  minutes: number;
  summary: string;
  updates: { label: string; text: string }[];
}

const COMPONENTS = [
  { key: "app", name: "Workspace app", description: "Dashboards, projects, tasks and settings" },
  { key: "portal", name: "Client portal", description: "Client sign-in, reviews and approvals" },
  { key: "auth", name: "Sign-in and sessions", description: "Sign-in, invitations and password reset" },
  { key: "files", name: "File storage and downloads", description: "Uploads and signed download links" },
  { key: "notifications", name: "Notifications", description: "In-app notifications and activity feed" },
  { key: "billing", name: "Billing and payments", description: "Checkout, invoices and payment webhooks" },
];

const INCIDENTS: Incident[] = [
  {
    id: "inc-3",
    component: "files",
    daysAgo: 12,
    level: "degraded",
    title: "Slow file downloads",
    minutes: 0,
    summary: "Some downloads took up to 20 seconds to start. Uploads and approvals were not affected.",
    updates: [
      { label: "Resolved", text: "Download times are back to normal. We moved link signing closer to the storage region." },
      { label: "Identified", text: "A storage region was responding slowly to signed-link requests." },
    ],
  },
  {
    id: "inc-2",
    component: "notifications",
    daysAgo: 41,
    level: "degraded",
    title: "Delayed notifications",
    minutes: 0,
    summary: "In-app notifications arrived up to 15 minutes late for about an hour. No notifications were lost.",
    updates: [
      { label: "Resolved", text: "The backlog has cleared and new notifications arrive straight away." },
      { label: "Monitoring", text: "A stuck background job was restarted; the queue is draining." },
    ],
  },
  {
    id: "inc-1",
    component: "billing",
    daysAgo: 67,
    level: "outage",
    title: "Payment webhooks failing",
    minutes: 24,
    summary: "Payment confirmations were not processed for 24 minutes. Events were retried afterwards and no payment was recorded twice.",
    updates: [
      { label: "Resolved", text: "All delayed events have been processed. Duplicate deliveries were skipped." },
      { label: "Investigating", text: "Webhook requests are failing signature checks after a key rotation." },
    ],
  },
];

const LEVEL_META: Record<Level, { label: string; bar: string; tone: "emerald" | "amber" | "red" }> = {
  operational: { label: "Operational", bar: "bg-emerald-400/80 hover:bg-emerald-300", tone: "emerald" },
  degraded: { label: "Degraded performance", bar: "bg-amber-400 hover:bg-amber-300", tone: "amber" },
  outage: { label: "Partial outage", bar: "bg-red-400 hover:bg-red-300", tone: "red" },
};

function daysAgoLabel(daysAgo: number) {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return `${daysAgo} days ago`;
}

function historyFor(key: string) {
  return Array.from({ length: DAYS }, (_, index) => {
    const daysAgo = DAYS - 1 - index;
    const incident = INCIDENTS.find((item) => item.component === key && item.daysAgo === daysAgo);
    return { daysAgo, level: (incident?.level ?? "operational") as Level, incident };
  });
}

function uptimeFor(key: string) {
  const down = INCIDENTS.filter((item) => item.component === key).reduce((sum, item) => sum + item.minutes, 0);
  const total = DAYS * 24 * 60;
  return ((total - down) / total) * 100;
}

export default function StatusPage() {
  return (
    <Container className="pb-24 pt-14 sm:pt-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-faint">Demo status page</p>
          <h1 className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">System status</h1>
        </div>
        <p className="max-w-sm text-sm text-ink-muted sm:text-right">
          Sample data that shows how Atrium reports its health. It isn&apos;t connected to live monitoring.
        </p>
      </div>

      <section
        aria-label="Current status"
        className="mt-8 border-y border-line py-6"
      >
        <div className="flex items-center gap-4">
          <CheckCircle2 size={26} className="flex-none text-emerald-300" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold text-ink">All systems operational</p>
            <p className="mt-0.5 text-sm text-ink-muted">No open incidents. The last one was resolved {daysAgoLabel(INCIDENTS[0].daysAgo).toLowerCase()}.</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-x-10 gap-y-12 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="components-title" className="card self-start">
          <div className="flex flex-col gap-2 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="components-title" className="font-semibold text-ink">
              Components
            </h2>
            <p className="text-xs text-ink-faint">Uptime over the last {DAYS} days</p>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {COMPONENTS.map((component) => {
              const history = historyFor(component.key);
              const uptime = uptimeFor(component.key);
              const issues = history.filter((day) => day.level !== "operational");
              return (
                <li key={component.key} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-ink">{component.name}</h3>
                      <p className="mt-0.5 text-xs text-ink-faint">{component.description}</p>
                    </div>
                    <Badge tone="emerald">
                      Operational
                    </Badge>
                  </div>
                  <div
                    role="img"
                    aria-label={`${component.name}, last ${DAYS} days: ${
                      issues.length === 0
                        ? "no incidents"
                        : issues.map((day) => `${LEVEL_META[day.level].label.toLowerCase()} ${daysAgoLabel(day.daysAgo).toLowerCase()}`).join(", ")
                    }.`}
                    className="mt-4 flex h-9 items-stretch gap-[2px]"
                  >
                    {history.map((day) => (
                      <span
                        key={day.daysAgo}
                        title={`${daysAgoLabel(day.daysAgo)}: ${day.incident ? `${LEVEL_META[day.level].label}, ${day.incident.title}` : "No incidents"}`}
                        className={cn("min-w-0 flex-1 rounded-[2px] transition-colors", LEVEL_META[day.level].bar)}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-ink-faint">
                    <span>{DAYS} days ago</span>
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    <span className="tabular-nums text-ink-muted">{uptime === 100 ? "100" : uptime.toFixed(2)}% uptime</span>
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    <span>Today</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-4 text-xs text-ink-muted">
            {(Object.keys(LEVEL_META) as Level[]).map((level) => (
              <span key={level} className="flex items-center gap-2">
                <span className={cn("h-3 w-1.5 rounded-[2px]", LEVEL_META[level].bar)} aria-hidden="true" />
                {LEVEL_META[level].label}
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="incidents-title">
          <h2 id="incidents-title" className="text-xl font-semibold text-ink">
            Past incidents
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Sample incidents from the last {DAYS} days.</p>
          <ol className="mt-6 space-y-4">
            {INCIDENTS.map((incident) => {
              const meta = LEVEL_META[incident.level];
              const component = COMPONENTS.find((item) => item.key === incident.component);
              return (
                <li key={incident.id} className="card p-5 sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink">{incident.title}</h3>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {component?.name} · {daysAgoLabel(incident.daysAgo)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <Badge tone="emerald">Resolved</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{incident.summary}</p>
                  <ol className="mt-4 space-y-2 border-l border-line pl-4">
                    {incident.updates.map((update) => (
                      <li key={update.label} className="text-sm text-ink-muted">
                        <span className="font-medium text-ink-secondary">{update.label}.</span> {update.text}
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
          <p className="mt-8 text-sm text-ink-muted">
            Something not working for you?{" "}
            <Link href="/contact?topic=support" className="font-medium text-cyan-300 hover:text-cyan-200">
              Tell support
            </Link>
          </p>
        </section>
      </div>
    </Container>
  );
}
