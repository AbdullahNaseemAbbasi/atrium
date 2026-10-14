"use client";

import * as React from "react";
import { Download, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { requestDownload } from "@/lib/actions/deliverables";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Asks the server for a fresh 60-second signed link (access is re-checked and
 * the download is audited), then starts the download.
 */
export function DownloadButton({
  orgSlug,
  objectId,
  kind,
  label = "Download",
  iconOnly = false,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  orgSlug: string;
  objectId: string;
  kind: "version" | "file";
  label?: string;
  iconOnly?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size={iconOnly ? "icon-sm" : "sm"}
      disabled={pending}
      aria-label={iconOnly ? label : undefined}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await requestDownload(orgSlug, objectId, kind);
            window.location.assign(result.url);
            toast.success(`Downloading ${result.fileName}`, { description: `Secure link valid for ${result.expiresInSeconds} seconds.` });
          } catch {
            toast.error("You no longer have access to this file.");
          }
        })
      }
      {...props}
    >
      {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
      {!iconOnly && label}
    </Button>
  );
}
