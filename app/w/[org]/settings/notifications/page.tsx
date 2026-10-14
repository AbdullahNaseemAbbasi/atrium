import { Suspense } from "react";
import type { Metadata } from "next";
import { getNotificationSettings } from "@/lib/data/queries/settings";
import { CardSkeleton } from "@/components/ui/misc";
import { NotificationForm } from "@/components/settings/notification-form";

export const metadata: Metadata = { title: "Notifications · Settings" };

export default function NotificationSettingsPage({ params }: PageProps<"/w/[org]/settings/notifications">) {
  return (
    <Suspense fallback={<CardSkeleton lines={7} />}>
      <Notifications params={params} />
    </Suspense>
  );
}

async function Notifications({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getNotificationSettings(org);
  return (
    <NotificationForm
      orgSlug={data.orgSlug}
      orgName={data.orgName}
      email={data.email}
      muted={data.muted}
      digest={data.digest}
      seesBilling={data.seesBilling}
    />
  );
}
