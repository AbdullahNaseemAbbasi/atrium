import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { firstParam } from "@/lib/utils";
import { getNewProjectForm } from "@/lib/data/queries/projects";
import { createProject } from "@/lib/actions/projects";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { CardSkeleton, PageHeader } from "@/components/ui/misc";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage({ params, searchParams }: PageProps<"/w/[org]/projects/new">) {
  return (
    <Suspense fallback={<CardSkeleton className="mt-8" lines={8} />}>
      <NewProject params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewProject({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getNewProjectForm(org);
  // `?client=` pre-selects a client when coming from a client page; ignored unless it's one of this workspace's clients.
  const requestedClient = firstParam(query.client);
  const clientId = data.clients.some((client) => client.id === requestedClient) ? requestedClient : undefined;

  return (
    <>
      <PageHeader
        title="New project"
        description="Set up the basics now. You can add milestones, tasks and deliverables right after."
        breadcrumbs={[{ label: "Projects", href: `${data.base}/projects` }, { label: "New project" }]}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="p-5 sm:p-7">
          {!data.limit.allowed && (
            <FormMessage className="mb-6">
              Your {data.planName} plan allows {data.limit.limit} active projects and you have {data.limit.used}. New projects can still be
              created as On hold or Completed, or{" "}
              <Link href={`${data.base}/billing`} className="underline">
                upgrade your plan
              </Link>
              .
            </FormMessage>
          )}
          <ProjectForm
            action={createProject.bind(null, data.orgSlug)}
            clients={data.clients}
            team={data.team}
            defaults={{ leadId: data.currentUserId, status: "planning", icon: "globe", clientId }}
            submitLabel="Create project"
            footer={
              <Link href={`${data.base}/projects`} className={buttonClasses({ variant: "ghost", size: "lg" })}>
                Cancel
              </Link>
            }
          />
        </Card>
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Lightbulb size={17} className="text-amber-300" aria-hidden="true" /> Tips
            </div>
            <ul className="mt-4 space-y-3 text-sm text-ink-muted">
              <li>Keep the project private while you plan. Share it with the client once the first milestone is ready.</li>
              <li>Turn on Requires client approval for milestones the client must sign off before work moves on.</li>
              <li>New tasks are visible to the client. Untick that box on tasks only your team should see.</li>
            </ul>
          </Card>
          <Card className="p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">Plan usage</p>
            <p className="mt-2">
              {data.limit.limit === null
                ? `${data.limit.used} active projects · unlimited on ${data.planName}`
                : `${data.limit.used} of ${data.limit.limit} active projects used on ${data.planName}.`}
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
