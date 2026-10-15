"use server";

import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { canWorkOnProject, getVisibleProject } from "@/lib/data/access";
import { storageUsage } from "@/lib/data/storage";
import { getDb } from "@/lib/data/store";
import { issueUpload, uploadKey } from "@/lib/storage/uploads";
import { formatBytes } from "@/lib/utils";
import { uploadSchema } from "@/lib/validation/schemas";

export type UploadTarget = { kind: "file"; projectId: string } | { kind: "deliverable"; projectId: string } | { kind: "version"; deliverableId: string };

export type PreparedUpload = { ok: true; ticket: string; uploadUrl: string | null } | { ok: false; message: string };

/**
 * Step 1 of an upload (see lib/storage/uploads.ts): the same checks the save
 * action runs, then a ticket and a signed URL for one new object.
 */
export async function prepareUpload(
  orgSlug: string,
  target: UploadTarget,
  file: { fileName: string; mimeType: string; sizeBytes: number },
): Promise<PreparedUpload> {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const projectId =
    target.kind === "version"
      ? db.deliverables.find((item) => item.id === target.deliverableId && item.organizationId === ctx.org.id)?.projectId
      : target.projectId;
  const project = projectId ? getVisibleProject(db, ctx, projectId) : null;
  const allowed =
    project &&
    project.organizationId === ctx.org.id &&
    canWorkOnProject(db, ctx, project) &&
    (target.kind === "version" || can(ctx.role, "deliverables.upload"));
  if (!project || !allowed) return { ok: false, message: "You can't upload to this project." };

  const parsed = uploadSchema.safeParse(file);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "This file can't be uploaded." };

  const storage = storageUsage(db, ctx.org.id);
  if (!storage.allows(parsed.data.sizeBytes)) {
    return {
      ok: false,
      message: `This file would go over your ${storage.planName} plan's ${formatBytes(storage.limit)} of storage. Remove old files or upgrade.`,
    };
  }

  const issued = await issueUpload({
    orgId: ctx.org.id,
    projectId: project.id,
    userId: ctx.user.id,
    storageKey: uploadKey(ctx.org.id, project.id, target.kind === "file" ? "files" : "deliverables"),
    fileName: parsed.data.fileName,
    sizeBytes: parsed.data.sizeBytes,
  });
  return { ok: true, ...issued };
}
