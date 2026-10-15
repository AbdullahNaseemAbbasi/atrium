import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, Inbox, PartyPopper, RotateCcw } from "lucide-react";
import { firstParam } from "@/lib/utils";
import { APPROVAL_TABS, getApprovals, WAITING_WARNING_DAYS, type ApprovalTab, type ApprovalsPage as ApprovalsData } from "@/lib/data/queries/approvals";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, FilterChips, PageHeader, Skeleton, StatGridSkeleton } from "@/components/ui/misc";
import { ParamSelect } from "@/components/ui/interactive";
import { DecisionList, QueueList } from "@/components/approvals/queue-list";

export const metadata: Metadata = { title: "Approvals" };

type Search = Record<string, string | string[] | undefined>;

export default function ApprovalsPage({ params, searchParams }: PageProps<"/w/[org]/approvals">) {
  return (
    <Suspense fallback={<ApprovalsSkeleton />}>
      <Approvals params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const TAB_COPY: Record<ApprovalTab, { hint: string; empty: { title: string; description: string } }> = {
  waiting: {
    hint: `Submitted work the client hasn't decided on. Anything over ${WAITING_WARNING_DAYS} days is flagged so you can follow up.`,
    empty: { title: "Nothing waiting on clients", description: "When you send a deliverable for review, it waits here until the client approves or asks for changes." },
  },
  changes: {
    hint: "The client asked for changes. Upload a new version to start the next review.",
    empty: { title: "No change requests", description: "Client feedback that needs a new version will show up here." },
  },
  drafts: {
    hint: "Uploaded drafts that haven't gone to the client yet. Ready ones can be sent from the deliverable page.",
    empty: { title: "No drafts", description: "Drafts appear when someone uploads a deliverable that hasn't been sent for review." },
  },
  decided: {
    hint: "Every approval and change request from the last 30 days, pinned to the version that was reviewed.",
    empty: { title: "No decisions in the last 30 days", description: "Approvals and change requests from clients will be listed here." },
  },
};

async function Approvals({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getApprovals(org, { tab: firstParam(query.tab), project: firstParam(query.project) });

  const href = (tab: ApprovalTab) => {
    const next = new URLSearchParams();
    if (tab !== "waiting") next.set("tab", tab);
    if (data.project) next.set("project", data.project);
    const qs = next.toString();
    return `${data.base}/approvals${qs ? `?${qs}` : ""}`;
  };
  const chips = (Object.keys(APPROVAL_TABS) as ApprovalTab[]).map((tab) => ({
    label: APPROVAL_TABS[tab],
    count: data.counts[tab],
    active: data.tab === tab,
    href: href(tab),
  }));
  const copy = TAB_COPY[data.tab];

  return (
    <>
      <PageHeader title="Approvals" description="The review status of everything you've sent to clients, and which items have waited too long." />

      <section aria-label="Approval metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Waiting on client" value={String(data.stats.waiting)} caption={data.stats.waiting ? `Oldest sent ${data.stats.oldest} ${data.stats.oldest === 1 ? "day" : "days"} ago.` : "Nothing in review right now."} />
        <StatCard
          icon={AlertTriangle}
          label={`Waiting over ${WAITING_WARNING_DAYS} days`}
          value={String(data.stats.overdue)}
          caption={data.stats.overdue > 0 ? "Consider sending the approver a reminder." : "Nothing has waited that long."}
          danger={data.stats.overdue > 0}
        />
        <StatCard icon={RotateCcw} label="Changes requested" value={String(data.counts.changes)} caption={`${data.stats.changes30} in the last 30 days.`} />
        <StatCard icon={CheckCircle2} label="Approved" value={String(data.stats.approved30)} caption="Client approvals in the last 30 days." />
      </section>

      <Card className="mt-4">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips label="Approval queue" items={chips} />
          {data.projects.length > 1 && (
            <ParamSelect
              param="project"
              label="Filter by project"
              className="lg:w-56"
              options={[{ value: "", label: "All projects" }, ...data.projects.map((project) => ({ value: project.id, label: project.name }))]}
            />
          )}
        </div>
        <p className="px-4 pt-4 text-xs text-ink-faint sm:px-5">{copy.hint}</p>
        <div className="pb-2 pt-2">
          <TabContent data={data} />
        </div>
      </Card>
    </>
  );
}

function TabContent({ data }: { data: ApprovalsData }) {
  const copy = TAB_COPY[data.tab].empty;
  const items = data.tab === "decided" ? data.decided : data[data.tab];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={data.tab === "waiting" ? PartyPopper : data.tab === "decided" ? FileCheck2 : Inbox}
        title={data.project ? "Nothing here for this project" : copy.title}
        description={data.hasAnyDeliverables ? copy.description : "Upload a deliverable from a project to start a client review."}
        action={
          data.project ? (
            <Link href={`${data.base}/approvals${data.tab === "waiting" ? "" : `?tab=${data.tab}`}`} className={buttonClasses({ variant: "secondary" })}>
              Show all projects
            </Link>
          ) : (
            <Link href={`${data.base}/projects`} className={buttonClasses({ variant: "secondary" })}>
              Go to projects
            </Link>
          )
        }
      />
    );
  }
  if (data.tab === "decided") return <DecisionList items={data.decided} />;
  return <QueueList items={data[data.tab]} tab={data.tab} />;
}

function ApprovalsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <StatGridSkeleton />
      <div className="card mt-4 space-y-3 p-5">
        <Skeleton className="h-9 w-2/3" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
