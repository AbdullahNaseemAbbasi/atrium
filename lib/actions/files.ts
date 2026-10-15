"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { canManageProject, canWorkOnProject, getVisibleProject } from "@/lib/data/access";
import { recordActivity, recordAudit } from "@/lib/data/events";
import { storageUsage } from "@/lib/data/storage";
import { getDb, newId, saveDb } from "@/lib/data/store";
import { claimUpload, removeStoredObject } from "@/lib/storage/uploads";
import { uploadSchema } from "@/lib/validation/schemas";
import { formatBytes } from "@/lib/utils";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

const visibilitySchema = z.object({
  visibility: z.enum(["internal", "client"], { error: "Choose who can see this file." }),
});

/**
 * Saves a project file. The bytes are already in private storage (the browser
 * uploaded them through the signed URL from `prepareUpload`); this checks the
 * ticket and the object, then records the row.
 */
export async function uploadProjectFile(orgSlug: string, projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project || project.organizationId !== ctx.org.id || !canWorkOnProject(db, ctx, project) || !can(ctx.role, "deliverables.upload")) {
    return fail("You can't upload files to this project.");
  }
  const file = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!file.success) return invalid(file.error, formValues(formData));
  const meta = visibilitySchema.safeParse({ visibility: formData.get("visibility") });
  if (!meta.success) return invalid(meta.error, formValues(formData));
  if (meta.data.visibility === "client" && !project.clientId) {
    return fail("Internal projects have no client to share with. Keep the file internal.", { visibility: ["Internal projects can only hold internal files."] }, formValues(formData));
  }

  const storage = storageUsage(db, ctx.org.id);
  if (!storage.allows(file.data.sizeBytes)) {
    return fail(
      `This upload would go over your ${storage.planName} plan's ${formatBytes(storage.limit)} of storage (${formatBytes(storage.used)} used). Remove old files or upgrade.`,
      undefined,
      formValues(formData),
    );
  }

  const upload = await claimUpload(formData, { orgId: ctx.org.id, projectId: project.id, userId: ctx.user.id, ...file.data }, "files");
  if (!upload.ok) return fail(upload.message, { fileName: [upload.message] }, formValues(formData));

  const now = new Date().toISOString();
  const id = newId("fil");
  db.files.push({
    id,
    organizationId: ctx.org.id,
    projectId: project.id,
    name: file.data.fileName,
    mimeType: file.data.mimeType || "application/octet-stream",
    sizeBytes: file.data.sizeBytes,
    storageKey: upload.storageKey,
    visibility: meta.data.visibility,
    uploadedByUserId: ctx.user.id,
    createdAt: now,
  });
  project.updatedAt = now;
  recordActivity(db, ctx, {
    projectId: project.id,
    verb: "file.uploaded",
    targetType: "file",
    targetId: id,
    targetLabel: file.data.fileName,
    visibility: meta.data.visibility,
  });
  await saveDb();
  refresh();
  return ok(
    meta.data.visibility === "client"
      ? project.sharedWithClient
        ? `${file.data.fileName} uploaded and shared with the client.`
        : `${file.data.fileName} uploaded. The client sees it once the project is shared.`
      : `${file.data.fileName} uploaded. Only your team can see it.`,
  );
}

/** Removes a project file. Deliverable versions are never deleted: they carry the approval history. */
export async function deleteProjectFile(orgSlug: string, fileId: string): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const file = db.files.find((item) => item.id === fileId && item.organizationId === ctx.org.id);
  const project = file ? getVisibleProject(db, ctx, file.projectId) : null;
  if (!file || !project) return fail("That file no longer exists.");
  if (!canManageProject(db, ctx, project)) return fail("Only the project lead or a manager can delete files.");
  db.files = db.files.filter((item) => item.id !== file.id);
  project.updatedAt = new Date().toISOString();
  recordAudit(db, ctx, {
    action: "file.deleted",
    entityType: "file",
    entityId: file.id,
    summary: `Deleted ${file.name} from ${project.name}`,
    metadata: { visibility: file.visibility, sizeBytes: file.sizeBytes },
  });
  await saveDb();
  await removeStoredObject(file.storageKey);
  refresh();
  return ok(`${file.name} deleted.`);
}
