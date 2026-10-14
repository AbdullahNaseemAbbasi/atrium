import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSettingsLanding } from "@/lib/data/queries/settings";
import { CardSkeleton } from "@/components/ui/misc";

export default function SettingsIndexPage({ params }: PageProps<"/w/[org]/settings">) {
  return (
    <Suspense fallback={<CardSkeleton lines={5} />}>
      <Landing params={params} />
    </Suspense>
  );
}

/** Owners land on workspace settings; everyone else on their profile. */
async function Landing({ params }: { params: Promise<{ org: string }> }): Promise<null> {
  const { org } = await params;
  redirect(await getSettingsLanding(org));
}
