"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import { nextDeliverableStatus } from "@/lib/domain/rules";
import {
  canSubmitDeliverable,
  canViewDeliverable,
  canViewProject,
  canWorkOnProject,
  getVisibleProject,
  resolveClientContext,
  resolveTeamContext,
  type AccessContext,
} from "@/lib/data/access";
import { clientAudience, notify, projectAudience, recordActivity, recordAudit } from "@/lib/data/events";
import { getDb, newId, saveDb } from "@/lib/data/store";
import type { Database } from "@/lib/data/types";
import { signDownload } from "@/lib/storage/signed-urls";
import { claimUpload } from "@/lib/storage/uploads";
import { PROJECT_FILES_BUCKET, usesSupabase } from "@/lib/supabase/config";
import { commentSchema, deliverableSchema, uploadSchema } from "@/lib/validation/schemas";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

function storageUsed(db: Database, orgId: string) {
  return (
    db.deliverableVersions.filter((item) => item.organizationId === orgId).reduce((sum, item) => sum + item.sizeBytes, 0) +
    db.files.filter((item) => item.organizationId === orgId).reduce((sum, item) => sum + item.sizeBytes, 0)
  );
}

function storageAllows(db: Database, orgId: string, adding: number) {
  const subscription = db.subscriptions.find((item) => item.organizationId === orgId);
  const plan = getPlan(subscription?.planKey ?? "starter");
  return checkLimit(plan, "storageBytes", storageUsed(db, orgId), adding).allowed;
}

/**
 * Creates a deliverable with its first version. The browser has already put
 * the bytes in private storage through the signed URL from `prepareUpload`;
 * `claimUpload` confirms the object before the row is saved.
 */
export async function createDeliverable(orgSlug: string, projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project || !canWorkOnProject(db, ctx, project) || !can(ctx.role, "deliverables.upload")) {
    return fail("You can't upload to this project.");
  }
  const meta = deliverableSchema.safeParse(Object.fromEntries(formData));
  const file = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!meta.success) return invalid(meta.error, formValues(formData));
  if (!file.success) return invalid(file.error, formValues(formData));
  if (meta.data.milestoneId && !db.milestones.some((item) => item.id === meta.data.milestoneId && item.projectId === project.id)) {
    return fail("Pick a milestone from this project.", { milestoneId: ["Pick a milestone from this project."] }, formValues(formData));
  }
  if (!storageAllows(db, ctx.org.id, file.data.sizeBytes)) {
    return fail("This upload would exceed your plan's storage. Upgrade or remove old files first.", undefined, formValues(formData));
  }
  const upload = await claimUpload(formData, { orgId: ctx.org.id, projectId: project.id, userId: ctx.user.id, ...file.data }, "deliverables");
  if (!upload.ok) return fail(upload.message, { fileName: [upload.message] }, formValues(formData));

  const now = new Date().toISOString();
  const id = newId("dlv");
  db.deliverables.push({
    id,
    organizationId: ctx.org.id,
    projectId: project.id,
    milestoneId: meta.data.milestoneId,
    title: meta.data.title,
    description: meta.data.description,
    status: "draft",
    currentVersion: 1,
    createdByUserId: ctx.user.id,
    createdAt: now,
    updatedAt: now,
  });
  db.deliverableVersions.push({
    id: `${id}_v1`,
    organizationId: ctx.org.id,
    deliverableId: id,
    version: 1,
    fileName: file.data.fileName,
    mimeType: file.data.mimeType || "application/octet-stream",
    sizeBytes: file.data.sizeBytes,
    storageKey: upload.storageKey,
    hasPreview: upload.hasPreview || undefined,
    note: file.data.note,
    uploadedByUserId: ctx.user.id,
    createdAt: now,
  });
  project.updatedAt = now;
  recordActivity(db, ctx, { projectId: project.id, verb: "deliverable.uploaded", targetType: "deliverable", targetId: id, targetLabel: meta.data.title, visibility: "internal" });
  await saveDb();
  redirect(`/w/${ctx.org.slug}/projects/${project.id}/deliverables/${id}?uploaded=1`);
}

