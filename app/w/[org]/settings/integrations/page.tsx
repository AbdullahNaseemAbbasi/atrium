import { Suspense } from "react";
import type { Metadata } from "next";
import { Lock, Plug } from "lucide-react";
import { getIntegrations } from "@/lib/data/queries/settings";
import { Card, CardHeader } from "@/components/ui/card";
import { FormNote, Skeleton } from "@/components/ui/misc";
import { IntegrationCards } from "@/components/settings/integration-cards";

export const metadata: Metadata = { title: "Integrations · Settings" };

export default function IntegrationsPage({ params }: PageProps<"/w/[org]/settings/integrations">) {
  return (
    <Suspense fallback={<IntegrationsSkeleton />}>
      <Integrations params={params} />
    </Suspense>
  );
}

async function Integrations({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getIntegrations(org);
  const connected = data.items.filter((item) => item.connection).length;
  return (
    <>
      <Card className="mb-4">
        <CardHeader
          icon={Plug}
          title="Integrations"
          description={`${connected} of ${data.items.length} connected. Connections are shared by everyone in the workspace.`}
        />
        {!data.canManage && (
          <div className="px-4 pb-5 sm:px-5">
            <FormNote icon={Lock}>You can see what&apos;s connected. Only owners can connect or disconnect apps.</FormNote>
          </div>
        )}
      </Card>
      <IntegrationCards
        orgSlug={data.orgSlug}
        items={data.items}
        canManage={data.canManage}
        billingHref={data.billingHref}
        stripeConnected={data.stripeConnected}
      />
    </>
  );
}

function IntegrationsSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-4 h-[84px] rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[200px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
