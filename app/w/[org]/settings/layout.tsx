import { Suspense } from "react";
import { getSettingsNav } from "@/lib/data/queries/settings";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children, params }: LayoutProps<"/w/[org]/settings">) {
  return (
    <>
      <PageHeader title="Settings" description="Your profile and notifications, plus how this workspace is set up, connected and audited." />
      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
        <Suspense fallback={<NavSkeleton />}>
          <Nav params={params} />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}

async function Nav({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const nav = await getSettingsNav(org);
  return <SettingsNav sections={nav.sections} billingHref={nav.billingHref} />;
}

function NavSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-11 w-full lg:hidden" />
      <div className="card hidden space-y-2 p-3 lg:block">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
