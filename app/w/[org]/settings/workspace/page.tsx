import { Suspense } from "react";
import type { Metadata } from "next";
import { getWorkspaceSettings } from "@/lib/data/queries/settings";
import { CardSkeleton } from "@/components/ui/misc";
import { DangerZone, WorkspaceForm } from "@/components/settings/workspace-form";

export const metadata: Metadata = { title: "Workspace · Settings" };

export default function WorkspaceSettingsPage({ params }: PageProps<"/w/[org]/settings/workspace">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={2} />
        </div>
      }
    >
      <Workspace params={params} />
    </Suspense>
  );
}

async function Workspace({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getWorkspaceSettings(org);
  return (
    <>
      <WorkspaceForm orgSlug={data.orgSlug} defaults={data.org} timezones={data.timezones} canEdit={data.canEdit} ownerName={data.ownerName} />
      {data.canEdit && <DangerZone workspaceName={data.org.name} isOwner={data.isOwner} />}
    </>
  );
}