async function loadDeliverableForTeam(orgSlug: string, deliverableId: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const deliverable = db.deliverables.find((item) => item.id === deliverableId && item.organizationId === ctx.org.id);
  const project = deliverable ? getVisibleProject(db, ctx, deliverable.projectId) : null;
  if (!deliverable || !project) return null;
  return { ctx, db, deliverable, project };
}

export async function uploadNewVersion(orgSlug: string, deliverableId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const loaded = await loadDeliverableForTeam(orgSlug, deliverableId);
  if (!loaded || !canWorkOnProject(loaded.db, loaded.ctx, loaded.project)) return fail("You can't upload to this deliverable.");
  const { ctx, db, deliverable, project } = loaded;
  const file = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!file.success) return invalid(file.error, formValues(formData));
  const next = nextDeliverableStatus(deliverable.status, "upload_version");
  if (!next) return fail("A new version can't be uploaded right now.");
  if (!storageAllows(db, ctx.org.id, file.data.sizeBytes)) return fail("This upload would exceed your plan's storage.");
  const upload = await claimUpload(formData, { orgId: ctx.org.id, projectId: project.id, userId: ctx.user.id, ...file.data }, "deliverables");
  if (!upload.ok) return fail(upload.message, { fileName: [upload.message] });

  const version = deliverable.currentVersion + 1;
  const now = new Date().toISOString();
  db.deliverableVersions.push({
    id: `${deliverable.id}_v${version}`,
    organizationId: ctx.org.id,
    deliverableId: deliverable.id,
    version,
    fileName: file.data.fileName,
    mimeType: file.data.mimeType || "application/octet-stream",
    sizeBytes: file.data.sizeBytes,
    storageKey: upload.storageKey,
    hasPreview: upload.hasPreview || undefined,
    note: file.data.note,
    uploadedByUserId: ctx.user.id,
    createdAt: now,
  });
  Object.assign(deliverable, { currentVersion: version, status: next, updatedAt: now, submittedAt: undefined });
  project.updatedAt = now;
  recordActivity(db, ctx, {
    projectId: project.id,
    verb: "deliverable.uploaded",
    targetType: "deliverable",
    targetId: deliverable.id,
    targetLabel: `${deliverable.title} v${version}`,
    visibility: "internal",
  });
  await saveDb();
  refresh();
  return ok(`Version ${version} uploaded as a draft. Submit it when it's ready for the client.`);
}

export async function submitForReview(orgSlug: string, deliverableId: string): Promise<ActionState> {
  const loaded = await loadDeliverableForTeam(orgSlug, deliverableId);
  if (!loaded) return fail("Deliverable not found.");
  const { ctx, db, deliverable, project } = loaded;
  if (!canSubmitDeliverable(db, ctx, project)) return fail("Only the project lead or a manager can send work to the client.");
  if (!project.clientId || !project.sharedWithClient) return fail("Share the project with the client before submitting.");
  const next = nextDeliverableStatus(deliverable.status, "submit");
  if (!next) return fail("This version has already been submitted.");

  const now = new Date().toISOString();
  Object.assign(deliverable, { status: next, submittedAt: now, updatedAt: now });
  project.updatedAt = now;
  recordActivity(db, ctx, {
    projectId: project.id,
    verb: "deliverable.submitted",
    targetType: "deliverable",
    targetId: deliverable.id,
    targetLabel: `${deliverable.title} v${deliverable.currentVersion}`,
  });
  notify(db, ctx, clientAudience(db, ctx.org.id, project.id), {
    type: "deliverable.submitted",
    title: `${deliverable.title} v${deliverable.currentVersion} is ready for your review`,
    body: `${ctx.org.name} · ${project.name}`,
    href: `/portal/${ctx.org.slug}/deliverables/${deliverable.id}`,
    deduplicationKey: `submitted:${deliverable.id}:${deliverable.currentVersion}`,
  });
  await saveDb();
  refresh();
  return ok("Sent to the client for review.");
}

