import { Suspense } from "react";
import { RealtimeSync } from "@/components/realtime/realtime-sync";
import { AppFooter, AppFrame, HeaderSkeleton } from "@/components/shell/chrome";
import { WorkspaceHeader } from "@/components/shell/workspace-header";
import { getWorkspaceShell } from "@/lib/data/queries/shell";

/**
 * Every screen below this layout is per-user, per-workspace data read at
 * request time, so navigations are allowed to wait on the server. Each page
 * still streams behind its own Suspense skeleton.
 */
export const instant = false;

export default function WorkspaceLayout({ children, params }: LayoutProps<"/w/[org]">) {
  return (
    <AppFrame>
      <Suspense fallback={<HeaderSkeleton />}>
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
  const shell = await getWorkspaceShell(org);
  return (
    <>
      <WorkspaceHeader shell={shell} />
      {shell.live && <RealtimeSync orgId={shell.org.id} userId={shell.user.id} scope="team" />}
    </>
  );
}
