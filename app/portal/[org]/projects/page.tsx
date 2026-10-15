import { Suspense } from "react";
import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { firstParam } from "@/lib/utils";
import { listPortalProjects } from "@/lib/data/queries/portal";
import { Card } from "@/components/ui/card";
import { EmptyState, FilterChips, PageHeader, Skeleton } from "@/components/ui/misc";
import { ProjectCard } from "@/components/portal/project-card";

export const metadata: Metadata = { title: "Projects" };

export default function PortalProjectsPage({ params, searchParams }: PageProps<"/portal/[org]/projects">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="space-y-3 pb-5 pt-7">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <Projects params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Projects({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await listPortalProjects(org, { status: firstParam(query.status) });
  const href = `${data.base}/projects`;
  const chips = (
    [
      ["all", "All"],
      ["active", "Active"],
      ["completed", "Completed"],
    ] as const
  ).map(([key, label]) => ({
    label,
    count: data.counts[key],
    active: data.status === key,
    href: key === "all" ? href : `${href}?status=${key}`,
  }));

  return (
    <>
      <PageHeader title="Projects" description={`Everything ${data.agencyName} is working on for ${data.clientName.replace(/\.$/, "")}.`} />
      <div className="mb-4">
        <FilterChips label="Filter projects" items={chips} />
      </div>
      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title={data.counts.all === 0 ? "No shared projects yet" : "Nothing here"}
            description={
              data.counts.all === 0
                ? `${data.agencyName} hasn't shared a project with you yet. You'll get a notification when they do.`
                : "No projects match this filter. Choose All to see every project."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.rows.map((project) => (
            <ProjectCard key={project.id} project={project} base={data.base} hue={data.clientHue} />
          ))}
        </div>
      )}
    </>
  );
}
