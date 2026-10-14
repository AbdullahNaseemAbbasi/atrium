import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { getNewClientForm } from "@/lib/data/queries/clients";
import { createClient } from "@/lib/actions/clients";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { CardSkeleton, PageHeader, ProgressBar } from "@/components/ui/misc";
import { ClientForm } from "@/components/clients/client-form";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage({ params }: PageProps<"/w/[org]/clients/new">) {
  return (
    <Suspense fallback={<CardSkeleton className="mt-8" lines={8} />}>
      <NewClient params={params} />
    </Suspense>
  );
}

async function NewClient({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getNewClientForm(org);
  const { limit } = data;

  return (
    <>
      <PageHeader
        title="Add client"
        description="Save the company and its main contact. You can invite portal users and start projects right after."
        breadcrumbs={[{ label: "Clients", href: `${data.base}/clients` }, { label: "Add client" }]}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="p-5 sm:p-7">
          {!limit.allowed && (
            <FormMessage className="mb-6">
              Your {data.planName} plan includes {limit.limit} client portals and all of them are in use. Archive a client you no longer work with,
              or{" "}
              <Link href={`${data.base}/billing`} className="underline">
                upgrade your plan
              </Link>{" "}
              to add another.
            </FormMessage>
          )}
          <ClientForm
            action={createClient.bind(null, data.orgSlug)}
            defaults={{ status: "onboarding", brandHue: 190 }}
            industries={data.industries}
            submitLabel="Add client"
            footer={
              <Link href={`${data.base}/clients`} className={buttonClasses({ variant: "ghost", size: "lg" })}>
                Cancel
              </Link>
            }
          />
        </Card>
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Lightbulb size={17} className="text-amber-300" aria-hidden="true" /> What happens next
            </div>
            <ol className="mt-4 list-decimal space-y-3 pl-4 text-sm text-ink-muted marker:text-ink-faint">
              <li>Invite the people who review work. Approvers can sign off, viewers can only follow and comment.</li>
              <li>Create a project for this client and share it when the first milestone is ready.</li>
              <li>Clients only ever see shared projects, client-visible tasks and submitted deliverables.</li>
            </ol>
          </Card>
          <Card className="p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">Plan usage</p>
            {limit.limit === null ? (
              <p className="mt-2">{limit.used} client portals · unlimited on {data.planName}.</p>
            ) : (
              <>
                <p className="mt-2">
                  {limit.used} of {limit.limit} client portals used on {data.planName}. Archived clients don&apos;t count.
                </p>
                <ProgressBar
                  value={Math.round((limit.used / limit.limit) * 100)}
                  label="Client portals used"
                  tone={limit.allowed ? "cyan" : "amber"}
                  className="mt-3"
                />
              </>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
