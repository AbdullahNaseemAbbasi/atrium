import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Eye, EyeOff, Users } from "lucide-react";
import { getProjectSettings } from "@/lib/data/queries/project-tabs";
import { updateProject } from "@/lib/actions/projects";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CardSkeleton } from "@/components/ui/misc";
import { ProjectForm } from "@/components/projects/project-form";
import { ArchiveProjectButton } from "@/components/project-tabs/archive-project";

export const metadata: Metadata = { title: "Project settings" };

export default function ProjectSettingsPage({ params }: PageProps<"/w/[org]/projects/[projectId]/settings">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <CardSkeleton lines={8} />
          <CardSkeleton lines={4} />
        </div>
      }
    >
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Promise<{ org: string; projectId: string }> }) {
  const { org, projectId } = await params;
  const data = await getProjectSettings(org, projectId);
  const archived = data.status === "cancelled";

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card className="min-w-0 p-5 sm:p-7">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink">Project details</h2>
          <p className="mt-1 text-sm text-ink-muted">Name, schedule, team and client sharing. Last changed {data.updatedText}.</p>
        </div>
        <ProjectForm
          action={updateProject.bind(null, data.orgSlug, data.projectId)}
          clients={data.clients}
          team={data.team}
          defaults={data.defaults}
          submitLabel="Save changes"
          canShare={data.canShare}
          footer={
            <>
              {/* The sharing checkbox is disabled for leads, so keep its current value in the submission. */}
              <Link href={data.projectBase} className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-medium text-ink-muted transition hover:bg-white/5 hover:text-ink">
                Cancel
              </Link>
            </>
          }
        />
      </Card>

      <aside className="min-w-0 space-y-4">
        <Card>
          <CardHeader icon={Users} title="Members" description="Change the lead and contributors in the form." />
          <CardBody>
            <ul className="space-y-3">
              {data.members.map((member) => (
                <li key={member.user.id} className="flex items-center gap-3">
                  <Avatar user={member.user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{member.user.name}</p>
                    <p className="truncate text-xs text-ink-faint">{member.user.title ?? member.orgRole}</p>
                  </div>
                  <Badge tone={member.projectRole === "lead" ? "cyan" : "slate"}>{member.projectRole === "lead" ? "Lead" : "Contributor"}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-faint">Owners and managers can open every project, even when they aren&apos;t listed here.</p>
          </CardBody>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            {data.defaults.sharedWithClient ? (
              <Eye size={18} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
            ) : (
              <EyeOff size={18} className="mt-0.5 flex-none text-ink-faint" aria-hidden="true" />
            )}
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ink">Client portal</p>
              <p className="mt-1 text-ink-muted">
                {!data.client
                  ? "Internal project. There's no client to share it with."
                  : data.defaults.sharedWithClient
                    ? `Shared with ${data.client.name.replace(/\.$/, "")}. ${data.client.portalUsers} portal ${data.client.portalUsers === 1 ? "user sees" : "users see"} its progress and submitted work.`
                    : `Not shared with ${data.client.name} yet. Nothing from this project is on their portal.`}
              </p>
              {!data.canShare && data.client && <p className="mt-2 text-xs text-ink-faint">Only owners and managers can change sharing.</p>}
            </div>
          </div>
        </Card>

        <Card className="border-red-500/20 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 flex-none text-red-300" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">Danger zone</h2>
              {archived ? (
                <p className="mt-1 text-sm text-ink-muted">
                  This project is archived (status: Cancelled). To bring it back, pick another status in the form and save.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-ink-muted">
                    Archive the project when the work stops. Its {data.counts.tasks} tasks, {data.counts.deliverables} deliverables and{" "}
                    {data.counts.files} files are kept.
                  </p>
                  <div className="mt-4">
                    <ArchiveProjectButton orgSlug={data.orgSlug} projectId={data.projectId} name={data.name} clientName={data.client?.name ?? null} />
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
