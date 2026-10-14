"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

/** Shown for anything a client can't see: unknown ids, other clients' work, drafts. */
export default function PortalNotFound() {
  const params = useParams<{ org?: string }>();
  const home = params.org ? `/portal/${params.org}` : "/";
  return (
    <Card className="mt-8">
      <EmptyState
        icon={SearchX}
        title="This page isn't available"
        description="It may have moved, or it isn't shared with you. Check the link or go back to your projects."
        action={
          <Link href={home} className={buttonClasses({ variant: "secondary" })}>
            Back to your portal
          </Link>
        }
      />
    </Card>
  );
}
