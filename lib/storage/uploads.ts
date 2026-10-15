import "server-only";
import { PROJECT_FILES_BUCKET, usesSupabase } from "@/lib/supabase/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import { signClaims, verifyClaims } from "./signed-urls";

/**
 * Uploads go straight from the browser to private storage:
 *
 * 1. `prepareUpload` checks access, file type, size and plan storage, picks
 *    the object key and returns a signed ticket plus a Supabase signed upload URL.
 * 2. The browser PUTs the bytes to that URL (the app server never sees them).
 * 3. The action that saves the row calls `claimUpload`: the ticket must match
 *    the organization, project, person and file, and the object must exist
 *    with the size the browser reported.
 *
 * Without Supabase (tests, local memory mode) steps 2 and 3 skip storage.
 */
const TICKET_TTL_SECONDS = 2 * 60 * 60;
const PREVIEW_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export interface UploadClaims {
  orgId: string;
  projectId: string;
  userId: string;
  storageKey: string;
  fileName: string;
  sizeBytes: number;
}

export function uploadKey(orgId: string, projectId: string, kind: "files" | "deliverables") {
  return `org/${orgId}/projects/${projectId}/${kind}/${crypto.randomUUID()}`;
}

export async function issueUpload(claims: UploadClaims): Promise<{ ticket: string; uploadUrl: string | null }> {
  const ticket = signClaims(claims, TICKET_TTL_SECONDS);
  if (!usesSupabase()) return { ticket, uploadUrl: null };
  const { data, error } = await supabaseAdmin().storage.from(PROJECT_FILES_BUCKET).createSignedUploadUrl(claims.storageKey);
  if (error || !data) throw new Error(`Creating an upload URL failed: ${error?.message ?? "no URL returned"}`);
  return { ticket, uploadUrl: data.signedUrl };
}

type Claimed = { ok: true; storageKey: string; hasPreview: boolean } | { ok: false; message: string };

export async function claimUpload(
  formData: FormData,
  expected: Omit<UploadClaims, "storageKey"> & { mimeType: string },
  kind: "files" | "deliverables",
): Promise<Claimed> {
  const ticket = formData.get("uploadTicket");
  if (!usesSupabase() && !ticket) {
    // Memory mode, called directly (unit tests): metadata only.
    return { ok: true, storageKey: uploadKey(expected.orgId, expected.projectId, kind), hasPreview: false };
  }
  const claims = typeof ticket === "string" && ticket ? verifyClaims<UploadClaims>(ticket) : null;
  if (
    !claims ||
    claims.orgId !== expected.orgId ||
    claims.projectId !== expected.projectId ||
    claims.userId !== expected.userId ||
    claims.fileName !== expected.fileName ||
    claims.sizeBytes !== expected.sizeBytes
  ) {
    return { ok: false, message: "The upload didn't finish or has expired. Choose the file again." };
  }
  if (!usesSupabase()) return { ok: true, storageKey: claims.storageKey, hasPreview: false };

  const { data, error } = await supabaseAdmin().storage.from(PROJECT_FILES_BUCKET).info(claims.storageKey);
  if (error || !data) return { ok: false, message: "We couldn't find the uploaded file. Choose it again." };
  if (typeof data.size === "number" && data.size !== expected.sizeBytes) {
    return { ok: false, message: "The uploaded file doesn't match the one you chose. Choose it again." };
  }
  // Previews only when the stored type is the raster type the browser declared.
  const storedType = data.contentType?.split(";")[0].trim();
  const hasPreview = PREVIEW_TYPES.includes(expected.mimeType) && storedType === expected.mimeType;
  return { ok: true, storageKey: claims.storageKey, hasPreview };
}

/** Deletes stored bytes after their row is gone. Failures are logged, not shown: the row is already removed. */
export async function removeStoredObject(storageKey: string) {
  if (!usesSupabase()) return;
  const { error } = await supabaseAdmin().storage.from(PROJECT_FILES_BUCKET).remove([storageKey]);
  if (error) console.error(`[atrium] removing ${storageKey} from storage failed`, error.message);
}

/** A short-lived link for showing an uploaded image inline. Call only after the access check. */
export async function previewUrlFor(object: { storageKey: string; hasPreview?: boolean }) {
  if (!usesSupabase() || !object.hasPreview) return null;
  const { data, error } = await supabaseAdmin().storage.from(PROJECT_FILES_BUCKET).createSignedUrl(object.storageKey, 600);
  return error ? null : data.signedUrl;
}
