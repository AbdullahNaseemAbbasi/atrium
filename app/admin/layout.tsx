import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { AppFooter, AppFrame, HeaderSkeleton } from "@/components/shell/chrome";
import { AdminHeader } from "@/components/admin/admin-header";

export const metadata: Metadata = { title: { template: "%s · Platform · Atrium", default: "Platform operations · Atrium" } };

/**
 * Platform operator area. Request-time only (session + role), so navigations
 * may wait on the server. Anyone who isn't a platform admin gets a 404 here
 * and in every query below.
 */
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppFrame>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main id="main" className="flex-1 pb-8">
        {children}
      </main>
      <AppFooter />
    </AppFrame>
  );
}

async function Header() {
  const admin = await requirePlatformAdmin();
  return <AdminHeader admin={{ name: admin.name, email: admin.email, avatarHue: admin.avatarHue }} />;
}