/** Team or client comment on a deliverable. Clients can only post client-visible comments. */
export async function addDeliverableComment(orgSlug: string, deliverableId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const db = await getDb();
  const ctx: AccessContext | null = resolveTeamContext(db, user.id, orgSlug) ?? resolveClientContext(db, user.id, orgSlug);
  if (!ctx) return fail("Not found.");
  const deliverable = db.deliverables.find((item) => item.id === deliverableId && item.organizationId === ctx.org.id);
  if (!deliverable || !canViewDeliverable(db, ctx, deliverable)) return fail("Not found.");

  const parsed = commentSchema.safeParse({
    body: formData.get("body"),
    visibility: ctx.kind === "client" ? "client" : (formData.get("visibility") ?? "client"),
  });
  if (!parsed.success) return invalid(parsed.error);
  if (ctx.kind === "team" && !can(ctx.role, "comments.internal")) return fail("You can't comment here.");

  const now = new Date().toISOString();
  db.comments.push({
    id: newId("cmt"),
    organizationId: ctx.org.id,
    projectId: deliverable.projectId,
    deliverableId: deliverable.id,
    authorUserId: user.id,
    body: parsed.data.body,
    visibility: parsed.data.visibility,
    createdAt: now,
  });
  recordActivity(db, ctx, {
    projectId: deliverable.projectId,
    verb: "comment.posted",
    targetType: "deliverable",
    targetId: deliverable.id,
    targetLabel: deliverable.title,
    visibility: parsed.data.visibility,
  });

  const teamHref = `/w/${ctx.org.slug}/projects/${deliverable.projectId}/deliverables/${deliverable.id}`;
  notify(db, ctx, projectAudience(db, ctx.org.id, deliverable.projectId), {
    type: "comment.posted",
    title: `${user.name} commented on ${deliverable.title}`,
    body: parsed.data.body.slice(0, 140),
    href: teamHref,
    deduplicationKey: `comment:${deliverable.id}:${user.id}`,
  });
  if (parsed.data.visibility === "client") {
    notify(db, ctx, clientAudience(db, ctx.org.id, deliverable.projectId), {
      type: "comment.posted",
      title: `${user.name} commented on ${deliverable.title}`,
      body: parsed.data.body.slice(0, 140),
      href: `/portal/${ctx.org.slug}/deliverables/${deliverable.id}`,
      deduplicationKey: `comment:${deliverable.id}:${user.id}`,
    });
  }
  await saveDb();
  refresh();
  return ok();
}

/**
 * Issues a 60-second download link after re-checking access. Every download
 * is written to the audit log.
 */
export async function requestDownload(orgSlug: string, objectId: string, kind: "version" | "file") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in again.");
  const db = await getDb();
  const ctx: AccessContext | null = resolveTeamContext(db, user.id, orgSlug) ?? resolveClientContext(db, user.id, orgSlug);
  if (!ctx) throw new Error("Not found");

  let label: string;
  let storageKey: string;
  if (kind === "version") {
    const version = db.deliverableVersions.find((item) => item.id === objectId && item.organizationId === ctx.org.id);
    const deliverable = version && db.deliverables.find((item) => item.id === version.deliverableId);
    if (!version || !deliverable || !canViewDeliverable(db, ctx, deliverable)) throw new Error("Not found");
    // Clients only download versions that were sent to them.
    if (ctx.kind === "client" && deliverable.status === "draft" && version.version === deliverable.currentVersion) throw new Error("Not found");
    label = version.fileName;
    storageKey = version.storageKey;
  } else {
    const file = db.files.find((item) => item.id === objectId && item.organizationId === ctx.org.id);
    const project = file && db.projects.find((item) => item.id === file.projectId);
    if (!file || !project || !canViewProject(db, ctx, project) || (ctx.kind === "client" && file.visibility !== "client")) {
      throw new Error("Not found");
    }
    label = file.name;
    storageKey = file.storageKey;
  }

  recordAudit(db, ctx, { action: "file.downloaded", entityType: kind === "version" ? "deliverable_version" : "file", entityId: objectId, summary: `Downloaded ${label}` });
  await saveDb();

  if (usesSupabase()) {
    // Private bucket: a signed URL that names this one object and expires in a minute.
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const { data, error } = await supabaseAdmin().storage.from(PROJECT_FILES_BUCKET).createSignedUrl(storageKey, 60, { download: label });
    if (error || !data) throw new Error("This file isn't available right now.");
    return { url: data.signedUrl, expiresInSeconds: 60, fileName: label };
  }

  const { token, expiresInSeconds } = signDownload({ objectId, kind, userId: user.id, orgSlug });
  return { url: `/api/files/download?token=${encodeURIComponent(token)}`, expiresInSeconds, fileName: label };
}
