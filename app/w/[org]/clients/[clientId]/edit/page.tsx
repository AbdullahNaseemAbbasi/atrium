import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getEditClientForm } from "@/lib/data/queries/clients";
import { updateClient } from "@/lib/actions/clients";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { CardSkeleton, FormNote, PageHeader } from "@/components/ui/misc";
import { ClientForm } from "@/components/clients/client-form";

export const metadata: Metadata = { title: "Edit client" };

export default function EditClientPage({ params }: PageProps<"/w/[org]/clients/[clientId]/edit">) {
  return (
    <Suspense fallback={<CardSkeleton className="mt-8" lines={8} />}>
      <EditClient params={params} />
    </Suspense>
  );
}

async function EditClient({ params }: { params: Promise<{ org: string; clientId: string }> }) {
  const { org, clientId } = await params;
  const data = await getEditClientForm(org, clientId);
  const clientHref = `${data.base}/clients/${data.clientId}`;

  return (
    <>
      <PageHeader
        title={`Edit ${data.companyName}`}
        description="Update company details, the main contact and status."
        breadcrumbs={[
          { label: "Clients", href: `${data.base}/clients` },
          { label: data.companyName, href: clientHref },
          { label: "Edit" },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="p-5 sm:p-7">
          <ClientForm
            action={updateClient.bind(null, data.orgSlug, data.clientId)}
            defaults={data.defaults}
            industries={data.industries}
            submitLabel="Save changes"
            allowArchived
            footer={
              <Link href={clientHref} className={buttonClasses({ variant: "ghost", size: "lg" })}>
                Cancel
              </Link>
            }
          />
        </Card>
        <aside className="space-y-4">
          <FormNote icon={AlertTriangle} tone="warning">
            <p className="font-medium text-amber-100">Archiving closes the portal</p>
            <p className="mt-1 text-amber-100/80">
              {data.activePortalUsers > 0
                ? `${data.activePortalUsers} portal ${data.activePortalUsers === 1 ? "user loses" : "users lose"} access the moment you archive. Projects and approvals stay in your workspace.`
                : "No one can sign in to an archived client's portal. Projects and approvals stay in your workspace."}
            </p>
          </FormNote>
          <Card className="p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">Plan usage</p>
            <p className="mt-2">
              {data.limit.limit === null
                ? `${data.limit.used} client portals · unlimited on ${data.planName}.`
                : `${data.limit.used} of ${data.limit.limit} client portals used on ${data.planName}. Archived clients don't count.`}
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
