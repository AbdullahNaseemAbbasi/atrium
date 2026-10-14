import { Suspense } from "react";
import type { Metadata } from "next";
import { getProfileSettings } from "@/lib/data/queries/settings";
import { CardSkeleton } from "@/components/ui/misc";
import { PasswordForm, ProfileForm } from "@/components/settings/profile-forms";

export const metadata: Metadata = { title: "Profile · Settings" };

export default function ProfileSettingsPage({ params }: PageProps<"/w/[org]/settings/profile">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={3} />
        </div>
      }
    >
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getProfileSettings(org);
  return (
    <>
      <ProfileForm orgSlug={data.orgSlug} defaults={data.user} timezones={data.timezones} roleLabel={data.roleLabel} />
      <PasswordForm orgSlug={data.orgSlug} />
    </>
  );
}
