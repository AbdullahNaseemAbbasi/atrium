import { Suspense } from "react";
import type { Metadata } from "next";
import { Archive, Database, Download, FileJson, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getDataSettings } from "@/lib/data/queries/settings";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CardSkeleton, FormNote } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Data & privacy · Settings" };

export default function DataSettingsPage({ params }: PageProps<"/w/[org]/settings/data">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={4} />
        </div>
      }
    >
      <DataSettings params={params} />
    </Suspense>
  );
}

const RETENTION: { title: string; body: string }[] = [
  {
    title: "Projects, tasks and comments",
    body: "Kept while the workspace exists. Removed with everything else when the workspace is purged.",
  },
  {
    title: "Files and deliverable versions",
    body: "Stored privately and only served through links that expire after 60 seconds. Removed from storage when the workspace is purged.",
  },
  {
    title: "Client portal access",
    body: "Revoking a client user ends their access on their next request. Their past approvals and comments stay as a record of decisions.",
  },
  {
    title: "Audit log",
    body: "Kept for the life of the workspace and never editable. Included in this export and purged with the workspace.",
  },
  {
    title: "Billing records",
    body: "Invoices are kept for 7 years after the workspace is deleted, because tax law requires it. Card details are held by the payment provider, never by Atrium.",
  },
  {
    title: "Deleting the workspace",
    body: "Read-only immediately, soft-deleted for 30 days (restorable by support), then all data and files are permanently purged.",
  },
];

async function DataSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getDataSettings(org);
  return (
    <>
      <Card>
        <CardHeader
          icon={FileJson}
          title="Export workspace data"
          description={`Everything in ${data.orgName} as one JSON file: projects, tasks, deliverables, approvals, comments, clients, members and the audit log.`}
          action={
            <a href={data.exportHref} download className={buttonClasses({ size: "sm" })}>
              <Download size={14} /> Export JSON
            </a>
          }
        />
        <div className="px-4 pb-5 sm:px-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.counts.map((item) => (
              <div key={item.label} className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-3">
                <dt className="text-xs text-ink-faint">{item.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-ink">{item.value.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
          <FormNote icon={ShieldCheck} className="mt-4">
            File contents are not included, only their names, sizes and versions. Private storage keys and other people&apos;s notification
            settings are left out. Each export is recorded in the audit log.
            {data.lastExport && (
              <span className="mt-1 block text-xs text-ink-faint">
                Last export by {data.lastExport.by}, {formatDateTime(data.lastExport.at)}: {data.lastExport.summary}.
              </span>
            )}
          </FormNote>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader icon={Archive} title="Retention and deletion" description="How long Atrium keeps each kind of data and what happens when it is deleted." />
        <div className="px-4 pb-5 sm:px-5">
          <ul className="divide-y divide-white/[0.05] rounded-2xl border border-line">
            {RETENTION.map((item) => (
              <li key={item.title} className="flex gap-3 px-4 py-3.5">
                <Database size={16} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}
