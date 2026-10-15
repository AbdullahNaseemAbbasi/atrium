import { Suspense } from "react";
import { RealtimeSync } from "@/components/realtime/realtime-sync";
import { AppFooter, AppFrame } from "@/components/shell/chrome";
import { PortalHeader, PortalHeaderSkeleton } from "@/components/portal/portal-header";
import { getPortalShell } from "@/lib/data/queries/shell";

/**
 * Client portal shell. Every screen below is per-user data read at request
 * time (and only for the signed-in client's shared projects), so navigations
 * are allowed to wait on the server. Each page streams behind its own
 * Suspense skeleton.
 */
export const instant = false;

export default function PortalLayout({ children, params }: LayoutProps<"/portal/[org]">) {
  return (
    <AppFrame>
      <Suspense fallback={<PortalHeaderSkeleton />}>
        <Header params={params} />
      </Suspense>
      <main id="main" className="flex-1 pb-8">
        {children}
      </main>
      <AppFooter />
    </AppFrame>
  );
}

async function Header({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const shell = await getPortalShell(org);
  return (
    <>
      <PortalHeader shell={shell} />
      {shell.live && <RealtimeSync orgId={shell.org.id} userId={shell.user.id} scope="portal" />}
    </>
  );
}
