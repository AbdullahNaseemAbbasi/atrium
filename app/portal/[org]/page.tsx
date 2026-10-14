import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CheckCircle2, Clock3, FileCheck2, Folder, FolderOpen, Mail, Users, type LucideIcon } from "lucide-react";
import { getPortalOverview } from "@/lib/data/queries/portal";
import { Card, CardBody, CardHeader, IconBox } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { CardSkeleton, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { ReviewList } from "@/components/portal/review-list";
import { ProjectCard } from "@/components/portal/project-card";
import { ActivityFeed } from "@/components/portal/activity-feed";
import { FlashToast } from "@/components/ui/flash-toast";

export const metadata: Metadata = { title: "Overview" };

export default function PortalOverviewPage({ params }: PageProps<"/portal/[org]">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <FlashToast messages={{ joined: "Welcome. You can now review and approve work here." }} />
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getPortalOverview(org);
  const reviewCount = data.reviews.length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${data.firstName}`}
        description={
          reviewCount > 0
            ? data.canApprove
              ? `${data.agencyName} is waiting on your decision for ${reviewCount} ${reviewCount === 1 ? "deliverable" : "deliverables"}. Everything else is on track below.`
              : `${reviewCount} ${reviewCount === 1 ? "deliverable is" : "deliverables are"} out for approval. You can open them and leave comments.`
            : `Here's where your work with ${data.agencyName} stands today.`
        }
      />

      <section aria-label="Summary" className="grid grid-cols-3 gap-3">
        <SummaryTile icon={Folder} value={data.stats.active} label={data.stats.active === 1 ? "Active project" : "Active projects"} href={`${data.base}/projects`} />
        <SummaryTile
          icon={Clock3}
          tone={data.stats.pending > 0 ? "amber" : "cyan"}
          value={data.stats.pending}
          label={data.canApprove ? "Waiting for your review" : "Waiting for approval"}
          href={`${data.base}/approvals`}
        />
        <SummaryTile icon={FileCheck2} tone="emerald" value={data.stats.approvedLast30} label="Approved in the last 30 days" href={`${data.base}/approvals?decision=approved`} />
      </section>

      <Card className="mt-4">
        <CardHeader
          icon={Clock3}
          tone="amber"
          title={data.canApprove ? "Needs your review" : "Out for approval"}
          description={
            data.canApprove
              ? `Approve each version or tell ${data.agencyName} what to change. Your decision is recorded against that exact version.`
              : "Your approver makes the final call. You can open each one and add comments."
          }
          action={
            <Link href={`${data.base}/approvals`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              All approvals →
            </Link>
          }
        />
        <CardBody>
          {reviewCount === 0 ? (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="You're all caught up"
              description={`Nothing is waiting for you. We'll notify you as soon as ${data.agencyName} sends new work.`}
            />
          ) : (
            <ReviewList items={data.reviews} base={data.base} canApprove={data.canApprove} />
          )}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <section aria-labelledby="active-projects" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <h2 id="active-projects" className="font-semibold text-ink">
              Active projects
            </h2>
            <Link href={`${data.base}/projects`} className="text-sm text-cyan-300 hover:text-cyan-200">
              All projects →
            </Link>
          </div>
          {data.activeProjects.length === 0 ? (
            <Card>
              <EmptyState
                icon={FolderOpen}
                title="No active projects"
                description={`When ${data.agencyName} shares a project with ${data.clientName}, it appears here with its milestones and progress.`}
                action={
                  data.stats.completed > 0 ? (
                    <Link href={`${data.base}/projects?status=completed`} className={buttonClasses({ variant: "secondary" })}>
                      See completed projects
                    </Link>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.activeProjects.map((project) => (
                <ProjectCard key={project.id} project={project} base={data.base} hue={data.clientHue} />
              ))}
            </div>
          )}
          <Card className="mt-4">
            <CardHeader icon={Users} title={`Your team at ${data.agencyName}`} description="Reach out to the lead of each project directly." />
            <CardBody>
              {data.contacts.length === 0 ? (
                <p className="py-4 text-sm text-ink-muted">Your project leads will appear here.</p>
              ) : (
                <ul className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  {data.contacts.map((contact) => (
                    <li key={contact.user.id} className="flex items-center gap-3 rounded-xl py-2.5">
                      <Avatar user={contact.user} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{contact.user.name}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {contact.user.title ? `${contact.user.title} · ` : ""}Leads {contact.projects.join(", ")}
                        </p>
                      </div>
                      <a
                        href={`mailto:${contact.user.email}`}
                        className={buttonClasses({ variant: "outline", size: "icon-sm" })}
                        aria-label={`Email ${contact.user.name}`}
                        title={contact.user.email}
                      >
                        <Mail size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </section>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader icon={Activity} title="Recent updates" description="New versions, decisions and comments on your projects." />
            <CardBody>
              <ActivityFeed items={data.activity} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function SummaryTile({
  icon,
  value,
  label,
  href,
  tone = "cyan",
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  href: string;
  tone?: "cyan" | "amber" | "emerald";
}) {
  return (
    <Link href={href} className="card flex flex-col gap-1 p-3 transition hover:-translate-y-0.5 hover:border-cyan-400/20 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <IconBox icon={icon} tone={tone} className="hidden sm:grid" />
      <div className="min-w-0">
        <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
        <p className="text-xs leading-snug text-ink-muted sm:truncate">{label}</p>
      </div>
    </Link>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[74px] rounded-2xl" />
        ))}
      </div>
      <CardSkeleton className="mt-4" lines={2} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
